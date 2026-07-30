CREATE TABLE "preferencias_asistente" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "clave" VARCHAR(120) NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" VARCHAR(255),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "preferencias_asistente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preferencias_asistente_propietario_id_usuario_id_clave_key"
ON "preferencias_asistente"("propietario_id", "usuario_id", "clave");

CREATE INDEX "preferencias_asistente_propietario_id_usuario_id_activa_idx"
ON "preferencias_asistente"("propietario_id", "usuario_id", "activa");

CREATE INDEX "preferencias_asistente_usuario_id_tipo_activa_idx"
ON "preferencias_asistente"("usuario_id", "tipo", "activa");

ALTER TABLE "preferencias_asistente"
ADD CONSTRAINT "preferencias_asistente_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "preferencias_asistente"
ADD CONSTRAINT "preferencias_asistente_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
