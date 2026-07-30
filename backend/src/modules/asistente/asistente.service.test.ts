import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

const { __testing } = await import('./asistente.service.js');

describe('asistente', () => {
  it('construye y continua un plan analitico', () => {
    const first = __testing.parseAnalyticsPlan(
      'Cuál vehículo facturó más en la semana 26 de 2026',
      __testing.normalizeText('Cuál vehículo facturó más en la semana 26 de 2026')
    );
    assert.deepEqual(first, {
      metrica: 'valor_a_facturar',
      agrupar_por: 'vehiculo',
      operacion: 'suma',
      orden: 'desc',
      limite: 1,
      semana: 26,
      anio: 2026
    });

    const next = __testing.parseAnalyticsPlan(
      'Ahora la semana 27, solo cobrados',
      __testing.normalizeText('Ahora la semana 27, solo cobrados'),
      {},
      first
    );
    assert.equal(next.semana, 27);
    assert.equal(next.cobrado, true);
    assert.equal(next.metrica, 'valor_a_facturar');
    assert.equal(next.agrupar_por, 'vehiculo');
  });

  it('interpreta cuanto gano un conductor como pago semanal', () => {
    const plan = __testing.parseAnalyticsPlan(
      'Cuanto gano Harold en la semana 26 de 2026',
      __testing.normalizeText('Cuanto gano Harold en la semana 26 de 2026'),
      { conductor: 'Harold' }
    );

    assert.equal(plan.metrica, 'pago_conductor');
    assert.equal(plan.agrupar_por, 'conductor');
    assert.equal(plan.semana, 26);
    assert.equal(plan.anio, 2026);
  });

  it('extrae los datos principales de un conductor', () => {
    assert.deepEqual(
      __testing.extractConductorFields(
        'Crea un conductor Juan Pérez cédula 0999999999 teléfono 0981234567 licencia LIC123 vence 31/12/2028 sueldo 180'
      ),
      {
        nombre: 'Juan Pérez',
        cedula: '0999999999',
        telefono: '0981234567',
        numero_licencia: 'LIC123',
        fecha_caducidad_licencia: '2028-12-31',
        sueldo_semanal: '180'
      }
    );
    assert.deepEqual(
      __testing.extractConductorFields('0999999999', {}, 'cédula'),
      { cedula: '0999999999' }
    );
  });

  it('extrae los datos principales de un vehiculo', () => {
    assert.deepEqual(
      __testing.extractVehicleFields(
        'Crea un vehículo OAA1234 marca JAC modelo 1134 capacidad 7000 8 toneladas rendimiento 16'
      ),
      {
        placa: 'OAA1234',
        marca: 'JAC',
        modelo: '1134',
        capacidad: '7000',
        toneladas: '8',
        rendimiento_km_galon: '16'
      }
    );
    assert.deepEqual(
      __testing.extractVehicleFields('JAC', {}, 'marca'),
      { marca: 'JAC' }
    );
  });

  it('extrae datos de un cliente y completa el siguiente campo faltante', () => {
    assert.deepEqual(
      __testing.extractClientFields(
        'Crea un cliente ACME ruc 0999999999001 telefono 0991234567 comision 8%'
      ),
      {
        nombre: 'ACME',
        ruc_cedula: '0999999999001',
        telefono: '0991234567',
        porcentaje_comision: '8'
      }
    );
    assert.deepEqual(
      __testing.extractClientFields('0999999999001', {}, 'RUC/cédula'),
      { ruc_cedula: '0999999999001' }
    );
  });

  it('prepara la apertura de formularios vacios', () => {
    assert.deepEqual(
      __testing.openCreateFormAction(
        __testing.normalizeText('Puedes abrir el modal de un nuevo viaje'),
        'abrir_formulario'
      ),
      {
        respuesta: 'Voy a abrir el formulario para crear un nuevo viaje.',
        action: {
          label: 'Nuevo viaje',
          route: '/app/viajes',
          query: { new: '1' },
          operacion: 'abrir'
        }
      }
    );

    assert.equal(
      __testing.openCreateFormAction(
        __testing.normalizeText('Abre un formulario nuevo de cliente'),
        'abrir_formulario'
      )?.action.route,
      '/app/clientes'
    );
  });

  it('normaliza tildes y texto para interpretar solicitudes', () => {
    assert.equal(__testing.normalizeText('  Vehículo y VIÁTICOS  '), 'vehiculo y viaticos');
  });

  it('extrae semana y número de registro', () => {
    assert.equal(__testing.parseWeek('Muéstrame la semana 23'), 23);
    assert.equal(__testing.assistantRecordId('modifica el viaje 92', 'viaje'), '92');
    assert.equal(
      __testing.assistantRecordId('actualiza mantenimiento #15', 'mantenimiento'),
      '15'
    );
  });

  it('separa guías por coma o guion', () => {
    assert.deepEqual(
      __testing.parseGuidesNormalized('agrega guias 230045, 230046-230047'),
      ['230045', '230046', '230047']
    );
  });

  it('extrae valores monetarios con nombre', () => {
    assert.equal(
      __testing.parseNamedMoneyValue('precio 350, viaticos 40', ['precio']),
      '350'
    );
    assert.equal(
      __testing.parseNamedMoneyValue('precio 350, viaticos 40', ['viatico', 'viaticos']),
      '40'
    );
  });

  it('distingue una capacidad numerica de otras tarifas', () => {
    assert.equal(__testing.capacityFieldMatches('7000', '7000 cartones'), true);
    assert.equal(__testing.capacityFieldMatches('6000', '7000 cartones'), false);
    assert.equal(__testing.capacityFieldMatches('Trailer F-40', 'Trailer F-40'), true);
  });

  it('acepta una fecha estructurada valida y descarta una invalida', () => {
    const fallback = new Date('2026-01-01T00:00:00.000Z');
    assert.equal(
      __testing.parseStructuredDate('2026-07-30', fallback).toISOString(),
      '2026-07-30T00:00:00.000Z'
    );
    assert.equal(
      __testing.parseStructuredDate('hoy', fallback).toISOString(),
      fallback.toISOString()
    );
  });

  it('calcula la comision del cliente para el borrador', () => {
    assert.deepEqual(__testing.billingPreviewFields('328.76', '8'), {
      porcentaje_cliente: '8.00%',
      valor_comision: '26.30',
      a_facturar: '302.46'
    });
  });

  it('detecta los datos faltantes del borrador', () => {
    assert.deepEqual(
      __testing.missingFromDraft({
        tipo: 'viaje',
        titulo: 'Borrador',
        campos: {
          cliente: 'CLIENTE',
          ruta: 'Por confirmar',
          vehiculo: 'OAA1227',
          conductor: 'CONDUCTOR',
          viaticos: 'Por confirmar'
        },
        advertencias: []
      }),
      ['ruta/precio', 'viaticos']
    );
  });
});
