CREATE TABLE "configuracion_facturacion" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "cliente_id" BIGINT NOT NULL,
    "destinatario_id" BIGINT,
    "comision_cliente" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ir_cliente" BOOLEAN NOT NULL DEFAULT false,
    "comision_empresa" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ir_empresa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "configuracion_facturacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "facturas_transporte" (
    "id" BIGSERIAL NOT NULL,
    "propietario_id" BIGINT NOT NULL,
    "destinatario_id" BIGINT NOT NULL,
    "numero" VARCHAR(80) NOT NULL,
    "fecha" DATE NOT NULL,
    "comision_empresa" DECIMAL(5,2) NOT NULL,
    "ir_empresa" BOOLEAN NOT NULL,
    "total_facturar" DECIMAL(12,2) NOT NULL,
    "total_comision" DECIMAL(12,2) NOT NULL,
    "total_ir" DECIMAL(12,2) NOT NULL,
    "neto" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_transporte_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "detalles_facturas_transporte" (
    "id" BIGSERIAL NOT NULL,
    "factura_id" BIGINT NOT NULL,
    "viaje_id" BIGINT,
    "viaje_proveedor_id" BIGINT,
    "cliente_nombre" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "comision_cliente" DECIMAL(5,2) NOT NULL,
    "ir_cliente" BOOLEAN NOT NULL,
    "monto_comision_cliente" DECIMAL(12,2) NOT NULL,
    "monto_ir_cliente" DECIMAL(12,2) NOT NULL,
    "a_facturar" DECIMAL(12,2) NOT NULL,
    "comision_empresa" DECIMAL(12,2) NOT NULL,
    "ir_empresa" DECIMAL(12,2) NOT NULL,
    "neto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalles_facturas_transporte_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "abonos_facturas_transporte" (
    "id" BIGSERIAL NOT NULL,
    "factura_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "soporte" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonos_facturas_transporte_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "configuracion_facturacion" ADD CONSTRAINT "configuracion_facturacion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "configuracion_facturacion" ADD CONSTRAINT "configuracion_facturacion_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "facturas_transporte" ADD CONSTRAINT "facturas_transporte_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalles_facturas_transporte_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas_transporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalles_facturas_transporte_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalles_facturas_transporte_viaje_proveedor_id_fkey" FOREIGN KEY ("viaje_proveedor_id") REFERENCES "viajes_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "abonos_facturas_transporte" ADD CONSTRAINT "abonos_facturas_transporte_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas_transporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalle_un_viaje" CHECK (("viaje_id" IS NOT NULL)::int + ("viaje_proveedor_id" IS NOT NULL)::int = 1);
ALTER TABLE "abonos_facturas_transporte" ADD CONSTRAINT "abono_positivo" CHECK ("monto" > 0);

