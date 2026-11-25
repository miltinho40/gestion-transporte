CREATE UNIQUE INDEX "configuracion_facturacion_cliente_id_key" ON "configuracion_facturacion"("cliente_id");

CREATE INDEX "configuracion_facturacion_propietario_id_idx" ON "configuracion_facturacion"("propietario_id");

CREATE INDEX "facturas_transporte_propietario_id_fecha_idx" ON "facturas_transporte"("propietario_id", "fecha");

CREATE UNIQUE INDEX "facturas_transporte_propietario_id_numero_key" ON "facturas_transporte"("propietario_id", "numero");

CREATE UNIQUE INDEX "detalles_facturas_transporte_viaje_id_key" ON "detalles_facturas_transporte"("viaje_id");

CREATE UNIQUE INDEX "detalles_facturas_transporte_viaje_proveedor_id_key" ON "detalles_facturas_transporte"("viaje_proveedor_id");

CREATE INDEX "detalles_facturas_transporte_factura_id_idx" ON "detalles_facturas_transporte"("factura_id");

CREATE INDEX "abonos_facturas_transporte_factura_id_idx" ON "abonos_facturas_transporte"("factura_id");

ALTER TABLE "facturas_transporte" ADD CONSTRAINT "factura_neto_no_negativo" CHECK ("neto" >= 0);

