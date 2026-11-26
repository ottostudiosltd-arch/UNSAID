-- Ensure service_role has explicit table/sequence privileges while anon & authenticated remain revoked (default-deny).

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
