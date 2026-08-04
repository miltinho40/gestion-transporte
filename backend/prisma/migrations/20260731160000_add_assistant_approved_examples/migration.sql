CREATE TABLE "ejemplos_asistente" (
    "id" BIGSERIAL NOT NULL,
    "evaluacion_id" BIGINT NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "mensaje_usuario" TEXT NOT NULL,
    "correccion" TEXT NOT NULL,
    "herramienta_esperada" VARCHAR(80) NOT NULL,
    "parametros_esperados" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ejemplos_asistente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ejemplos_asistente_evaluacion_id_key"
ON "ejemplos_asistente"("evaluacion_id");

CREATE INDEX "ejemplos_asistente_propietario_id_activo_updated_at_idx"
ON "ejemplos_asistente"("propietario_id", "activo", "updated_at");

ALTER TABLE "ejemplos_asistente"
ADD CONSTRAINT "ejemplos_asistente_evaluacion_id_fkey"
FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones_asistente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ejemplos_asistente"
ADD CONSTRAINT "ejemplos_asistente_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
