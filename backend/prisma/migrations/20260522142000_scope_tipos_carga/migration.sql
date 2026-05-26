ALTER TABLE "tipos_carga"
ADD COLUMN IF NOT EXISTS "propietario_id" BIGINT;

ALTER TABLE "tipos_carga"
DROP CONSTRAINT IF EXISTS "tipos_carga_nombre_key";

ALTER TABLE "tipos_carga"
ADD CONSTRAINT "tipos_carga_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "tipos_carga_propietario_id_idx"
ON "tipos_carga"("propietario_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tipos_carga_global"
ON "tipos_carga"("nombre")
WHERE "propietario_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tipos_carga_propietario"
ON "tipos_carga"("propietario_id", "nombre")
WHERE "propietario_id" IS NOT NULL;
