import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EstadoConductor,
  EstadoVehiculo,
  EstadoViaje,
  Prisma
} from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

const {
  __testing,
  calculateBonificacion,
  calculatePagoSemanalConductor,
  getIsoWeekRange
} = await import(
  './cierres-semanales.service.js'
);

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const decimal = (value: number | string) => new Prisma.Decimal(value);
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const bonusConfig = {
  bonificacion_flete_monto_minimo: new Prisma.Decimal(1200),
  bonificacion_flete_monto_tramo: new Prisma.Decimal(100),
  bonificacion_flete_valor_tramo: new Prisma.Decimal(5),
  bonificacion_flete_monto_maximo: new Prisma.Decimal(0)
};

const mockViaje = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 10n,
    propietario_id: 1n,
    cliente_id: 20n,
    vehiculo_id: 30n,
    conductor_id: 40n,
    tarifa_ruta_id: 50n,
    fecha_salida: utcDate('2026-06-20'),
    fecha_llegada: utcDate('2026-06-21'),
    descripcion_carga: 'BANANO',
    peso_carga_kg: null,
    numeros_guia_remision: ['230055', '8229'],
    precio_flete: decimal('400.00'),
    porcentaje_comision_aplicado: decimal('10.00'),
    valor_comision: decimal('40.00'),
    precio_real_flete: decimal('360.00'),
    galones_diesel: decimal('0.00'),
    costo_diesel: decimal('0.00'),
    costo_peajes: decimal('0.00'),
    costo_estimado_gastos: decimal('0.00'),
    viaticos: decimal('36.00'),
    costo_real_gastos: decimal('76.00'),
    cobrado: false,
    retorno: true,
    fecha_cobro: null,
    estado: EstadoViaje.PROGRAMADO,
    observaciones: null,
    created_at: utcDate('2026-06-20'),
    updated_at: utcDate('2026-06-20'),
    cliente: {
      id: 20n,
      nombre: 'TRANSGUABE',
      ruc_cedula: '0999999999'
    },
    vehiculo: {
      id: 30n,
      placa: 'OAA1227',
      marca: 'JAC',
      modelo: '1134',
      estado: EstadoVehiculo.DISPONIBLE
    },
    conductor: {
      id: 40n,
      nombre: 'HAROLD ROMERO',
      cedula: '0700000000',
      sueldo_semanal: decimal('190.00'),
      estado: EstadoConductor.ACTIVO
    },
    tarifa_ruta: {
      ruta: {
        id: 60n,
        origen: 'BUENA FE',
        destino: 'YILPORT'
      },
      tipo_carga: {
        id: 70n,
        nombre: 'CAJA'
      }
    },
    gastos_viaje: [
      {
        id: 80n,
        viaje_id: 10n,
        tipo_gasto_id: 90n,
        descripcion: null,
        monto: decimal('40.00'),
        fecha_gasto: utcDate('2026-06-21'),
        es_estimado: false,
        created_at: utcDate('2026-06-21'),
        updated_at: utcDate('2026-06-21'),
        tipo_gasto: {
          id: 90n,
          nombre: 'RETORNO',
          descripcion: null,
          activo: true,
          created_at: utcDate('2026-06-21'),
          updated_at: utcDate('2026-06-21')
        }
      },
      {
        id: 81n,
        viaje_id: 10n,
        tipo_gasto_id: 91n,
        descripcion: null,
        monto: decimal('15.00'),
        fecha_gasto: utcDate('2026-06-21'),
        es_estimado: false,
        created_at: utcDate('2026-06-21'),
        updated_at: utcDate('2026-06-21'),
        tipo_gasto: {
          id: 91n,
          nombre: 'VARIOS',
          descripcion: null,
          activo: true,
          created_at: utcDate('2026-06-21'),
          updated_at: utcDate('2026-06-21')
        }
      }
    ],
    ...overrides
  }) as never;

describe('cierres semanales', () => {
  it('calcula el pago semanal con sueldo, bono, retornos y domingos', () => {
    const total = calculatePagoSemanalConductor({
      sueldo: decimal('190.00'),
      bono: decimal('40.00'),
      retornos: decimal('70.00'),
      domingos: decimal('20.00')
    });

    assert.equal(total.toFixed(2), '320.00');
  });

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

  it('considera fecha de entrega para ubicar un viaje en la semana', () => {
    const salida = utcDate('2026-06-20');
    const llegada = utcDate('2026-06-21');

    assert.equal(__testing.viajeFechaEntrega({ fecha_salida: salida, fecha_llegada: llegada }), llegada);
    assert.equal(__testing.viajeFechaEntrega({ fecha_salida: salida, fecha_llegada: null }), salida);

    const where = __testing.buildViajeSemanaWhere(utcDate('2026-06-15'), utcDate('2026-06-21'));

    assert.deepEqual(where, {
      OR: [
        {
          fecha_llegada: {
            gte: utcDate('2026-06-15'),
            lte: utcDate('2026-06-21')
          }
        },
        {
          fecha_llegada: null,
          fecha_salida: {
            gte: utcDate('2026-06-15'),
            lte: utcDate('2026-06-21')
          }
        }
      ]
    });
  });

  it('suma solo gastos tipo RETORNO y calcula utilidad con costo real', () => {
    const viaje = mockViaje();
    const formatted = __testing.formatViajeCierre(viaje, 25);
    const totales = __testing.createTotalesViajes();

    __testing.addViajeToTotales(totales, viaje);

    assert.equal(formatted.retorno_gastos_viaje.toFixed(2), '40.00');
    assert.equal(formatted.utilidad.toFixed(2), '284.00');
    assert.equal(totales.precio_flete.toFixed(2), '400.00');
    assert.equal(totales.precio_real_flete.toFixed(2), '360.00');
    assert.equal(totales.costo_real_gastos.toFixed(2), '76.00');
    assert.equal(totales.utilidad.toFixed(2), '284.00');
  });

  it('detecta diferencias cuando cambia un mantenimiento o la ganancia semanal', () => {
    const stored = {
      cantidad_viajes: 2,
      cantidad_mantenimientos: 0,
      cantidad_gastos_semanales: 2,
      total_precio_flete: decimal('800.00'),
      total_precio_real_flete: decimal('720.00'),
      total_utilidad: decimal('560.00'),
      total_mantenimientos: decimal('0.00'),
      total_gastos_semanales: decimal('230.00'),
      total_sueldos: decimal('190.00'),
      total_bonificaciones: decimal('40.00'),
      resultado_operativo: decimal('330.00')
    } as never;
    const current = {
      cantidad_viajes: 2,
      cantidad_mantenimientos: 1,
      cantidad_gastos_semanales: 2,
      total_precio_flete: decimal('800.00'),
      total_precio_real_flete: decimal('720.00'),
      total_utilidad: decimal('560.00'),
      total_mantenimientos: decimal('120.00'),
      total_gastos_semanales: decimal('230.00'),
      total_sueldos: decimal('190.00'),
      total_bonificaciones: decimal('40.00'),
      resultado_operativo: decimal('210.00')
    };

    const diferencias = __testing.buildCierreDiferencias(stored, current);

    assert.deepEqual(
      diferencias.map((item) => item.campo),
      ['cantidad_mantenimientos', 'total_mantenimientos', 'resultado_operativo']
    );
    assert.deepEqual(
      diferencias.map((item) => item.label),
      ['Mantenimientos', 'Mantenimientos', 'Ganancia semanal']
    );
  });
});
