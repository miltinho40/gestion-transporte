-- Add owner/intermediary capabilities to user assignments.
ALTER TABLE "usuarios_propietarios"
  ADD COLUMN "es_propietario" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "es_intermediario" BOOLEAN NOT NULL DEFAULT false;

-- Store collection support for own trips.
ALTER TABLE "viajes"
  ADD COLUMN "soporte_cobro" VARCHAR(80),
  ADD COLUMN "sin_factura_cobro" BOOLEAN;

UPDATE "viajes"
SET "soporte_cobro" = NULL,
    "sin_factura_cobro" = NULL;

-- Providers catalog for intermediary trips.
CREATE TABLE "proveedores" (
  "id" BIGSERIAL NOT NULL,
  "propietario_id" BIGINT NOT NULL,
  "ruc_cedula" VARCHAR(20) NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "telefono" VARCHAR(30),
  "email" VARCHAR(150),
  "observacion" VARCHAR(255),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- Trips executed by providers. They keep client collection and provider payment separated.
CREATE TABLE "viajes_proveedor" (
  "id" BIGSERIAL NOT NULL,
  "propietario_id" BIGINT NOT NULL,
  "cliente_id" BIGINT NOT NULL,
  "proveedor_id" BIGINT NOT NULL,
  "tarifa_ruta_id" BIGINT NOT NULL,
  "fecha_salida" DATE NOT NULL DEFAULT CURRENT_DATE,
  "fecha_llegada" DATE,
  "descripcion_carga" TEXT,
  "numeros_guia_remision" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "precio_viaje" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "valor_a_facturar" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "utilidad" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cobrado" BOOLEAN NOT NULL DEFAULT false,
  "fecha_cobro" DATE,
  "soporte_cobro" VARCHAR(80),
  "sin_factura_cobro" BOOLEAN NOT NULL DEFAULT false,
  "pagado_proveedor" BOOLEAN NOT NULL DEFAULT false,
  "fecha_pago_proveedor" DATE,
  "soporte_pago_proveedor" VARCHAR(80),
  "proveedor_sin_factura" BOOLEAN NOT NULL DEFAULT false,
  "estado" "estado_viaje" NOT NULL DEFAULT 'programado',
  "observaciones" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "viajes_proveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proveedores_propietario_id_ruc_cedula_key"
  ON "proveedores"("propietario_id", "ruc_cedula");
CREATE INDEX "proveedores_propietario_id_idx" ON "proveedores"("propietario_id");
CREATE INDEX "idx_proveedores_prop_activo_nombre"
  ON "proveedores"("propietario_id", "activo", "nombre");

CREATE INDEX "viajes_proveedor_propietario_id_fecha_llegada_idx"
  ON "viajes_proveedor"("propietario_id", "fecha_llegada");
CREATE INDEX "viajes_proveedor_propietario_id_fecha_salida_idx"
  ON "viajes_proveedor"("propietario_id", "fecha_salida");
CREATE INDEX "idx_viajes_prov_prop_cliente_llegada"
  ON "viajes_proveedor"("propietario_id", "cliente_id", "fecha_llegada");
CREATE INDEX "idx_viajes_prov_prop_proveedor_llegada"
  ON "viajes_proveedor"("propietario_id", "proveedor_id", "fecha_llegada");
CREATE INDEX "idx_viajes_prov_prop_cobro_llegada"
  ON "viajes_proveedor"("propietario_id", "cobrado", "fecha_llegada");
CREATE INDEX "idx_viajes_prov_prop_pago_llegada"
  ON "viajes_proveedor"("propietario_id", "pagado_proveedor", "fecha_llegada");
CREATE INDEX "viajes_proveedor_tarifa_ruta_id_idx"
  ON "viajes_proveedor"("tarifa_ruta_id");

ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_propietario_id_fkey"
  FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "viajes_proveedor"
  ADD CONSTRAINT "viajes_proveedor_propietario_id_fkey"
  FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "viajes_proveedor"
  ADD CONSTRAINT "viajes_proveedor_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "viajes_proveedor"
  ADD CONSTRAINT "viajes_proveedor_proveedor_id_fkey"
  FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "viajes_proveedor"
  ADD CONSTRAINT "viajes_proveedor_tarifa_ruta_id_fkey"
  FOREIGN KEY ("tarifa_ruta_id") REFERENCES "tarifas_ruta"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
