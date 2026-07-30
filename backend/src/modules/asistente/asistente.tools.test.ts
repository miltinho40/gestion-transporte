import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../utils/app-error.js';
import {
  assistantToolCatalog,
  assertAssistantToolAllowed,
  selectAssistantTool
} from './asistente.tools.js';

describe('herramientas del asistente', () => {
  it('clasifica consultas y preparacion de registros', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: 'Muéstrame viajes por cobrar',
        canal: 'web'
      }).name,
      'consultar_viajes_pendientes'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un mantenimiento de aceite',
        canal: 'web'
      }).name,
      'preparar_mantenimiento'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un viaje a Vinces',
        canal: 'movil'
      }).name,
      'preparar_viaje'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Puedes abrir el modal de un nuevo viaje',
        canal: 'web'
      }).name,
      'abrir_formulario'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Abre el formulario para un nuevo cliente',
        canal: 'web'
      }).name,
      'abrir_formulario'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un cliente llamado ACME con RUC 0999999999001',
        canal: 'web'
      }).name,
      'preparar_cliente'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un vehículo OAA1234 marca JAC',
        canal: 'web'
      }).name,
      'preparar_vehiculo'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un conductor llamado Juan Pérez',
        canal: 'web'
      }).name,
      'preparar_conductor'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: '¿Cuál vehículo facturó más en la semana 26?',
        canal: 'web'
      }).name,
      'analizar_operacion'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Cuanto gano Harold en la semana 26?',
        canal: 'web'
      }).name,
      'analizar_operacion'
    );
  });

  it('mantiene el contexto de una consulta analitica', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: 'Ahora muéstrame la semana 27',
        canal: 'web',
        contexto: {
          consulta: {
            tipo: 'analitica_viajes',
            filtros: {
              metrica: 'valor_a_facturar',
              agrupar_por: 'vehiculo',
              operacion: 'suma',
              orden: 'desc',
              limite: 1,
              semana: 26,
              anio: 2026
            }
          }
        }
      }).name,
      'analizar_operacion'
    );
  });

  it('clasifica la memoria controlada y su confirmacion', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: 'Recuerda que mi camion es OAA1227',
        canal: 'web'
      }).name,
      'preparar_preferencia'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Que recuerdas de mi',
        canal: 'web'
      }).name,
      'consultar_preferencias'
    );
    assert.equal(
      selectAssistantTool({
        mensaje: 'Confirmo guardar la preferencia',
        canal: 'web',
        contexto: {
          confirmar: true,
          draft: {
            tipo: 'preferencia',
            titulo: 'Nueva preferencia',
            campos: { alias: 'mi camion' },
            advertencias: []
          },
          action: {
            label: 'Guardar preferencia',
            route: '/assistant/preferences',
            query: {
              preference_action: 'upsert'
            },
            operacion: 'guardar'
          }
        }
      }).name,
      'aplicar_preferencia'
    );
  });

  it('permite salir del contexto analitico con una orden explicita', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: 'Crea un viaje nuevo',
        canal: 'web',
        contexto: {
          consulta: {
            tipo: 'analitica_viajes',
            filtros: {
              metrica: 'valor_a_facturar',
              agrupar_por: 'vehiculo',
              semana: 26,
              anio: 2026
            }
          }
        }
      }).name,
      'preparar_viaje'
    );
  });

  it('mantiene la herramienta de cliente durante la conversacion', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: '0999999999001',
        canal: 'web',
        contexto: {
          draft: {
            tipo: 'cliente',
            titulo: 'Borrador',
            campos: { nombre: 'ACME', ruc_cedula: 'Por confirmar' },
            advertencias: []
          },
          action: {
            label: 'Guardar cliente',
            route: '/app/clientes',
            query: { nombre: 'ACME' }
          }
        }
      }).name,
      'preparar_cliente'
    );
  });

  it('mantiene la herramienta de vehiculo durante la conversacion', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: 'JAC',
        canal: 'web',
        contexto: {
          draft: {
            tipo: 'vehiculo',
            titulo: 'Borrador',
            campos: { placa: 'OAA1234', marca: 'Por confirmar' },
            advertencias: []
          },
          action: {
            label: 'Guardar vehículo',
            route: '/app/vehiculos',
            query: { placa: 'OAA1234' }
          }
        }
      }).name,
      'preparar_vehiculo'
    );
  });

  it('mantiene la herramienta de conductor durante la conversacion', () => {
    assert.equal(
      selectAssistantTool({
        mensaje: '0999999999',
        canal: 'web',
        contexto: {
          draft: {
            tipo: 'conductor',
            titulo: 'Borrador',
            campos: { nombre: 'JUAN PEREZ', cedula: 'Por confirmar' },
            advertencias: []
          },
          action: {
            label: 'Guardar conductor',
            route: '/app/conductores',
            query: { nombre: 'JUAN PEREZ' }
          }
        }
      }).name,
      'preparar_conductor'
    );
  });

  it('clasifica una confirmacion como escritura', () => {
    const tool = selectAssistantTool({
      mensaje: 'Confirmo guardar el viaje',
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

    assert.equal(tool.name, 'aplicar_borrador');
    assert.equal(tool.requiresConfirmation, true);
  });

  it('rechaza escrituras sin confirmacion', () => {
    assert.throws(
      () =>
        assertAssistantToolAllowed(
          {
            name: 'aplicar_borrador',
            category: 'escritura',
            requiresConfirmation: true,
            scope: 'propietario'
          },
          {
            usuario_id: '10',
            propietario_id: '20',
            es_propietario: true
          },
          false
        ),
      (error) => error instanceof AppError && error.statusCode === 400
    );
  });

  it('impide herramientas de flota a un intermediario sin flota', () => {
    const tool = selectAssistantTool({
      mensaje: 'Muéstrame viajes de la semana 23',
      canal: 'web'
    });

    assert.throws(
      () =>
        assertAssistantToolAllowed(
          tool,
          {
            usuario_id: '10',
            propietario_id: '20',
            es_propietario: false,
            es_intermediario: true
          },
          false
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    );
  });

  it('permite consultas de proveedores al intermediario', () => {
    const tool = selectAssistantTool({
      mensaje: 'Muéstrame viajes de proveedores pendientes',
      canal: 'web'
    });

    assert.doesNotThrow(() =>
      assertAssistantToolAllowed(
        tool,
        {
          usuario_id: '10',
          propietario_id: '20',
          es_propietario: false,
          es_intermediario: true
        },
        false
      )
    );
  });

  it('permite memoria personal al intermediario sin flota', () => {
    assert.doesNotThrow(() =>
      assertAssistantToolAllowed(
        assistantToolCatalog.aplicar_preferencia,
        {
          usuario_id: '10',
          propietario_id: '20',
          rol: 'consulta',
          es_propietario: false,
          es_intermediario: true
        },
        true
      )
    );
  });
});
