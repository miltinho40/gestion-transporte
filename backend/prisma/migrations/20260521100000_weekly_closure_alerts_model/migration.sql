-- CreateEnum
CREATE TYPE "tipo_gasto_semanal_vehiculo" AS ENUM ('bonificacion_conductor', 'sueldo_conductor', 'varios', 'otro');

-- AlterTable
ALTER TABLE "conductores"
ADD COLUMN "sueldo_semanal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "viajes"
ADD COLUMN "cobrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fecha_cobro" DATE;

-- CreateTable
CREATE TABLE "gastos_semanales_vehiculo" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "vehiculo_id" BIGINT NOT NULL,
    "conductor_id" BIGINT,
    "anio" INTEGER NOT NULL,
    "numero_semana" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "tipo" "tipo_gasto_semanal_vehiculo" NOT NULL DEFAULT 'varios',
    "descripcion" VARCHAR(255),
    "monto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "es_generado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gastos_semanales_vehiculo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gastos_semanales_vehiculo_numero_semana_check" CHECK ("numero_semana" BETWEEN 1 AND 53),
    CONSTRAINT "gastos_semanales_vehiculo_fechas_check" CHECK ("fecha_fin" >= "fecha_inicio"),
    CONSTRAINT "gastos_semanales_vehiculo_monto_check" CHECK ("monto" >= 0),
    CONSTRAINT "gastos_semanales_vehiculo_conductor_check" CHECK (
        "tipo" NOT IN ('bonificacion_conductor', 'sueldo_conductor') OR "conductor_id" IS NOT NULL
    )
);

-- CreateIndex
CREATE INDEX "viajes_propietario_id_cobrado_fecha_salida_idx"
ON "viajes"("propietario_id", "cobrado", "fecha_salida");

-- CreateIndex
CREATE INDEX "gastos_semanales_vehiculo_propietario_id_anio_numero_semana_idx"
ON "gastos_semanales_vehiculo"("propietario_id", "anio", "numero_semana");

-- CreateIndex
CREATE INDEX "gastos_semanales_vehiculo_vehiculo_id_anio_numero_semana_idx"
ON "gastos_semanales_vehiculo"("vehiculo_id", "anio", "numero_semana");

-- CreateIndex
CREATE INDEX "gastos_semanales_vehiculo_conductor_id_anio_numero_semana_idx"
ON "gastos_semanales_vehiculo"("conductor_id", "anio", "numero_semana");

-- Prevent duplicated generated bonus/salary expenses for the same driver and week.
CREATE UNIQUE INDEX "uq_gastos_semanales_conductor_generados"
ON "gastos_semanales_vehiculo"("propietario_id", "conductor_id", "anio", "numero_semana", "tipo")
WHERE "tipo" IN ('bonificacion_conductor', 'sueldo_conductor') AND "conductor_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_vehiculo_propietario_id_fkey"
FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_vehiculo_vehiculo_id_fkey"
FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_vehiculo_conductor_id_fkey"
FOREIGN KEY ("conductor_id") REFERENCES "conductores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
