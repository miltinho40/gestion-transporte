CREATE TABLE "evaluaciones_asistente" (
    "id" BIGSERIAL NOT NULL,
    "mensaje_id" BIGINT NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "calificacion" VARCHAR(20) NOT NULL,
    "correccion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluaciones_asistente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluaciones_asistente_mensaje_id_key"
ON "evaluaciones_asistente"("mensaje_id");

CREATE INDEX "evaluaciones_asistente_propietario_id_calificacion_created_at_idx"
ON "evaluaciones_asistente"("propietario_id", "calificacion", "created_at");

CREATE INDEX "evaluaciones_asistente_usuario_id_created_at_idx"
ON "evaluaciones_asistente"("usuario_id", "created_at");

CREATE INDEX "evaluaciones_asistente_conversacion_id_created_at_idx"
ON "evaluaciones_asistente"("conversacion_id", "created_at");

ALTER TABLE "evaluaciones_asistente"
ADD CONSTRAINT "evaluaciones_asistente_mensaje_id_fkey"
FOREIGN KEY ("mensaje_id") REFERENCES "mensajes_asistente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluaciones_asistente"
ADD CONSTRAINT "evaluaciones_asistente_conversacion_id_fkey"
FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluaciones_asistente"
ADD CONSTRAINT "evaluaciones_asistente_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluaciones_asistente"
ADD CONSTRAINT "evaluaciones_asistente_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
