begin;

update public.parking_claims claim
set reverse_match = true,
    status = 'claimed',
    arrived_at = null,
    chat_closes_at = claim.claimed_at + interval '60 minutes',
    completed_at = null
from public.parking_match_offers offer
where offer.post_id = claim.post_id
  and offer.auto_created_post
  and offer.status = 'accepted'
  and claim.status in ('claimed','arrived')
  and not claim.reverse_match;

select mawqifi_safety.expire_reverse_matches();

commit;
