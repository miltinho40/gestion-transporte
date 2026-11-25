\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('kind', 'database', 'database', current_database(), 'version', current_setting('server_version'), 'captured_at', now());
SELECT jsonb_build_object('kind', 'migration', 'name', migration_name, 'checksum', checksum, 'finished', finished_at IS NOT NULL, 'rolled_back', rolled_back_at IS NOT NULL)
FROM _prisma_migrations ORDER BY started_at, id;
-- Only digests and counts leave the database, not customer or credential values.
SELECT format(
  'SELECT jsonb_build_object(''kind'', ''table'', ''name'', %L, ''rows'', count(*), ''hash'', md5(COALESCE(jsonb_agg(to_jsonb(t) - ''facturar_a_id'' - ''ruta_inversa'' ORDER BY t.id)::text, ''[]''))) FROM public.%I t;',
  tablename, tablename
) FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename
\gexec
COMMIT;
