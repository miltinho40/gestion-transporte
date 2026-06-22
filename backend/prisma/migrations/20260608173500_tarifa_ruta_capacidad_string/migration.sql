ALTER TABLE "tarifas_ruta"
ALTER COLUMN "capacidad" TYPE VARCHAR(50)
USING "capacidad"::TEXT;
