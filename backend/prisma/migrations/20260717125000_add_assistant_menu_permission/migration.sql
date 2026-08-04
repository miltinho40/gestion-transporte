UPDATE "roles"
SET "permisos" = array_append("permisos", 'asistente')
WHERE "permisos_configurados" = TRUE
  AND NOT ('asistente' = ANY("permisos"));
