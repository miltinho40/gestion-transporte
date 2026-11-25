-- Client.porcentaje_comision is the sole default percentage for both roles.
-- Invoice and invoice-line percentages are historical snapshots and remain unchanged.
ALTER TABLE "configuracion_facturacion"
  DROP COLUMN "comision_cliente",
  DROP COLUMN "comision_empresa";
