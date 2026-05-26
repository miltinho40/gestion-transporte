-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "estado_vehiculo" AS ENUM ('disponible', 'en_viaje', 'en_mantenimiento', 'inactivo');

-- CreateEnum
CREATE TYPE "estado_conductor" AS ENUM ('activo', 'inactivo', 'licencia_vencida');

-- CreateEnum
CREATE TYPE "estado_viaje" AS ENUM ('programado', 'en_curso', 'completado', 'cancelado');

-- CreateEnum
CREATE TYPE "estado_mantenimiento" AS ENUM ('programado', 'realizado', 'cancelado', 'vencido');

-- CreateEnum
CREATE TYPE "sentido_peaje" AS ENUM ('ida', 'retorno', 'ambos');

-- CreateTable
CREATE TABLE "propietarios" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "ruc_cedula" VARCHAR(20) NOT NULL,
    "contacto_nombre" VARCHAR(120),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "fecha_nacimiento" DATE,
    "es_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_propietarios" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "rol_id" BIGINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "ruc_cedula" VARCHAR(20) NOT NULL,
    "contacto_nombre" VARCHAR(120),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "porcentaje_comision" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conductores" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "cedula" VARCHAR(20) NOT NULL,
    "fecha_nacimiento" DATE,
    "numero_licencia" VARCHAR(50) NOT NULL,
    "fecha_caducidad_licencia" DATE NOT NULL,
    "telefono" VARCHAR(30) NOT NULL,
    "email" VARCHAR(150),
    "estado" "estado_conductor" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conductores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_peaje" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "nombre" VARCHAR(80) NOT NULL,
    "numero_ejes" INTEGER,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categorias_peaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "categoria_peaje_id" BIGINT NOT NULL,
    "placa" VARCHAR(20) NOT NULL,
    "marca" VARCHAR(80) NOT NULL,
    "modelo" VARCHAR(80),
    "color" VARCHAR(50),
    "anio" INTEGER,
    "capacidad" INTEGER NOT NULL,
    "toneladas" DECIMAL(10,2) NOT NULL,
    "kilometraje_actual" INTEGER NOT NULL DEFAULT 0,
    "rendimiento_km_galon" DECIMAL(10,2) NOT NULL,
    "estado" "estado_vehiculo" NOT NULL DEFAULT 'disponible',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "origen" VARCHAR(120) NOT NULL,
    "destino" VARCHAR(120) NOT NULL,
    "distancia_km" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "duracion_estimada_horas" DECIMAL(10,2),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_carga" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tipos_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_ruta" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "ruta_id" BIGINT NOT NULL,
    "tipo_carga_id" BIGINT NOT NULL,
    "capacidad" INTEGER,
    "toneladas" DECIMAL(10,2),
    "precio" DECIMAL(12,2) NOT NULL,
    "vigente_desde" DATE NOT NULL DEFAULT CURRENT_DATE,
    "vigente_hasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarifas_ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peajes" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "nombre" VARCHAR(120) NOT NULL,
    "ubicacion" VARCHAR(180),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "peajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_peaje" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "peaje_id" BIGINT NOT NULL,
    "categoria_peaje_id" BIGINT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vigente_desde" DATE NOT NULL DEFAULT CURRENT_DATE,
    "vigente_hasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarifas_peaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas_peajes" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "ruta_id" BIGINT NOT NULL,
    "peaje_id" BIGINT NOT NULL,
    "orden" INTEGER,
    "sentido" "sentido_peaje" NOT NULL DEFAULT 'ambos',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rutas_peajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viajes" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "vehiculo_id" BIGINT NOT NULL,
    "conductor_id" BIGINT NOT NULL,
    "tarifa_ruta_id" BIGINT NOT NULL,
    "fecha_salida" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_llegada" DATE,
    "descripcion_carga" TEXT,
    "peso_carga_kg" DECIMAL(12,2),
    "numeros_guia_remision" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "precio_flete" DECIMAL(12,2) NOT NULL,
    "porcentaje_comision_aplicado" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valor_comision" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_real_flete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "galones_diesel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_diesel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_peajes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_estimado_gastos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_real_gastos" DECIMAL(12,2),
    "estado" "estado_viaje" NOT NULL DEFAULT 'programado',
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "viajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_gasto_viaje" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tipos_gasto_viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos_viaje" (
    "id" BIGSERIAL NOT NULL,
    "viaje_id" BIGINT NOT NULL,
    "tipo_gasto_id" BIGINT NOT NULL,
    "descripcion" VARCHAR(255),
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_gasto" DATE NOT NULL,
    "es_estimado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gastos_viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuraciones_operativas" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "clave" VARCHAR(100) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "descripcion" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "configuraciones_operativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_mantenimiento" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "es_periodico" BOOLEAN NOT NULL DEFAULT false,
    "intervalo_km" INTEGER,
    "intervalo_dias" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tipos_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenimientos" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "vehiculo_id" BIGINT NOT NULL,
    "tipo_mantenimiento_id" BIGINT NOT NULL,
    "fecha_mantenimiento" DATE NOT NULL DEFAULT CURRENT_DATE,
    "kilometraje_actual_vehiculo" INTEGER NOT NULL,
    "descripcion" TEXT,
    "costo_mano_obra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_repuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "proximo_mantenimiento_km" INTEGER,
    "proximo_mantenimiento_fecha" DATE,
    "estado" "estado_mantenimiento" NOT NULL DEFAULT 'realizado',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mantenimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos_mantenimiento" (
    "id" BIGSERIAL NOT NULL,
    "mantenimiento_id" BIGINT NOT NULL,
    "nombre_repuesto" VARCHAR(150) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "costo_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "repuestos_mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_ruc_cedula_key" ON "propietarios"("ruc_cedula");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_propietarios_propietario_id_idx" ON "usuarios_propietarios"("propietario_id");

