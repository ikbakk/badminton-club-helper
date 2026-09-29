-- Functions must opt into browser execution with an explicit grant. Existing
-- public operator/read RPCs retain their direct anon/authenticated grants.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

notify pgrst, 'reload schema';
