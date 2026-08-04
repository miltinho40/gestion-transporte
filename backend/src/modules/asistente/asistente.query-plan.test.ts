import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOperationalQueryPlan } from './asistente.query-plan.js';

describe('plan estructurado de consultas operativas', () => {
  it('planifica una lista reciente de viajes propios', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_viajes',
      message: 'Dame los tres ultimos viajes de Darwin',
      parameters: { conductor: 'Darwin', limite: '3', origen_viajes: 'propios' }
    });

    assert.deepEqual(plan, {
      fuente: 'viajes_propios',
      modo: 'listado',
      limite: 3,
      orden: { campo: 'fecha', direccion: 'desc' },
      periodo: 'todo'
    });
  });

  it('distingue viajes de proveedores y el menor valor', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_viajes',
      message: 'Muestra los 5 viajes de proveedores con menor valor a facturar',
      parameters: {
        origen_viajes: 'proveedores',
        limite: '5',
        metrica: 'valor_a_facturar',
        operacion: 'minimo'
      }
    });

    assert.equal(plan.fuente, 'viajes_proveedores');
    assert.equal(plan.limite, 5);
    assert.equal(plan.orden.campo, 'valor_a_facturar');
    assert.equal(plan.orden.direccion, 'asc');
    assert.equal(plan.agregacion?.operacion, 'minimo');
  });

  it('planifica mantenimientos agrupados por tipo', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_mantenimientos',
      message: 'Total de mantenimientos por tipo en la semana 26',
      parameters: {
        semana: '26',
        operacion: 'suma',
        agrupar_por: 'tipo_mantenimiento',
        metrica: 'costo'
      }
    });

    assert.equal(plan.fuente, 'mantenimientos');
    assert.equal(plan.modo, 'agrupado');
    assert.equal(plan.periodo, 'explicito');
    assert.equal(plan.agregacion?.agrupar_por, 'tipo_mantenimiento');
  });

  it('conserva el origen anterior en una continuacion', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_viajes',
      message: 'Ahora los de la semana 23',
      parameters: { semana: '23' },
      previousSource: 'viajes_proveedores'
    });

    assert.equal(plan.fuente, 'viajes_proveedores');
    assert.equal(plan.periodo, 'explicito');
  });

  it('consulta todos los pendientes si no se indica periodo', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_viajes',
      message: 'Muestra mis viajes pendientes de cobro',
      parameters: { estado_cobro: 'por cobrar' }
    });

    assert.equal(plan.periodo, 'todo');
  });

  it('prioriza una semana explicita sobre la palabra ultimos', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'consultar_viajes',
      message: 'Los cinco ultimos viajes de la semana 22',
      parameters: { limite: '5', semana: '22' }
    });

    assert.equal(plan.periodo, 'explicito');
    assert.equal(plan.limite, 5);
  });

  it('detecta una comparacion entre dos semanas', () => {
    const plan = buildOperationalQueryPlan({
      tool: 'analizar_operacion',
      message: 'Compara las semanas 25 y 26 de 2026',
      parameters: { anio: '2026', metrica: 'valor_a_facturar' }
    });

    assert.deepEqual(plan.comparar_semanas, [25, 26]);
  });
});
