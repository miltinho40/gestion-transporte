CREATE INDEX "idx_clientes_prop_activo_nombre" ON "clientes"("propietario_id", "activo", "nombre");

CREATE INDEX "idx_conductores_prop_estado_nombre" ON "conductores"("propietario_id", "estado", "nombre");

CREATE INDEX "idx_vehiculos_prop_estado_placa" ON "vehiculos"("propietario_id", "estado", "placa");

CREATE INDEX "idx_tarifas_ruta_prop_activa_ruta_carga" ON "tarifas_ruta"("propietario_id", "activa", "ruta_id", "tipo_carga_id");

CREATE INDEX "idx_viajes_prop_cobro_llegada" ON "viajes"("propietario_id", "cobrado", "fecha_llegada");

CREATE INDEX "idx_viajes_prop_vehiculo_cobro_llegada" ON "viajes"("propietario_id", "vehiculo_id", "cobrado", "fecha_llegada");

CREATE INDEX "idx_gastos_sem_prop_veh_gen_semana" ON "gastos_semanales_vehiculo"("propietario_id", "vehiculo_id", "es_generado", "anio", "numero_semana");

CREATE INDEX "idx_mantenimientos_prop_estado_fecha" ON "mantenimientos"("propietario_id", "estado", "fecha_mantenimiento");
