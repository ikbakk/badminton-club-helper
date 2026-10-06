-- These claim RPCs were revoked by the authenticated-admin authority migration.
-- One still references session_operator_credentials, which that migration drops.
-- Remove both dead entry points; session_operator_leases remains only as a legacy
-- audit reference for historical session_events and is not an authority source.
drop function if exists public.claim_operator_lease(uuid, text, text, boolean);
drop function if exists public.claim_admin_operator_lease(uuid, text, boolean);

notify pgrst, 'reload schema';
