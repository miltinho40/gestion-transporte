ALTER TABLE "facturas_transporte" ADD COLUMN "estado" VARCHAR(20) NOT NULL DEFAULT 'FACTURADA';
ALTER TABLE "facturas_transporte" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "facturas_transporte" ALTER COLUMN "numero" DROP NOT NULL;
ALTER TABLE "facturas_transporte" ADD CONSTRAINT "factura_estado_valido" CHECK ("estado" IN ('PREPARACION', 'FACTURADA'));
ALTER TABLE "facturas_transporte" ADD CONSTRAINT "factura_cerrada_numero" CHECK ("estado" <> 'FACTURADA' OR ("numero" IS NOT NULL AND length(trim("numero")) > 0));
