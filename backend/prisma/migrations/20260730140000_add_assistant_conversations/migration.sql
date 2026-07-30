CREATE TABLE "conversaciones_asistente" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "canal" VARCHAR(20) NOT NULL DEFAULT 'web',
    "titulo" VARCHAR(160),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "contexto" JSONB,
    "ultimo_mensaje_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_asistente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensajes_asistente" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    "contenido" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_asistente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "borradores_asistente" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "datos" JSONB NOT NULL,
    "advertencias" JSONB,
    "expira_at" TIMESTAMPTZ(6),
    "aplicado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borradores_asistente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ejecuciones_herramientas_asistente" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "herramienta" VARCHAR(80) NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "parametros" JSONB,
    "resultado" JSONB,
    "requiere_confirmacion" BOOLEAN NOT NULL DEFAULT false,
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "error" VARCHAR(500),
    "duracion_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejecuciones_herramientas_asistente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversaciones_asistente_propietario_id_usuario_id_ultimo_mensaje_at_idx"
ON "conversaciones_asistente"("propietario_id", "usuario_id", "ultimo_mensaje_at");

CREATE INDEX "conversaciones_asistente_usuario_id_estado_idx"
ON "conversaciones_asistente"("usuario_id", "estado");

CREATE INDEX "mensajes_asistente_conversacion_id_created_at_idx"
ON "mensajes_asistente"("conversacion_id", "created_at");

CREATE INDEX "borradores_asistente_conversacion_id_estado_updated_at_idx"
ON "borradores_asistente"("conversacion_id", "estado", "updated_at");

CREATE INDEX "ejecuciones_herramientas_asistente_conversacion_id_created_at_idx"
ON "ejecuciones_herramientas_asistente"("conversacion_id", "created_at");

CREATE INDEX "ejecuciones_herramientas_asistente_herramienta_estado_idx"
ON "ejecuciones_herramientas_asistente"("herramienta", "estado");

ALTER TABLE "conversaciones_asistente"
ADD CONSTRAINT "conversaciones_asistente_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversaciones_asistente"
ADD CONSTRAINT "conversaciones_asistente_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mensajes_asistente"
ADD CONSTRAINT "mensajes_asistente_conversacion_id_fkey"
FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "borradores_asistente"
ADD CONSTRAINT "borradores_asistente_conversacion_id_fkey"
FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ejecuciones_herramientas_asistente"
ADD CONSTRAINT "ejecuciones_herramientas_asistente_conversacion_id_fkey"
FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
