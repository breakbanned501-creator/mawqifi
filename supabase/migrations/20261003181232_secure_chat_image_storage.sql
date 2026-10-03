-- Data-preserving: no object/message rewrite or deletion. Apply to staging first.
begin;
-- Internal trigger helpers are not client RPCs; triggers continue to invoke them.
revoke execute on function public.handle_new_user() from public,anon,authenticated;
alter function public.set_updated_at() set search_path='';
update storage.buckets set public=false where id='chat-images';
create function mawqifi_safety.chat_image_access(object_name text, uploading boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare c public.conversations%rowtype; cid uuid;
begin
 if auth.uid() is null or object_name !~ '^chat/[0-9a-fA-F-]{36}/[^/]+$' then return false; end if;
 begin cid:=split_part(object_name,'/',2)::uuid; exception when invalid_text_representation then return false; end;
 select * into c from public.conversations where id=cid;
 if not found or auth.uid() not in(c.owner_id,c.requester_id) then return false; end if;
 -- History is readable even after closure/blocking. Uploads follow message rules.
 if not uploading then return true; end if;
 perform mawqifi_safety.assert_unrestricted();
 return not c.closed and not mawqifi_safety.blocked_pair(c.owner_id,c.requester_id)
  and not exists(select 1 from public.parking_claims p where p.conversation_id=cid
   and (p.status in('completed','cancelled') or p.chat_closes_at<=clock_timestamp()));
end; $$;
revoke all on function mawqifi_safety.chat_image_access(text,boolean) from public,anon;
grant execute on function mawqifi_safety.chat_image_access(text,boolean) to authenticated;
drop policy if exists chat_images_public_read on storage.objects;
drop policy if exists chat_images_authenticated_upload on storage.objects;
create policy chat_images_participant_read on storage.objects for select to authenticated
 using(bucket_id='chat-images' and mawqifi_safety.chat_image_access(name,false));
create policy chat_images_participant_upload on storage.objects for insert to authenticated
 with check(bucket_id='chat-images' and mawqifi_safety.chat_image_access(name,true));
-- Restrictive guards prevent another permissive policy from granting cross-chat access.
create policy chat_images_membership_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'chat-images' or mawqifi_safety.chat_image_access(name,false))
 with check(bucket_id<>'chat-images' or mawqifi_safety.chat_image_access(name,true));
create policy chat_images_no_anonymous_access on storage.objects as restrictive for all to anon
 using(bucket_id<>'chat-images') with check(bucket_id<>'chat-images');
-- No UPDATE/DELETE policy: participants cannot replace/delete saved history.
commit;
