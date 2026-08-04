import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { contextForNextMessage } from './asistente.memory.js';

describe('memoria del asistente', () => {
  it('guarda el borrador y la accion como contexto', () => {
    const context = contextForNextMessage(
      {
        mensaje: 'Crea un viaje',
        canal: 'web'
      },
      {
        tipo: 'borrador',
        respuesta: 'Borrador preparado',
        draft: {
          tipo: 'viaje',
          titulo: 'Borrador',
          campos: {},
          advertencias: []
        },
        actions: [
          {
            label: 'Guardar viaje',
            route: '/app/reportes',
            query: {},
            operacion: 'guardar'
          }
        ]
      },
      null
    );

    assert.deepEqual(context, {
      draft: {
        tipo: 'viaje',
        titulo: 'Borrador',
        campos: {},
        advertencias: []
      },
      action: {
        label: 'Guardar viaje',
        route: '/app/reportes',
        query: {},
        operacion: 'guardar'
      }
    });
  });

  it('limpia el contexto al cancelar o confirmar', () => {
    assert.equal(
      contextForNextMessage(
        { mensaje: 'Cancelar', canal: 'web' },
        { tipo: 'accion', respuesta: 'Cancelado' },
        { draft: { tipo: 'viaje' } }
      ),
      Prisma.JsonNull
    );
    assert.equal(
      contextForNextMessage(
        {
          mensaje: 'Confirmo',
          canal: 'web',
          contexto: { confirmar: true }
        },
        { tipo: 'accion', respuesta: 'Guardado' },
        { draft: { tipo: 'viaje' } }
      ),
      Prisma.JsonNull
    );
  });

  it('limpia filtros anteriores cuando una consulta cambia de tema', () => {
    assert.equal(
      contextForNextMessage(
        { mensaje: 'Muestra mantenimientos', canal: 'web' },
        { tipo: 'consulta', respuesta: 'Resumen de mantenimientos' },
        {
          consulta: {
            tipo: 'viajes',
            filtros: { cliente_id: '10', semana: 22 }
          }
        }
      ),
      Prisma.JsonNull
    );
  });
});
