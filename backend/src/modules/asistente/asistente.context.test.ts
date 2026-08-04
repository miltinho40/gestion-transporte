import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearRequestedConversationFilters,
  commonFiltersFromAnalytics,
  isConversationFollowUp,
  replaceCommonFiltersInAnalytics
} from './asistente.context.js';

describe('contexto conversacional del asistente', () => {
  it('quita un filtro indicado y conserva los demas', () => {
    const result = clearRequestedConversationFilters(
      {
        cliente_id: '10',
        cliente_nombre: 'JIMMY CALDERON',
        vehiculo_id: '20',
        vehiculo_placa: 'OAA1227',
        semana: 22,
        anio: 2026,
        cobrado: false
      },
      'ahora todos los clientes'
    );

    assert.equal(result.cliente_id, undefined);
    assert.equal(result.cliente_nombre, undefined);
    assert.equal(result.vehiculo_placa, 'OAA1227');
    assert.equal(result.semana, 22);
    assert.equal(result.cobrado, false);
  });

  it('limpia todo el contexto cuando el usuario lo pide', () => {
    assert.deepEqual(
      clearRequestedConversationFilters(
        { cliente_id: '10', semana: 22, cobrado: true },
        'limpia todos los filtros'
      ),
      {}
    );
  });

  it('quita el estado de cobro cuando se solicitan ambos estados', () => {
    const result = clearRequestedConversationFilters(
      { semana: 22, anio: 2026, cobrado: true },
      'muestra cobrados y por cobrar'
    );

    assert.equal(result.cobrado, undefined);
    assert.equal(result.semana, 22);
  });

  it('traslada filtros entre consultas de listado y analitica', () => {
    const analytics = replaceCommonFiltersInAnalytics(
      {
        metrica: 'valor_a_facturar',
        agrupar_por: 'vehiculo',
        operacion: 'suma',
        orden: 'desc',
        limite: 5,
        semana: 22,
        anio: 2026,
        cliente_id: '10',
        cliente_nombre: 'CLIENTE ANTERIOR'
      },
      {
        cliente_id: '11',
        cliente_nombre: 'JIMMY CALDERON',
        vehiculo_id: '20',
        vehiculo_placa: 'OAA1227',
        semana: 23,
        anio: 2026,
        cobrado: false
      }
    );

    assert.deepEqual(commonFiltersFromAnalytics(analytics), {
      cliente_id: '11',
      cliente_nombre: 'JIMMY CALDERON',
      vehiculo_id: '20',
      vehiculo_placa: 'OAA1227',
      semana: 23,
      anio: 2026,
      cobrado: false
    });
  });

  it('reconoce continuaciones y deja fuera una consulta de ultimo viaje', () => {
    const context = {
      tipo: 'viajes' as const,
      filtros: { cliente_id: '10', semana: 22, anio: 2026 }
    };

    assert.equal(isConversationFollowUp('ahora semana 23', context), true);
    assert.equal(isConversationFollowUp('solo del oaa1227', context), true);
    assert.equal(isConversationFollowUp('cual fue el ultimo viaje', context), false);
  });
});
