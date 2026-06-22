-- CreateTable
CREATE TABLE "cierres_semanales" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "vehiculo_id" BIGINT NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero_semana" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "cantidad_viajes" INTEGER NOT NULL DEFAULT 0,
    "cantidad_mantenimientos" INTEGER NOT NULL DEFAULT 0,
    "cantidad_gastos_semanales" INTEGER NOT NULL DEFAULT 0,
    "total_precio_flete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_precio_real_flete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_utilidad" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_mantenimientos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_gastos_semanales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_sueldos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_bonificaciones" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "resultado_operativo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "cerrado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cierres_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierres_semanales_propietario_id_vehiculo_id_anio_numero_semana_key" ON "cierres_semanales"("propietario_id", "vehiculo_id", "anio", "numero_semana");

-- CreateIndex
CREATE INDEX "cierres_semanales_propietario_id_anio_numero_semana_idx" ON "cierres_semanales"("propietario_id", "anio", "numero_semana");

-- CreateIndex
CREATE INDEX "cierres_semanales_vehiculo_id_anio_numero_semana_idx" ON "cierres_semanales"("vehiculo_id", "anio", "numero_semana");

-- AddForeignKey
ALTER TABLE "cierres_semanales" ADD CONSTRAINT "cierres_semanales_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_semanales" ADD CONSTRAINT "cierres_semanales_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
