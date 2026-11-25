import * as cierre from './weekly-closure.helpers';
import { weeklyClosureFixture, weeklyTripFixture } from './weekly-closure.testing';

describe('Resumen compartido de cierre semanal', () => {
  it('suma sueldo y bono, sin descontar otra vez retornos y domingos', () => {
    const data = weeklyClosureFixture();
    expect(cierre.totalSueldoBonos(data)).toBe(190);
    expect(cierre.totalSemanaReporte(data)).toBe(230);
    expect(cierre.gananciaSemanal(data)).toBe(256);
  });

  it('respeta el resultado operativo del backend en semanas generadas', () => {
    const data = weeklyClosureFixture();
    data.resumen.cantidad_gastos_generados = 2;
    data.resumen.totales['resultado_operativo'] = '225.50';
    expect(cierre.gananciaSemanal(data)).toBe(225.5);
  });

  it('usa entrega para domingo y salida solo cuando no hay entrega', () => {
    expect(
      cierre.viajeEntregaDomingo(
        weeklyTripFixture({ fecha_salida: '2026-06-21', fecha_llegada: '2026-06-22' }),
      ),
    ).toBeFalse();
    expect(
      cierre.viajeEntregaDomingo(weeklyTripFixture({ fecha_llegada: '2026-06-21T00:00:00.000Z' })),
    ).toBeTrue();
    expect(
      cierre.viajeEntregaDomingo(
        weeklyTripFixture({ fecha_salida: '2026-06-21', fecha_llegada: null }),
      ),
    ).toBeTrue();
  });

  it('ordena viajes y luego mantenimientos, por fecha en cada grupo', () => {
    const rows = cierre.actividadSemanal(weeklyClosureFixture());
    expect(rows.map((row) => row.sourceId)).toEqual(['10', '11', '20']);
    expect(rows.map((row) => row.fecha)).toEqual(['2026-06-20', '2026-06-21', '2026-06-15']);
    expect(rows[1].rowClass).toBe('weekly-activity-row-cobrado');
    expect(rows[2].rowClass).toBe('weekly-activity-row-mantenimiento');
    expect(rows[0].flete).toBe('400.00');
    expect(rows[0].fleteReal).toBe('368.00');
  });

  it('abrevia guías solo en referencia y mantiene la leyenda completa', () => {
    const row = cierre.actividadSemanal(weeklyClosureFixture())[0];
    expect(row.detalle.split('Guías: ')[1].length).toBe(10);
    expect(row.copyText).toBe('1 viaje a VINCES g#12345, 67890, 54321');
  });

  it('no desplaza fechas UTC un día hacia atrás', () => {
    expect(cierre.dateOnly('2026-06-21T00:00:00.000Z')).toBe('2026-06-21');
  });

  it('solo permite terminar una semana después de su último día', () => {
    jasmine.clock().install();
    try {
      const data = weeklyClosureFixture();
      jasmine.clock().mockDate(new Date(2026, 5, 21, 23, 59));
      expect(cierre.semanaTerminada(data)).toBeFalse();
      jasmine.clock().mockDate(new Date(2026, 5, 22));
      expect(cierre.semanaTerminada(data)).toBeTrue();
      expect(cierre.semanaFutura(data)).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('distingue valores nulos de importes cero y soporta semanas vacías', () => {
    expect(cierre.moneyOrDash(null)).toBe('-');
    expect(cierre.moneyOrDash(0)).toBe('$ 0.00');
    const data = weeklyClosureFixture({ viajes: [], mantenimientos: [], conductores: [] });
    expect(cierre.actividadSemanal(data)).toEqual([]);
    expect(cierre.cantidadDomingos(data)).toBe(0);
    expect(cierre.transportistaLabel(data)).toBe('-');
  });
});
