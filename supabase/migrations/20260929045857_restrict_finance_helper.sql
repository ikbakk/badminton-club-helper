-- This helper is only invoked by SECURITY DEFINER finance commands; it is not
-- part of the browser RPC surface.
revoke execute on function public.is_finance_admin(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
