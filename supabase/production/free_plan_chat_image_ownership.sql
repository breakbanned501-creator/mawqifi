-- Prepared supplement AFTER the 14 reviewed migrations; NOT executed remotely.
-- Storage records stay read-only. API copies have no original owner, so persist
-- trusted ownership in an application-private table, never client user_metadata.
begin;
create table mawqifi_safety.legacy_chat_image_copies (
 new_path text primary key,
 old_path text not null unique,
 owner_id uuid not null references public.users(id),
 conversation_id uuid not null references public.conversations(id),
 message_id uuid not null unique references public.messages(id),
 old_reference text not null,
 new_reference text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table mawqifi_safety.legacy_chat_image_copies enable row level security;
revoke all on mawqifi_safety.legacy_chat_image_copies from public,anon,authenticated,service_role;
-- Only the reviewed definer RPC writes this mapping. Even service_role has no
-- direct table write grant; clients cannot assign an owner or alter the audit.

create function public.legacy_chat_image_inventory() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if (select count(*) from storage.objects where bucket_id='chat-images')<>4 then
  raise exception 'IMAGE_INVENTORY_CHANGED';
 end if;
 select jsonb_agg(jsonb_build_object(
  'source_object_id',o.id,'old_path',o.name,'owner_id',m.sender_id,
  'conversation_id',m.conversation_id,'message_id',m.id,'old_reference',m.image_url,
  'participants',jsonb_build_array(c.owner_id,c.requester_id),
  'source_updated_at',to_jsonb(o)->>'updated_at','metadata',to_jsonb(o)->'metadata'
 ) order by o.id) into result
 from storage.objects o join public.messages m
 on m.image_url='https://opsyvdsivxoqphkfdsbb.supabase.co/storage/v1/object/public/chat-images/'||o.name
 join public.conversations c on c.id=m.conversation_id
 join public.users u on u.id=m.sender_id and u.deleted_at is null
 where o.bucket_id='chat-images' and o.name like 'chat/'||c.id::text||'/%'
 and m.type='image' and m.sender_id in(c.owner_id,c.requester_id)
 and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=m.sender_id::text;
 if jsonb_array_length(coalesce(result,'[]'))<>4 then raise exception 'IMAGE_OWNERSHIP_REVIEW_REQUIRED'; end if;
 return result;
end; $$;
revoke all on function public.legacy_chat_image_inventory() from public,anon,authenticated;
grant execute on function public.legacy_chat_image_inventory() to service_role;

create function public.commit_legacy_chat_image_copies(manifest jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; src record; dst record; msg public.messages%rowtype; prior record;
 new_name text; new_url text; owner uuid;
begin
 if manifest is null or jsonb_typeof(manifest)<>'array' or jsonb_array_length(manifest)<>4 then raise exception 'IMAGE_MANIFEST_INVALID'; end if;
 if (select count(distinct value->>'message_id') from jsonb_array_elements(manifest))<>4
  or (select count(distinct value->>'new_path') from jsonb_array_elements(manifest))<>4 then raise exception 'IMAGE_MANIFEST_INVALID'; end if;
 if not exists(select 1 from storage.buckets where id='chat-images' and not public) then raise exception 'IMAGE_BUCKET_MUST_BE_PRIVATE'; end if;
 -- Same transaction lock as deletion. Acquire before message locks, so a new
 -- mapping cannot commit after deletion has already captured its owned manifest.
 for owner in select distinct (value->>'owner_id')::uuid from jsonb_array_elements(manifest) order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('account:'||owner::text,0));
 end loop;
 for item in select value from jsonb_array_elements(manifest) order by value->>'message_id' loop
  owner:=(item->>'owner_id')::uuid;
  new_name:=item->>'new_path';
  if new_name !~ ('^chat/'||(item->>'conversation_id')||'/[a-f0-9-]{36}\.(png|jpg|jpeg|webp|gif)$')
   or new_name=item->>'old_path' or item->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'IMAGE_MANIFEST_INVALID'; end if;
  new_url:='https://opsyvdsivxoqphkfdsbb.supabase.co/storage/v1/object/authenticated/chat-images/'||new_name;
  select * into msg from public.messages where id=(item->>'message_id')::uuid for update;
  if not found or msg.sender_id<>owner or msg.conversation_id<>(item->>'conversation_id')::uuid or msg.type<>'image' then raise exception 'IMAGE_MESSAGE_CHANGED'; end if;
  if not exists(select 1 from public.users where id=owner and deleted_at is null)
   or exists(select 1 from mawqifi_safety.account_deletion_jobs where user_id=owner) then raise exception 'IMAGE_OWNER_DELETING'; end if;
  select * into prior from mawqifi_safety.legacy_chat_image_copies where message_id=msg.id;
  if found then
   if prior.new_path<>new_name or prior.owner_id<>owner or prior.sha256<>item->>'sha256'
    or prior.old_path<>item->>'old_path' or prior.old_reference<>item->>'old_reference'
    or msg.image_url<>new_url then raise exception 'IMAGE_MAPPING_CONFLICT'; end if;
   continue; -- Lost response retry, no rewrite/overwrite.
  end if;
  if msg.image_url<>item->>'old_reference' then raise exception 'IMAGE_MESSAGE_CHANGED'; end if;
  select * into src from storage.objects where id=(item->>'source_object_id')::uuid and bucket_id='chat-images' and name=item->>'old_path' for update;
  if not found or coalesce(to_jsonb(src)->>'owner_id',to_jsonb(src)->>'owner') is distinct from owner::text
   or (to_jsonb(src)->>'updated_at') is distinct from (item->>'source_updated_at') then raise exception 'IMAGE_SOURCE_CHANGED'; end if;
  if msg.image_url<>'https://opsyvdsivxoqphkfdsbb.supabase.co/storage/v1/object/public/chat-images/'||src.name then raise exception 'IMAGE_SOURCE_CHANGED'; end if;
  select * into dst from storage.objects where bucket_id='chat-images' and name=new_name for update;
  if not found or (coalesce(to_jsonb(dst)->>'owner_id',to_jsonb(dst)->>'owner') is not null
   and coalesce(to_jsonb(dst)->>'owner_id',to_jsonb(dst)->>'owner')<>owner::text) then raise exception 'IMAGE_DESTINATION_INVALID'; end if;
  insert into mawqifi_safety.legacy_chat_image_copies(new_path,old_path,owner_id,conversation_id,message_id,old_reference,new_reference,sha256)
   values(new_name,src.name,owner,msg.conversation_id,msg.id,msg.image_url,new_url,item->>'sha256');
  update public.messages set image_url=new_url where id=msg.id;
 end loop;
end; $$;
revoke all on function public.commit_legacy_chat_image_copies(jsonb) from public,anon,authenticated;
grant execute on function public.commit_legacy_chat_image_copies(jsonb) to service_role;

create function public.legacy_chat_image_copy_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('current_reference',m.image_url)),'[]')
 from mawqifi_safety.legacy_chat_image_copies x join public.messages m on m.id=x.message_id;
$$;
revoke all on function public.legacy_chat_image_copy_status() from public,anon,authenticated;
grant execute on function public.legacy_chat_image_copy_status() to service_role;

-- Extend only the existing ownership predicate; preserve tested deletion body.
do $$ declare definition text; original text; replacement text; begin
 original:='from storage.objects o where to_jsonb(o)->>''owner_id''=uid::text or to_jsonb(o)->>''owner''=uid::text;';
 replacement:='from storage.objects o where to_jsonb(o)->>''owner_id''=uid::text or to_jsonb(o)->>''owner''=uid::text
 or exists(select 1 from mawqifi_safety.legacy_chat_image_copies x where o.bucket_id=''chat-images'' and x.new_path=o.name and x.owner_id=uid);';
 definition:=pg_get_functiondef('mawqifi_safety.begin_account_deletion()'::regprocedure);
 if position(original in definition)=0 then raise exception 'UNEXPECTED_DELETION_FUNCTION_REVIEW_REQUIRED'; end if;
 execute replace(definition,original,replacement);
end $$;
commit;