-- CreateIndex
CREATE INDEX "usuarios_propietarios_rol_id_idx" ON "usuarios_propietarios"("rol_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_propietarios_usuario_id_propietario_id_key" ON "usuarios_propietarios"("usuario_id", "propietario_id");

-- CreateIndex
CREATE INDEX "clientes_propietario_id_idx" ON "clientes"("propietario_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_propietario_id_ruc_cedula_key" ON "clientes"("propietario_id", "ruc_cedula");

-- CreateIndex
CREATE INDEX "conductores_propietario_id_estado_idx" ON "conductores"("propietario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "conductores_propietario_id_cedula_key" ON "conductores"("propietario_id", "cedula");

-- CreateIndex
CREATE UNIQUE INDEX "conductores_propietario_id_numero_licencia_key" ON "conductores"("propietario_id", "numero_licencia");

-- CreateIndex
CREATE INDEX "categorias_peaje_propietario_id_idx" ON "categorias_peaje"("propietario_id");

-- CreateIndex
CREATE INDEX "vehiculos_propietario_id_estado_idx" ON "vehiculos"("propietario_id", "estado");

-- CreateIndex
CREATE INDEX "vehiculos_categoria_peaje_id_idx" ON "vehiculos"("categoria_peaje_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_propietario_id_placa_key" ON "vehiculos"("propietario_id", "placa");

-- CreateIndex
CREATE INDEX "rutas_propietario_id_idx" ON "rutas"("propietario_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_carga_nombre_key" ON "tipos_carga"("nombre");

-- CreateIndex
CREATE INDEX "tarifas_ruta_propietario_id_ruta_id_tipo_carga_id_idx" ON "tarifas_ruta"("propietario_id", "ruta_id", "tipo_carga_id");

-- CreateIndex
CREATE INDEX "peajes_propietario_id_idx" ON "peajes"("propietario_id");

-- CreateIndex
CREATE INDEX "tarifas_peaje_propietario_id_idx" ON "tarifas_peaje"("propietario_id");

-- CreateIndex
CREATE INDEX "tarifas_peaje_peaje_id_categoria_peaje_id_idx" ON "tarifas_peaje"("peaje_id", "categoria_peaje_id");

-- CreateIndex
CREATE INDEX "rutas_peajes_propietario_id_idx" ON "rutas_peajes"("propietario_id");

-- CreateIndex
CREATE INDEX "rutas_peajes_ruta_id_idx" ON "rutas_peajes"("ruta_id");

-- CreateIndex
CREATE INDEX "viajes_propietario_id_fecha_salida_idx" ON "viajes"("propietario_id", "fecha_salida");

-- CreateIndex
CREATE INDEX "viajes_propietario_id_cliente_id_idx" ON "viajes"("propietario_id", "cliente_id");

-- CreateIndex
CREATE INDEX "viajes_propietario_id_vehiculo_id_idx" ON "viajes"("propietario_id", "vehiculo_id");

-- CreateIndex
CREATE INDEX "viajes_propietario_id_conductor_id_idx" ON "viajes"("propietario_id", "conductor_id");

-- CreateIndex
CREATE INDEX "viajes_propietario_id_estado_idx" ON "viajes"("propietario_id", "estado");

-- CreateIndex
CREATE INDEX "viajes_tarifa_ruta_id_idx" ON "viajes"("tarifa_ruta_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_gasto_viaje_nombre_key" ON "tipos_gasto_viaje"("nombre");

-- CreateIndex
CREATE INDEX "gastos_viaje_viaje_id_idx" ON "gastos_viaje"("viaje_id");

-- CreateIndex
CREATE INDEX "gastos_viaje_tipo_gasto_id_idx" ON "gastos_viaje"("tipo_gasto_id");

-- CreateIndex
CREATE INDEX "configuraciones_operativas_propietario_id_idx" ON "configuraciones_operativas"("propietario_id");

-- CreateIndex
CREATE INDEX "tipos_mantenimiento_propietario_id_idx" ON "tipos_mantenimiento"("propietario_id");

-- CreateIndex
CREATE INDEX "mantenimientos_propietario_id_fecha_mantenimiento_idx" ON "mantenimientos"("propietario_id", "fecha_mantenimiento");

-- CreateIndex
CREATE INDEX "mantenimientos_vehiculo_id_idx" ON "mantenimientos"("vehiculo_id");

-- CreateIndex
CREATE INDEX "repuestos_mantenimiento_mantenimiento_id_idx" ON "repuestos_mantenimiento"("mantenimiento_id");

-- AddForeignKey
ALTER TABLE "usuarios_propietarios" ADD CONSTRAINT "usuarios_propietarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_propietarios" ADD CONSTRAINT "usuarios_propietarios_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_propietarios" ADD CONSTRAINT "usuarios_propietarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conductores" ADD CONSTRAINT "conductores_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_peaje" ADD CONSTRAINT "categorias_peaje_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_categoria_peaje_id_fkey" FOREIGN KEY ("categoria_peaje_id") REFERENCES "categorias_peaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_ruta" ADD CONSTRAINT "tarifas_ruta_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_ruta" ADD CONSTRAINT "tarifas_ruta_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_ruta" ADD CONSTRAINT "tarifas_ruta_tipo_carga_id_fkey" FOREIGN KEY ("tipo_carga_id") REFERENCES "tipos_carga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peajes" ADD CONSTRAINT "peajes_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_peaje" ADD CONSTRAINT "tarifas_peaje_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_peaje" ADD CONSTRAINT "tarifas_peaje_peaje_id_fkey" FOREIGN KEY ("peaje_id") REFERENCES "peajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_peaje" ADD CONSTRAINT "tarifas_peaje_categoria_peaje_id_fkey" FOREIGN KEY ("categoria_peaje_id") REFERENCES "categorias_peaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_peajes" ADD CONSTRAINT "rutas_peajes_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_peajes" ADD CONSTRAINT "rutas_peajes_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_peajes" ADD CONSTRAINT "rutas_peajes_peaje_id_fkey" FOREIGN KEY ("peaje_id") REFERENCES "peajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "conductores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_tarifa_ruta_id_fkey" FOREIGN KEY ("tarifa_ruta_id") REFERENCES "tarifas_ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_viaje" ADD CONSTRAINT "gastos_viaje_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_viaje" ADD CONSTRAINT "gastos_viaje_tipo_gasto_id_fkey" FOREIGN KEY ("tipo_gasto_id") REFERENCES "tipos_gasto_viaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuraciones_operativas" ADD CONSTRAINT "configuraciones_operativas_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_mantenimiento" ADD CONSTRAINT "tipos_mantenimiento_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimientos" ADD CONSTRAINT "mantenimientos_tipo_mantenimiento_id_fkey" FOREIGN KEY ("tipo_mantenimiento_id") REFERENCES "tipos_mantenimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuestos_mantenimiento" ADD CONSTRAINT "repuestos_mantenimiento_mantenimiento_id_fkey" FOREIGN KEY ("mantenimiento_id") REFERENCES "mantenimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes for global records (propietario_id IS NULL)
-- and owner-specific records (propietario_id IS NOT NULL).
-- Prisma does not model partial indexes in schema.prisma.

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
