ALTER TABLE "proveedores"
  ADD COLUMN "porcentaje_utilidad" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "viajes_proveedor"
  ADD COLUMN "precio_pagar_proveedor" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "viaticos" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "viajes_proveedor"
SET "precio_pagar_proveedor" = "precio_viaje",
    "utilidad" = "valor_a_facturar" - "precio_viaje";
