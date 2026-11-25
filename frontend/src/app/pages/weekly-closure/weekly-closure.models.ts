export type EstadoViaje = 'programado' | 'en_curso' | 'completado' | 'cancelado';
export type EstadoMantenimiento = 'programado' | 'realizado' | 'cancelado' | 'vencido';

export interface VehiculoOption {
  id: string;
  placa: string;
  marca: string;
  modelo: string | null;
}

export interface CierreSemanal {
  semana: {
    anio: number;
    numero_semana: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string | null;
  };
  resumen: {
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_gastos_semanales: number;
    cantidad_gastos_generados: number;
    totales: Record<string, unknown>;
  };
  viajes: ViajeCierre[];
  mantenimientos: MantenimientoCierre[];
  conductores: {
    conductor: { nombre: string; cedula: string };
    cantidad_viajes: number;
    sueldo_semanal: string;
    bonificacion_sugerida: string;
    vehiculo_asignado_gasto: { placa: string } | null;
  }[];
  vehiculos: {
    vehiculo: { placa: string; marca: string; modelo: string | null };
    cantidad_viajes: number;
    cantidad_mantenimientos: number;
    cantidad_gastos_semanales: number;
    totales: Record<string, unknown>;
  }[];
  revision_cierre?: {
    cerrado: boolean;
    cierre_id?: string;
    cerrado_en?: string;
    requiere_revision: boolean;
    diferencias: unknown[];
    total_diferencias: number;
  };
  asistente_cierre?: AsistenteCierre;
}

export interface AsistenteCierre {
  disponible: boolean;
  riesgo: 'bajo' | 'medio' | 'alto';
  puntaje: number;
  total_alertas: number;
  resumen: string;
  alertas: AsistenteCierreAlerta[];
}

export interface AsistenteCierreAlerta {
  id: string;
  tipo: string;
  severidad: 'info' | 'advertencia' | 'critica';
  titulo: string;
  mensaje: string;
  accion_sugerida: string;
  source_type?: 'viaje' | 'mantenimiento' | 'cierre' | null;
  source_id?: string | null;
}

export interface ViajeCierre {
  id: string;
  fecha_salida: string;
  fecha_llegada?: string | null;
  cliente: { nombre: string; ruc_cedula: string };
  conductor: { nombre: string; cedula: string };
  ruta: { origen: string; destino: string };
  tipo_carga: { nombre: string };
  descripcion_carga?: string | null;
  numeros_guia_remision: string[];
  precio_flete: string | number;
  retorno_gastos_viaje: string | number;
  precio_real_flete: string | number;
  viaticos: string | number;
  utilidad: string | number;
  cobrado: boolean;
  retorno: boolean;
  estado: EstadoViaje;
}

export interface MantenimientoCierre {
  id: string;
  fecha_mantenimiento: string;
  vehiculo: { id: string; placa: string; marca: string; modelo: string | null };
  tipo_mantenimiento: { nombre: string };
  descripcion?: string | null;
  costo_total: string | number;
  estado: EstadoMantenimiento;
}

export interface ActividadSemanalItem {
  trackId: string;
  sourceId: string;
  sourceType: 'viaje' | 'mantenimiento';
  fecha: string;
  tipo: 'Viaje' | 'Retorno' | 'Mantenimiento';
  titulo: string;
  detalle: string;
  flete: string | number | null;
  fleteReal: string | number | null;
  viaticos: string | number | null;
  resultado: string | number | null;
  copyText: string | null;
  cobrado: boolean;
  estado: string;
  estadoClass: string;
  rowClass: string;
  sortTime: number;
}
