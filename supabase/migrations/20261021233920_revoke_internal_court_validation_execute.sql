-- These SECURITY DEFINER functions are trigger helpers, not API operations.
revoke execute on function public.validate_session_court_count() from public, anon, authenticated;
revoke execute on function public.validate_match_court_number() from public, anon, authenticated;
