export type ModalidadComision = 'AL_PAGAR' | 'EN_FACTURA';
export interface Config {
  cliente_id?: string;
  destinatario_id: string | null;
  comision_cliente: number;
  ir_cliente: boolean;
  comision_empresa: number;
  ir_empresa: boolean;
  modalidad_comision: ModalidadComision;
}
export interface Cliente {
  id: string;
  nombre: string;
  porcentaje_comision: number;
  configuracion_facturacion: Config;
}
export interface Trip {
  id: string;
  tipo: 'propio' | 'proveedor';
  cliente_id: string;
  cliente: string;
  fecha: string;
  placa: string | null;
  ruta: string;
  destino: string;
  proveedor_id: string | null;
  proveedor: string | null;
  guias: string[];
  precio: number;
  comision_cliente: number;
  ir_cliente: boolean;
  destinatario_id: string;
}
export interface Amounts {
  precio: number;
  a_facturar: number;
  comision_empresa: number;
  ir_empresa: number;
  neto: number;
  monto_comision_cliente: number;
  monto_ir_cliente: number;
  cliente_nombre?: string;
  ruta?: string;
}
export interface Preview {
  detalles: Amounts[];
  total_facturar: number;
  total_comision: number;
  total_ir: number;
  neto: number;
}
export interface Invoice extends Preview {
  id: string;
  numero: string | null;
  fecha: string;
  destinatario: Cliente;
  saldo: number;
  recibido: number;
  comision_empresa: number;
  ir_empresa: boolean;
  modalidad_comision: ModalidadComision;
  estado: 'PREPARACION' | 'FACTURADA';
  version: number;
  viajes?: Trip[];
  abonos: { id: string; fecha: string; monto: number; soporte: string }[];
}

export interface Draft {
  id: string;
  numero: string | null;
  version: number;
}
export interface Vehicle {
  id: string;
  placa: string;
}
export interface TripListFilters {
  search: string;
  page: number;
  limit: number;
  solo_propios: boolean;
  cliente_ids: string;
  vehiculo_ids: string;
  semanas: string;
}
export interface ListResult<T> {
  items: T[];
  total: number;
}
export interface BillingPayload {
  destinatario_id: string;
  numero: string;
  fecha: string;
  comision_empresa: number;
  ir_empresa: boolean;
  modalidad_comision: ModalidadComision;
  factura_id?: string;
  detalles: { tipo: Trip['tipo']; id: string; comision_cliente: number; ir_cliente: boolean }[];
}
export interface ConfirmedAmounts {
  neto_confirmado: number;
  total_facturar_confirmado: number;
}
export interface PaymentInput {
  fecha: string;
  monto: number;
  soporte: string;
}
export interface TripSnapshot {
  cliente_id: string;
  cliente: { nombre: string };
  fecha_salida: string;
  vehiculo?: { placa: string };
  proveedor_id?: string;
  proveedor?: { nombre: string };
  tarifa_ruta: { ruta: { origen: string; destino: string } };
  numeros_guia_remision: string[];
  precio_flete?: number;
  precio_viaje: number;
  cobrado: boolean;
  estado: string;
  detalle_factura?: unknown;
}
export interface BillingRow {
  trip: Trip;
  index: number;
}
export interface BillingGroup {
  key: string;
  label: string;
  rows: BillingRow[];
  total: number | null;
}
export interface InvoiceGroup {
  key: string;
  label: string;
  rows: { trip: Trip; amounts: Amounts }[];
  total: number;
}
