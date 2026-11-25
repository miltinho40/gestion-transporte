import type { CierreSemanal, ViajeCierre } from './weekly-closure.models';

export function weeklyTripFixture(overrides: Partial<ViajeCierre> = {}): ViajeCierre {
  return {
    id: '10',
    fecha_salida: '2026-06-19',
    fecha_llegada: '2026-06-20',
    cliente: { nombre: 'CLIENTE PRUEBA', ruc_cedula: '0000000000' },
    conductor: { nombre: 'CONDUCTOR PRUEBA', cedula: '0000000000' },
    ruta: { origen: 'MACHALA', destino: 'VINCES' },
    tipo_carga: { nombre: 'CARTONES' },
    numeros_guia_remision: ['12345, 67890-54321'],
    precio_flete: '400.00',
    retorno_gastos_viaje: '20.00',
    precio_real_flete: '368.00',
    viaticos: '100.00',
    utilidad: '248.00',
    cobrado: false,
    retorno: false,
    estado: 'completado',
    ...overrides,
  };
}

export function weeklyClosureFixture(overrides: Partial<CierreSemanal> = {}): CierreSemanal {
  const vehiculo = { id: '1', placa: 'OAA1227', marca: 'JAC', modelo: '1134' };
  return {
    semana: {
      anio: 2026,
      numero_semana: 25,
      fecha_inicio: '2026-06-15T00:00:00.000Z',
      fecha_fin: '2026-06-21T00:00:00.000Z',
    },
    vehiculo,
    resumen: {
      cantidad_viajes: 2,
      cantidad_mantenimientos: 1,
      cantidad_gastos_semanales: 0,
      cantidad_gastos_generados: 0,
      totales: {
        precio_flete: '800.00',
        precio_real_flete: '736.00',
        utilidad: '496.00',
        mantenimientos: '50.00',
        gastos_semanales: '0.00',
        sueldos_sugeridos: '150.00',
        bonificaciones_sugeridas: '40.00',
        resultado_operativo: '256.00',
      },
    },
    viajes: [
      weeklyTripFixture({ id: '11', fecha_llegada: '2026-06-21', retorno: true, cobrado: true }),
      weeklyTripFixture(),
    ],
    mantenimientos: [
      {
        id: '20',
        fecha_mantenimiento: '2026-06-15',
        vehiculo,
        tipo_mantenimiento: { nombre: 'ACEITE' },
        descripcion: 'Cambio de aceite',
        costo_total: '50.00',
        estado: 'realizado',
      },
    ],
    conductores: [
      {
        conductor: { nombre: 'CONDUCTOR PRUEBA', cedula: '0000000000' },
        cantidad_viajes: 2,
        sueldo_semanal: '150.00',
        bonificacion_sugerida: '40.00',
        vehiculo_asignado_gasto: { placa: 'OAA1227' },
      },
    ],
    vehiculos: [],
    revision_cierre: {
      cerrado: false,
      requiere_revision: false,
      diferencias: [],
      total_diferencias: 0,
    },
    asistente_cierre: {
      disponible: true,
      riesgo: 'bajo',
      puntaje: 0,
      total_alertas: 0,
      resumen: 'Sin novedades',
      alertas: [],
    },
    ...overrides,
  };
}
