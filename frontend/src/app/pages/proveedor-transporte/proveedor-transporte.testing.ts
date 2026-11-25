import type { ViajeProveedorRow } from './proveedor-transporte.models';

export const providerTripFixture = (
  overrides: Partial<ViajeProveedorRow> = {}
): ViajeProveedorRow => ({
  id: '10',
  cliente_id: '1',
  proveedor_id: '2',
  tarifa_ruta_id: '3',
  facturar_a_id: '4',
  cliente: { id: '1', nombre: 'Cliente de prueba', ruc_cedula: '123', porcentaje_comision: 3 },
  proveedor: { id: '2', nombre: 'Proveedor de prueba', ruc_cedula: '456', porcentaje_utilidad: 10 },
  tarifa_ruta: {
    id: '3',
    precio: 1000,
    ruta: { origen: 'MACHALA', destino: 'VINCES' },
    tipo_carga: { nombre: 'CARTONES' },
    capacidad: '7000'
  },
  fecha_salida: '2026-11-05',
  fecha_llegada: '2026-11-06',
  descripcion_carga: 'Carga de prueba',
  numeros_guia_remision: ['123', '456'],
  precio_viaje: 1000,
  valor_a_facturar: 970,
  precio_pagar_proveedor: 873,
  viaticos: 20,
  utilidad: 77,
  cobrado: true,
  fecha_cobro: '2026-11-09',
  soporte_cobro: 'FACT-1',
  sin_factura_cobro: false,
  pagado_proveedor: true,
  fecha_pago_proveedor: '2026-11-10',
  soporte_pago_proveedor: 'TRANS-1',
  proveedor_sin_factura: false,
  estado: 'programado',
  observaciones: 'Prueba',
  ...overrides
});
