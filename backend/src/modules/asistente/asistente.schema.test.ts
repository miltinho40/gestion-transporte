import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asistenteEvaluacionSchema, asistenteMensajeSchema } from './asistente.schema.js';

describe('evaluacion del asistente', () => {
  it('acepta una respuesta correcta sin correccion', () => {
    assert.deepEqual(asistenteEvaluacionSchema.parse({ calificacion: 'correcta' }), {
      calificacion: 'correcta'
    });
  });

  it('normaliza la correccion de una respuesta incorrecta', () => {
    assert.deepEqual(
      asistenteEvaluacionSchema.parse({
        calificacion: 'incorrecta',
        correccion: '  Debia buscar por conductor.  '
      }),
      {
        calificacion: 'incorrecta',
        correccion: 'Debia buscar por conductor.'
      }
    );
  });

  it('rechaza calificaciones desconocidas', () => {
    assert.throws(() => asistenteEvaluacionSchema.parse({ calificacion: 'regular' }));
  });
});

describe('contexto de viajes de proveedores', () => {
  it('acepta filtros de cobro y pago independientes', () => {
    const parsed = asistenteMensajeSchema.parse({
      mensaje: 'Ahora solo los pagados',
      canal: 'web',
      contexto: {
        consulta: {
          tipo: 'viajes_proveedor',
          filtros: {
            semana: 26,
            cobrado: false,
            pagado_proveedor: true
          }
        }
      }
    });

    assert.equal(parsed.contexto?.consulta?.tipo, 'viajes_proveedor');
    assert.equal(parsed.contexto?.consulta?.filtros['pagado_proveedor'], true);
  });
});
