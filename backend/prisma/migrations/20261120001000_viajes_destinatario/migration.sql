ALTER TABLE viajes ADD COLUMN facturar_a_id BIGINT REFERENCES clientes(id) ON DELETE RESTRICT;
ALTER TABLE viajes_proveedor ADD COLUMN facturar_a_id BIGINT REFERENCES clientes(id) ON DELETE RESTRICT;
CREATE INDEX viajes_facturar_a_idx ON viajes(propietario_id,facturar_a_id);
CREATE INDEX viajes_proveedor_facturar_a_idx ON viajes_proveedor(propietario_id,facturar_a_id);
