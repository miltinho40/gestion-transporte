-- Auditoria minima para cierres semanales.
ALTER TABLE "cierres_semanales"
ADD COLUMN IF NOT EXISTS "cerrado_por_usuario_id" BIGINT;

CREATE INDEX IF NOT EXISTS "cierres_semanales_cerrado_por_usuario_id_idx"
ON "cierres_semanales"("cerrado_por_usuario_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cierres_semanales_cerrado_por_usuario_id_fkey'
  ) THEN
    ALTER TABLE "cierres_semanales"
    ADD CONSTRAINT "cierres_semanales_cerrado_por_usuario_id_fkey"
    FOREIGN KEY ("cerrado_por_usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indices para filtros frecuentes de viajes, cierres y reportes.
CREATE INDEX IF NOT EXISTS "viajes_propietario_id_fecha_llegada_idx"
ON "viajes"("propietario_id", "fecha_llegada");

CREATE INDEX IF NOT EXISTS "viajes_propietario_id_cliente_id_fecha_llegada_idx"
ON "viajes"("propietario_id", "cliente_id", "fecha_llegada");

CREATE INDEX IF NOT EXISTS "viajes_propietario_id_vehiculo_id_fecha_llegada_idx"
ON "viajes"("propietario_id", "vehiculo_id", "fecha_llegada");

CREATE INDEX IF NOT EXISTS "mantenimientos_propietario_id_vehiculo_id_fecha_mantenimiento_idx"
ON "mantenimientos"("propietario_id", "vehiculo_id", "fecha_mantenimiento");

CREATE INDEX IF NOT EXISTS "gastos_semanales_vehiculo_propietario_id_vehiculo_id_anio_numero_semana_idx"
ON "gastos_semanales_vehiculo"("propietario_id", "vehiculo_id", "anio", "numero_semana");

-- Restricciones defensivas para datos nuevos/actualizados. NOT VALID evita bloquear datos historicos.
ALTER TABLE "cierres_semanales"
ADD CONSTRAINT "cierres_semanales_semana_range_chk"
CHECK ("anio" BETWEEN 2000 AND 2100 AND "numero_semana" BETWEEN 1 AND 53) NOT VALID;

ALTER TABLE "cierres_semanales"
ADD CONSTRAINT "cierres_semanales_fecha_range_chk"
CHECK ("fecha_fin" >= "fecha_inicio") NOT VALID;

ALTER TABLE "cierres_semanales"
ADD CONSTRAINT "cierres_semanales_counts_nonnegative_chk"
CHECK (
  "cantidad_viajes" >= 0
  AND "cantidad_mantenimientos" >= 0
  AND "cantidad_gastos_semanales" >= 0
) NOT VALID;

ALTER TABLE "viajes"
ADD CONSTRAINT "viajes_money_nonnegative_chk"
CHECK (
  "precio_flete" >= 0
  AND "valor_comision" >= 0
  AND "precio_real_flete" >= 0
  AND "galones_diesel" >= 0
  AND "costo_diesel" >= 0
  AND "costo_peajes" >= 0
  AND "costo_estimado_gastos" >= 0
  AND "viaticos" >= 0
  AND COALESCE("costo_real_gastos", 0) >= 0
) NOT VALID;

ALTER TABLE "mantenimientos"
ADD CONSTRAINT "mantenimientos_money_km_nonnegative_chk"
CHECK (
  "kilometraje_actual_vehiculo" >= 0
  AND "costo_mano_obra" >= 0
  AND "costo_repuestos" >= 0
  AND "costo_total" >= 0
  AND COALESCE("proximo_mantenimiento_km", 0) >= 0
) NOT VALID;

ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_semana_range_chk"
CHECK ("anio" BETWEEN 2000 AND 2100 AND "numero_semana" BETWEEN 1 AND 53) NOT VALID;

ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_fecha_range_chk"
CHECK ("fecha_fin" >= "fecha_inicio") NOT VALID;

ALTER TABLE "gastos_semanales_vehiculo"
ADD CONSTRAINT "gastos_semanales_monto_nonnegative_chk"
CHECK ("monto" >= 0) NOT VALID;

ALTER TABLE "tarifas_ruta"
ADD CONSTRAINT "tarifas_ruta_values_chk"
CHECK (
  "precio" >= 0
  AND COALESCE("toneladas", 0) >= 0
  AND ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde")
) NOT VALID;

ALTER TABLE "vehiculos"
ADD CONSTRAINT "vehiculos_values_chk"
CHECK (
  "capacidad" >= 0
  AND "toneladas" >= 0
  AND "kilometraje_actual" >= 0
  AND "rendimiento_km_galon" >= 0
) NOT VALID;
