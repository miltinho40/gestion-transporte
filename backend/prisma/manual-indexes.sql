-- Prisma no soporta indices parciales en schema.prisma.
-- Ejecutar/agregar este SQL a la migracion inicial despues de `prisma migrate dev --create-only`.

CREATE UNIQUE INDEX IF NOT EXISTS uq_configuraciones_global
ON configuraciones_operativas (clave)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_configuraciones_propietario
ON configuraciones_operativas (propietario_id, clave)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_peaje_global
ON categorias_peaje (nombre)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_peaje_propietario
ON categorias_peaje (propietario_id, nombre)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rutas_global
ON rutas (origen, destino)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rutas_propietario
ON rutas (propietario_id, origen, destino)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_peajes_global
ON peajes (nombre)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_peajes_propietario
ON peajes (propietario_id, nombre)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_carga_global
ON tipos_carga (nombre)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_carga_propietario
ON tipos_carga (propietario_id, nombre)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarifas_peaje_global
ON tarifas_peaje (peaje_id, categoria_peaje_id, vigente_desde)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarifas_peaje_propietario
ON tarifas_peaje (propietario_id, peaje_id, categoria_peaje_id, vigente_desde)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rutas_peajes_global
ON rutas_peajes (ruta_id, peaje_id, sentido)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rutas_peajes_propietario
ON rutas_peajes (propietario_id, ruta_id, peaje_id, sentido)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_mantenimiento_global
ON tipos_mantenimiento (nombre)
WHERE propietario_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_mantenimiento_propietario
ON tipos_mantenimiento (propietario_id, nombre)
WHERE propietario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_gastos_semanales_conductor_generados
ON gastos_semanales_vehiculo (propietario_id, conductor_id, anio, numero_semana, tipo)
WHERE tipo IN ('bonificacion_conductor', 'sueldo_conductor') AND conductor_id IS NOT NULL;
