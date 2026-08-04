import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __testing, summarizeDynamicEvaluationCases } from './asistente.examples.js';

describe('ejemplos controlados del asistente', () => {
  it('convierte una correccion aprobada en un ejemplo anonimizado', () => {
    const example = __testing.buildApprovedExample({
      mensaje_usuario: 'Dame los tres ultimos viajes de Darwin',
      correccion: 'Debia consultar tres viajes del conductor Darwin',
      parametros: { conductor: 'Darwin', limite: '3' }
    });

    assert.equal(example?.herramienta_esperada, 'consultar_viajes');
    assert.match(example?.mensaje_usuario ?? '', /\[CONDUCTOR\]/);
    assert.doesNotMatch(example?.correccion ?? '', /Darwin/i);
  });

  it('consolida nombres historicos de herramientas de lectura', () => {
    assert.equal(
      __testing.consolidatedTool('consultar_viajes_proveedor' as never),
      'consultar_viajes'
    );
    assert.equal(
      __testing.consolidatedTool('consultar_cierre_semanal' as never),
      'analizar_operacion'
    );
  });

  it('convierte los ejemplos activos en casos dinamicos de evaluacion', () => {
    assert.deepEqual(
      summarizeDynamicEvaluationCases([
        {
          mensaje_usuario: 'Muestrame viajes por cobrar',
          herramienta_esperada: 'consultar_viajes'
        },
        {
          mensaje_usuario: 'Muestrame mantenimientos de junio',
          herramienta_esperada: 'analizar_operacion'
        }
      ]),
      {
        total: 2,
        correctos: 1,
        porcentaje_correctos: 50
      }
    );
  });
});
