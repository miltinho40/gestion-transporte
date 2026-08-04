CREATE TABLE "auditoria_eventos" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "usuario_id" BIGINT,
    "entidad" VARCHAR(80) NOT NULL,
    "entidad_id" VARCHAR(80),
    "accion" VARCHAR(80) NOT NULL,
    "resumen" VARCHAR(255),
    "antes" JSONB,
    "despues" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_eventos_propietario_id_created_at_idx" ON "auditoria_eventos"("propietario_id", "created_at");
CREATE INDEX "auditoria_eventos_usuario_id_created_at_idx" ON "auditoria_eventos"("usuario_id", "created_at");
CREATE INDEX "auditoria_eventos_entidad_entidad_id_idx" ON "auditoria_eventos"("entidad", "entidad_id");

ALTER TABLE "auditoria_eventos" ADD CONSTRAINT "auditoria_eventos_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditoria_eventos" ADD CONSTRAINT "auditoria_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
