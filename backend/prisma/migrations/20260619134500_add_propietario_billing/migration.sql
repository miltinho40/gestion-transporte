CREATE TYPE "estado_suscripcion_propietario" AS ENUM ('activa', 'prueba', 'suspendida', 'cancelada');

ALTER TABLE "propietarios"
ADD COLUMN "estado_suscripcion" "estado_suscripcion_propietario" NOT NULL DEFAULT 'activa',
ADD COLUMN "limite_vehiculos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "precio_por_vehiculo" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "fecha_corte_facturacion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "observaciones_facturacion" VARCHAR(255);

ALTER TABLE "vehiculos"
ADD COLUMN "facturable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fecha_alta_facturacion" DATE,
ADD COLUMN "fecha_baja_facturacion" DATE;

UPDATE "vehiculos"
SET "fecha_alta_facturacion" = CURRENT_DATE
WHERE "facturable" = true
  AND "fecha_alta_facturacion" IS NULL;
