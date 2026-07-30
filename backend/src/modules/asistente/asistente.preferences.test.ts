import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/gestion_transporte_test';
process.env.JWT_SECRET ??= 'test-secret-with-enough-length';

const { __testing } = await import('./asistente.preferences.js');

describe('preferencias controladas del asistente', () => {
  it('extrae un alias y su registro objetivo', () => {
    assert.deepEqual(
      __testing.aliasStatement('Recuerda que mi camión es el OAA1227'),
      {
        alias: 'mi camión',
        target: 'OAA1227'
      }
    );
  });

  it('detecta instrucciones para recordar, consultar y olvidar', () => {
    assert.equal(
      __testing.isAssistantPreferenceCommand('Recuerda que mi camión es OAA1227'),
      true
    );
    assert.equal(
      __testing.isAssistantPreferenceCommand('¿Qué recuerdas de mí?'),
      true
    );
    assert.equal(
      __testing.isAssistantPreferenceCommand('Olvida que mi camión es OAA1227'),
      true
    );
    assert.equal(
      __testing.isAssistantPreferenceCommand('Crea un viaje con mi camión'),
      false
    );
    assert.equal(
      __testing.isAssistantPreferenceCommand('Mi vehículo habitual es OAA1227'),
      true
    );
  });

  it('aplica alias sin distinguir mayusculas ni tildes', () => {
    const result = __testing.applyAssistantPreferencesToMessage(
      'Crea un viaje mañana con Mi Camión',
      [
        {
          tipo: 'alias_entidad',
          valor: {
            alias: 'mi camion',
            entidad_tipo: 'vehiculo',
            entidad_id: '10',
            entidad_nombre: 'OAA1227'
          }
        }
      ]
    );

    assert.equal(result.message, 'Crea un viaje mañana con OAA1227');
    assert.deepEqual(result.applied, ['mi camion']);
  });

  it('no expande alias dentro de una instruccion de memoria', () => {
    const result = __testing.applyAssistantPreferencesToMessage(
      'Olvida que mi camión es OAA1227',
      [
        {
          tipo: 'alias_entidad',
          valor: {
            alias: 'mi camion',
            entidad_tipo: 'vehiculo',
            entidad_id: '10',
            entidad_nombre: 'OAA1227'
          }
        }
      ]
    );

    assert.equal(result.message, 'Olvida que mi camión es OAA1227');
    assert.deepEqual(result.applied, []);
  });

  it('prioriza vehiculo por cliente sobre el vehiculo general', () => {
    const result = __testing.resolveAssistantTripDefaults(
      [
        {
          tipo: 'vehiculo_habitual',
          alcance: 'personal',
          scope_key: 'usuario:10',
          valor: {
            cliente_id: '20',
            cliente_nombre: 'TRANSPALFRA',
            vehiculo_id: '30',
            vehiculo_placa: 'OAA1588'
          }
        },
        {
          tipo: 'vehiculo_habitual',
          alcance: 'personal',
          scope_key: 'usuario:10',
          valor: {
            cliente_id: null,
            cliente_nombre: null,
            vehiculo_id: '31',
            vehiculo_placa: 'OAA1227'
          }
        }
      ],
      { clienteId: '20' }
    );

    assert.equal(result.vehiculo?.vehiculo_placa, 'OAA1588');
  });

  it('encadena vehiculo habitual con conductor por vehiculo', () => {
    const result = __testing.resolveAssistantTripDefaults(
      [
        {
          tipo: 'vehiculo_habitual',
          alcance: 'propietario',
          scope_key: 'propietario',
          valor: {
            cliente_id: null,
            cliente_nombre: null,
            vehiculo_id: '31',
            vehiculo_placa: 'OAA1227'
          }
        },
        {
          tipo: 'conductor_vehiculo',
          alcance: 'personal',
          scope_key: 'usuario:10',
          valor: {
            vehiculo_id: '31',
            vehiculo_placa: 'OAA1227',
            conductor_id: '40',
            conductor_nombre: 'VICENTE RAMIREZ'
          }
        }
      ],
      {}
    );

    assert.equal(result.vehiculo?.vehiculo_placa, 'OAA1227');
    assert.equal(result.conductor?.conductor_nombre, 'VICENTE RAMIREZ');
  });

  it('resuelve el tipo de carga habitual por cliente', () => {
    const result = __testing.resolveAssistantTripDefaults(
      [
        {
          tipo: 'tipo_carga_cliente',
          alcance: 'personal',
          scope_key: 'usuario:10',
          valor: {
            cliente_id: '20',
            cliente_nombre: 'TRANSPALFRA',
            tipo_carga_id: '50',
            tipo_carga_nombre: 'CARTONES'
          }
        }
      ],
      { clienteId: '20' }
    );

    assert.equal(result.cargo?.tipo_carga_nombre, 'CARTONES');
  });
});
