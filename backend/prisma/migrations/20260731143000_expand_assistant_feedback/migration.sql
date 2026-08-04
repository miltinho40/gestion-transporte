ALTER TABLE "evaluaciones_asistente"
ADD COLUMN "revisado_por_id" BIGINT,
ADD COLUMN "estado_revision" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
ADD COLUMN "mensaje_usuario" TEXT,
ADD COLUMN "respuesta_asistente" TEXT,
ADD COLUMN "herramienta" VARCHAR(80),
ADD COLUMN "parametros" JSONB,
ADD COLUMN "proveedor" VARCHAR(20),
ADD COLUMN "modelo" VARCHAR(100),
ADD COLUMN "confianza" DOUBLE PRECISION,
ADD COLUMN "duracion_ms" INTEGER,
ADD COLUMN "tokens_entrada" INTEGER,
ADD COLUMN "tokens_salida" INTEGER,
ADD COLUMN "tokens_total" INTEGER,
ADD COLUMN "revisado_at" TIMESTAMPTZ(6);

CREATE INDEX "evaluaciones_asistente_propietario_id_estado_revision_created_at_idx"
ON "evaluaciones_asistente"("propietario_id", "estado_revision", "created_at");

ALTER TABLE "evaluaciones_asistente"
ADD CONSTRAINT "evaluaciones_asistente_revisado_por_id_fkey"
FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
