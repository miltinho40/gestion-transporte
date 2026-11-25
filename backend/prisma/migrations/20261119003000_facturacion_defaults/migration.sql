ALTER TABLE "detalles_facturas_transporte" DROP CONSTRAINT "detalles_facturas_transporte_viaje_id_fkey";
ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalles_facturas_transporte_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "detalles_facturas_transporte" DROP CONSTRAINT "detalles_facturas_transporte_viaje_proveedor_id_fkey";
ALTER TABLE "detalles_facturas_transporte" ADD CONSTRAINT "detalles_facturas_transporte_viaje_proveedor_id_fkey" FOREIGN KEY ("viaje_proveedor_id") REFERENCES "viajes_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "configuracion_facturacion" ("propietario_id", "cliente_id", "destinatario_id", "comision_cliente", "ir_cliente", "comision_empresa", "ir_empresa")
SELECT c.propietario_id, c.id,
  CASE WHEN upper(c.nombre) LIKE 'TRASOSA%' OR upper(c.nombre) LIKE 'TRANSPALFRA%' THEN NULL
    ELSE (SELECT t.id FROM clientes t WHERE t.propietario_id = c.propietario_id AND upper(t.nombre) LIKE 'TRASOSA%' AND t.activo = true ORDER BY t.id LIMIT 1) END,
  CASE WHEN upper(c.nombre) LIKE 'JIMMY%CALDER%' THEN 3 ELSE 0 END,
  upper(c.nombre) LIKE 'FRUTARICA%',
  CASE WHEN upper(c.nombre) LIKE 'TRASOSA%' THEN 2 WHEN upper(c.nombre) LIKE 'TRANSPALFRA%' THEN 8 ELSE 0 END,
  true
FROM clientes c
WHERE upper(c.nombre) LIKE 'TRASOSA%' OR upper(c.nombre) LIKE 'TRANSPALFRA%' OR upper(c.nombre) LIKE 'JIMMY%CALDER%' OR upper(c.nombre) LIKE 'FRUTARICA%' OR upper(c.nombre) LIKE 'COMERSUR%'
ON CONFLICT (cliente_id) DO NOTHING;
