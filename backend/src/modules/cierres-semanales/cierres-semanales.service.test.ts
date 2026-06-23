import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

const { calculateBonificacion, getIsoWeekRange } = await import(
  './cierres-semanales.service.js'
);

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

const bonusConfig = {
  bonificacion_flete_monto_minimo: new Prisma.Decimal(1200),
  bonificacion_flete_monto_tramo: new Prisma.Decimal(100),
  bonificacion_flete_valor_tramo: new Prisma.Decimal(5),
  bonificacion_flete_monto_maximo: new Prisma.Decimal(0)
};

describe('cierres semanales', () => {
  it('calcula rangos ISO de lunes a domingo', () => {
    const week25 = getIsoWeekRange(2026, 25);

    assert.equal(dateOnly(week25.fechaInicio), '2026-06-15');
    assert.equal(dateOnly(week25.fechaFin), '2026-06-21');

    const week1 = getIsoWeekRange(2026, 1);

    assert.equal(dateOnly(week1.fechaInicio), '2025-12-29');
    assert.equal(dateOnly(week1.fechaFin), '2026-01-04');
  });

  it('calcula la bonificacion por tramos sobre el minimo', () => {
    assert.equal(calculateBonificacion(new Prisma.Decimal(1200), bonusConfig).toFixed(2), '0.00');
    assert.equal(calculateBonificacion(new Prisma.Decimal(1201), bonusConfig).toFixed(2), '5.00');
    assert.equal(calculateBonificacion(new Prisma.Decimal(1450), bonusConfig).toFixed(2), '15.00');
  });

  it('respeta el maximo configurado de bonificacion', () => {
    const config = {
      ...bonusConfig,
      bonificacion_flete_monto_maximo: new Prisma.Decimal(12)
    };

    assert.equal(calculateBonificacion(new Prisma.Decimal(2000), config).toFixed(2), '12.00');
  });
});
