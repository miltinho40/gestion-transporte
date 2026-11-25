ALTER TABLE "configuracion_facturacion"
  ADD COLUMN "modalidad_comision" VARCHAR(20) NOT NULL DEFAULT 'AL_PAGAR',
  ADD CONSTRAINT "configuracion_modalidad_comision_check" CHECK ("modalidad_comision" IN ('AL_PAGAR', 'EN_FACTURA'));
ALTER TABLE "facturas_transporte"
  ADD COLUMN "modalidad_comision" VARCHAR(20) NOT NULL DEFAULT 'AL_PAGAR',
  ADD CONSTRAINT "facturas_modalidad_comision_check" CHECK ("modalidad_comision" IN ('AL_PAGAR', 'EN_FACTURA'));

-- Configure future TRANSPALFRA invoices without changing any existing invoice.
UPDATE "configuracion_facturacion" f SET "modalidad_comision" = 'EN_FACTURA'
FROM "clientes" c WHERE c.id = f.cliente_id AND upper(c.nombre) LIKE 'TRANSPALFRA%';
