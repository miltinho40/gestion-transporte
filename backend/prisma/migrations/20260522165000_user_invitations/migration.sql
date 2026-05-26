CREATE TYPE "tipo_invitacion_usuario" AS ENUM ('crear_password', 'reset_password');

ALTER TABLE "usuarios"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "email_verificado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiere_password" BOOLEAN NOT NULL DEFAULT false;

UPDATE "usuarios"
SET "email_verificado" = true
WHERE "password_hash" IS NOT NULL;

CREATE TABLE "invitaciones_usuario" (
  "id" BIGSERIAL PRIMARY KEY,
  "usuario_id" BIGINT NOT NULL,
  "propietario_id" BIGINT,
  "email" VARCHAR(150) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "tipo" "tipo_invitacion_usuario" NOT NULL DEFAULT 'crear_password',
  "fecha_expiracion" TIMESTAMPTZ(6) NOT NULL,
  "usado" BOOLEAN NOT NULL DEFAULT false,
  "fecha_uso" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "invitaciones_usuario_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invitaciones_usuario_propietario_id_fkey"
    FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "invitaciones_usuario_token_hash_key"
ON "invitaciones_usuario" ("token_hash");

CREATE INDEX "invitaciones_usuario_usuario_id_idx"
ON "invitaciones_usuario" ("usuario_id");

CREATE INDEX "invitaciones_usuario_propietario_id_idx"
ON "invitaciones_usuario" ("propietario_id");

CREATE INDEX "invitaciones_usuario_email_idx"
ON "invitaciones_usuario" ("email");

CREATE INDEX "invitaciones_usuario_usado_fecha_expiracion_idx"
ON "invitaciones_usuario" ("usado", "fecha_expiracion");
