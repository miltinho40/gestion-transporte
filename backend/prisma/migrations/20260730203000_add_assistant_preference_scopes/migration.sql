ALTER TABLE "preferencias_asistente"
ADD COLUMN "alcance" VARCHAR(20) NOT NULL DEFAULT 'personal',
ADD COLUMN "scope_key" VARCHAR(80);

UPDATE "preferencias_asistente"
SET "scope_key" = 'usuario:' || "usuario_id"::text
WHERE "scope_key" IS NULL;

ALTER TABLE "preferencias_asistente"
ALTER COLUMN "scope_key" SET NOT NULL;

DROP INDEX "preferencias_asistente_propietario_id_usuario_id_clave_key";

CREATE UNIQUE INDEX "preferencias_asistente_propietario_id_scope_key_clave_key"
ON "preferencias_asistente"("propietario_id", "scope_key", "clave");

CREATE INDEX "preferencias_asistente_propietario_id_scope_key_activa_idx"
ON "preferencias_asistente"("propietario_id", "scope_key", "activa");
