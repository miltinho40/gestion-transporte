import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';
process.env.AI_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_MODEL = 'gpt-5.6-luna';
process.env.OPENAI_MIN_CONFIDENCE = '0.55';

const {
  interpretAssistantMessage,
  interpretAssistantMessageWithClient,
  __testing
} = await import('./asistente.interpreter.js');

const propietario = {
  usuario_id: '10',
  propietario_id: '20',
  es_propietario: true,
  es_intermediario: false
};

afterEach(() => {
  __testing.setOpenAIClient(undefined);
});

describe('interprete hibrido del asistente', () => {
  it('calcula hoy en la zona horaria de Ecuador', () => {
    assert.equal(
      __testing.dateInEcuador(new Date('2026-07-31T03:00:00.000Z')),
      '2026-07-30'
    );
  });

  it('acepta una interpretacion estructurada y conserva los valores', async () => {
    const interpretation = await interpretAssistantMessageWithClient(
      propietario,
      {
        mensaje: 'Ahora muestrame de la semana 23',
        canal: 'web',
        contexto: {
          consulta: {
            tipo: 'viajes',
            filtros: {
              cliente: 'JIMMY CALDERON',
              semana: 22
            }
          }
        }
      },
      {
        responses: {
          create: async () => ({
            id: 'resp_test',
            model: 'gpt-5.6-luna',
            usage: {
              input_tokens: 120,
              output_tokens: 30,
              total_tokens: 150
            },
            output_text: JSON.stringify({
              tool: 'consultar_viajes',
              canonical_message:
                'Muestrame los viajes de JIMMY CALDERON de la semana 23',
              confidence: 0.96,
              parameters: [
                { name: 'cliente', value: 'JIMMY CALDERON' },
                { name: 'semana', value: '23' }
              ]
            })
          })
        }
      }
    );

    assert.equal(interpretation.provider, 'openai');
    assert.equal(interpretation.tool.name, 'consultar_viajes');
    assert.match(interpretation.message, /JIMMY CALDERON.*23/);
    assert.equal(interpretation.parameters?.cliente, 'JIMMY CALDERON');
    assert.equal(interpretation.parameters?.semana, '23');
    assert.equal(interpretation.responseId, 'resp_test');
    assert.equal(interpretation.usage?.totalTokens, 150);
  });

  it('usa reglas cuando la confianza del modelo es baja', async () => {
    const interpretation = await interpretAssistantMessageWithClient(
      propietario,
      {
        mensaje: 'Muestrame viajes por cobrar',
        canal: 'web'
      },
      {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              tool: 'consultar_viajes',
              canonical_message: 'Muestrame viajes',
              confidence: 0.2
            })
          })
        }
      }
    );

    assert.equal(interpretation.provider, 'rules');
    assert.equal(interpretation.tool.name, 'consultar_viajes_pendientes');
    assert.equal(interpretation.fallbackReason, 'confianza_baja');
  });

  it('rechaza una herramienta que el rol no tiene disponible', async () => {
    const interpretation = await interpretAssistantMessageWithClient(
      {
        usuario_id: '30',
        propietario_id: '40',
        es_propietario: false,
        es_intermediario: true
      },
      {
        mensaje: 'Muestrame viajes de proveedores',
        canal: 'web'
      },
      {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              tool: 'consultar_viajes',
              canonical_message: 'Muestrame viajes propios',
              confidence: 0.99
            })
          })
        }
      }
    );

    assert.equal(interpretation.provider, 'rules');
    assert.equal(interpretation.tool.name, 'consultar_viajes_proveedor');
    assert.equal(interpretation.fallbackReason, 'herramienta_no_permitida');
  });

  it('no envia identificadores internos sin anonimizar al modelo', async () => {
    let requestText = '';

    await interpretAssistantMessageWithClient(
      {
        usuario_id: '123456789',
        propietario_id: '987654321',
        es_propietario: true
      },
      {
        mensaje: 'Muestrame viajes',
        canal: 'movil'
      },
      {
        responses: {
          create: async (params) => {
            requestText = JSON.stringify(params);
            return {
              output_text: JSON.stringify({
                tool: 'consultar_viajes',
                canonical_message: 'Muestrame viajes',
                confidence: 0.9
              })
            };
          }
        }
      }
    );

    assert.doesNotMatch(requestText, /123456789|987654321/);
  });

  it('no consulta al modelo al confirmar un borrador', async () => {
    let calls = 0;
    __testing.setOpenAIClient({
      responses: {
        create: async () => {
          calls += 1;
          throw new Error('No debe llamarse');
        }
      }
    });

    const interpretation = await interpretAssistantMessage(propietario, {
      mensaje: 'Confirmo guardar',
      canal: 'web',
      contexto: {
        confirmar: true,
        draft: {
          tipo: 'viaje',
          titulo: 'Borrador',
          campos: {},
          advertencias: []
        },
        action: {
          label: 'Guardar viaje',
          route: '/app/viajes',
          query: {},
          operacion: 'guardar'
        }
      }
    });

    assert.equal(calls, 0);
    assert.equal(interpretation.provider, 'rules');
    assert.equal(interpretation.tool.name, 'aplicar_borrador');
  });

  it('continua con reglas si el proveedor no esta disponible', async () => {
    __testing.setOpenAIClient({
      responses: {
        create: async () => {
          throw new Error('Servicio temporalmente no disponible');
        }
      }
    });

    const interpretation = await interpretAssistantMessage(propietario, {
      mensaje: 'Muestrame viajes por cobrar',
      canal: 'web'
    });

    assert.equal(interpretation.provider, 'rules');
    assert.equal(interpretation.tool.name, 'consultar_viajes_pendientes');
    assert.equal(
      interpretation.fallbackReason,
      'servicio_openai_no_disponible'
    );
  });
});
