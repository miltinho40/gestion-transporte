import type { AsistenteMensajeInput } from './asistente.schema.js';
import type { AssistantExtractedParameters } from './asistente.interpreter.js';
import type { AssistantPreferenceRecord } from './asistente.preferences.js';
import type { AssistantToolName } from './asistente.tools.js';

export type AssistantEngineInput = AsistenteMensajeInput & {
  herramienta?: AssistantToolName;
  entidades?: AssistantExtractedParameters;
  preferencias?: AssistantPreferenceRecord[];
  capacidades?: {
    super_admin: boolean;
    propietario: boolean;
    intermediario: boolean;
  };
};

export type AssistantCard = {
  titulo: string;
  valor: string;
  detalle?: string;
};

export type AssistantDraft = {
  tipo: 'viaje' | 'viaje_proveedor' | 'mantenimiento' | 'cliente' | 'vehiculo' | 'conductor';
  titulo: string;
  campos: Record<string, string>;
  advertencias: string[];
};

export type AssistantAction = {
  label: string;
  route: string;
  query: Record<string, string>;
  operacion?: 'abrir' | 'guardar' | 'editar';
};

export type AssistantQueryContext = {
  tipo: 'viajes';
  filtros: {
    cliente_id?: string;
    cliente_nombre?: string;
    vehiculo_id?: string;
    vehiculo_placa?: string;
    conductor_id?: string;
    conductor_nombre?: string;
    destino?: string;
    semana?: number;
    anio?: number;
    cobrado?: boolean;
    limite?: number;
    orden_campo?: OperationalQueryOrderField;
    orden_direccion?: AnalyticsOrder;
  };
};

export type AssistantProviderQueryContext = {
  tipo: 'viajes_proveedor';
  filtros: {
    cliente_id?: string;
    cliente_nombre?: string;
    proveedor_id?: string;
    proveedor_nombre?: string;
    destino?: string;
    semana?: number;
    anio?: number;
    cobrado?: boolean;
    pagado_proveedor?: boolean;
    limite?: number;
    orden_campo?: OperationalQueryOrderField;
    orden_direccion?: AnalyticsOrder;
  };
};

export type AssistantMaintenanceQueryContext = {
  tipo: 'mantenimientos';
  filtros: {
    vehiculo_id?: string;
    vehiculo_placa?: string;
    tipo_mantenimiento_id?: string;
    tipo_mantenimiento_nombre?: string;
    semana?: number;
    anio?: number;
    limite?: number;
    orden_campo?: OperationalQueryOrderField;
    orden_direccion?: AnalyticsOrder;
  };
};

export type AnalyticsMetric =
  | 'valor_a_facturar'
  | 'precio_viaje'
  | 'utilidad_viajes'
  | 'viaticos'
  | 'cantidad_viajes'
  | 'pago_conductor';

export type AnalyticsDimension = 'vehiculo' | 'cliente' | 'conductor' | 'destino';
export type AnalyticsAggregation = 'suma' | 'promedio' | 'conteo';
export type AnalyticsOrder = 'asc' | 'desc';

export type OperationalQuerySource = 'viajes_propios' | 'viajes_proveedores' | 'mantenimientos';
export type OperationalQueryMode = 'listado' | 'resumen' | 'agrupado';
export type OperationalQueryOrderField =
  | 'fecha'
  | 'valor_a_facturar'
  | 'precio_viaje'
  | 'utilidad'
  | 'costo';

export type AssistantOperationalQueryPlan = {
  fuente: OperationalQuerySource;
  modo: OperationalQueryMode;
  limite: number;
  orden: {
    campo: OperationalQueryOrderField;
    direccion: AnalyticsOrder;
  };
  periodo: 'predeterminado' | 'explicito' | 'todo';
  comparar_semanas?: [number, number];
  agregacion?: {
    operacion: AnalyticsAggregation | 'maximo' | 'minimo';
    metrica: string;
    agrupar_por?: string;
  };
};

export type AssistantAnalyticsContext = {
  tipo: 'analitica_viajes';
  filtros: {
    metrica: AnalyticsMetric;
    agrupar_por: AnalyticsDimension;
    operacion: AnalyticsAggregation;
    orden: AnalyticsOrder;
    limite: number;
    semana?: number;
    anio: number;
    cobrado?: boolean;
    cliente_id?: string;
    cliente_nombre?: string;
    vehiculo_id?: string;
    vehiculo_placa?: string;
    conductor_id?: string;
    conductor_nombre?: string;
    destino?: string;
  };
};
