ALTER TABLE "viajes"
  ADD COLUMN "viaticos" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "viajes"
SET "viaticos" = COALESCE("costo_real_gastos", 0);

UPDATE "viajes" AS v
SET "costo_real_gastos" =
  COALESCE(v."viaticos", 0) +
  COALESCE((
    SELECT SUM(g."monto")
    FROM "gastos_viaje" AS g
    WHERE g."viaje_id" = v."id"
      AND g."es_estimado" = false
  ), 0);
