CREATE TABLE "sesiones_usuario" (
    "id" UUID NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "propietario_id" BIGINT,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocada_en" TIMESTAMPTZ(6),
    "ultimo_uso_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sesiones_usuario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sesiones_usuario_refresh_token_hash_key"
ON "sesiones_usuario"("refresh_token_hash");

CREATE INDEX "sesiones_usuario_usuario_id_revocada_en_expira_en_idx"
ON "sesiones_usuario"("usuario_id", "revocada_en", "expira_en");

CREATE INDEX "sesiones_usuario_propietario_id_revocada_en_idx"
ON "sesiones_usuario"("propietario_id", "revocada_en");

ALTER TABLE "sesiones_usuario"
ADD CONSTRAINT "sesiones_usuario_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sesiones_usuario"
ADD CONSTRAINT "sesiones_usuario_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
