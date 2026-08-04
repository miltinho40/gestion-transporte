import type { AssistantExtractedParameters } from './asistente.interpreter.js';
import type {
  AnalyticsAggregation,
  AnalyticsOrder,
  AssistantOperationalQueryPlan,
  OperationalQueryOrderField,
  OperationalQuerySource
} from './asistente.engine.types.js';
import type { AssistantToolName } from './asistente.tools.js';

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const numberWords: Record<string, number> = {
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  veinte: 20
};

const requestedLimit = (message: string, parameters: AssistantExtractedParameters) => {
  const explicit = Number(parameters.limite ?? 0);
  if (Number.isInteger(explicit) && explicit > 0) return Math.min(explicit, 50);

  const normalized = normalize(message);
  const numeric = Number(
    normalized.match(/\b(?:ultimos?|ultimas?|primeros?|primeras?|top)\s*(\d{1,2})\b/)?.[1] ??
      normalized.match(/\b(\d{1,2})\s+(?:ultimos?|ultimas?|primeros?|primeras?|viajes?|mantenimientos?)\b/)?.[1] ??
      0
  );
  if (numeric > 0) return Math.min(numeric, 50);

  const word = normalized.match(
    /\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte)\s+(?:ultimos?|ultimas?|primeros?|primeras?|viajes?|mantenimientos?)\b/
  )?.[1];
  if (word) return numberWords[word] ?? 10;
  return /\b(?:ultimo|ultima|mas reciente)\b/.test(normalized) ? 1 : 10;
};

const querySource = (
  tool: AssistantToolName | undefined,
  message: string,
  parameters: AssistantExtractedParameters,
  previous?: OperationalQuerySource
): OperationalQuerySource => {
  if (tool === 'consultar_mantenimientos') return 'mantenimientos';
  const normalized = normalize(message);
  const origin = normalize(parameters.origen_viajes);
  if (
    origin === 'proveedores' ||
    parameters.proveedor ||
    /\b(?:proveedor|proveedores|terceros)\b/.test(normalized)
  ) {
    return 'viajes_proveedores';
  }
  if (/\b(?:viajes? propios?|flota propia|mis vehiculos)\b/.test(normalized)) {
    return 'viajes_propios';
  }
  return previous ?? 'viajes_propios';
};

const metricFromText = (message: string, parameters: AssistantExtractedParameters) => {
  const explicit = normalize(parameters.metrica);
  if (explicit) return explicit;
  const normalized = normalize(message);
  if (/\b(?:cuantos|cantidad|numero de)\b/.test(normalized)) return 'cantidad_viajes';
  if (/\b(?:utilidad|ganancia)\b/.test(normalized)) return 'utilidad_viajes';
  if (/\b(?:viatico|viaticos|gastos?)\b/.test(normalized)) return 'viaticos';
  if (/\b(?:costo|mantenimiento)\b/.test(normalized)) return 'costo';
  if (/\b(?:precio|flete)\b/.test(normalized)) return 'precio_viaje';
  return 'valor_a_facturar';
};

const orderField = (
  message: string,
  parameters: AssistantExtractedParameters,
  source: OperationalQuerySource
): OperationalQueryOrderField => {
  const requested = normalize(parameters.campo_orden);
  const normalized = normalize(message);
  const explicitMetric = normalize(parameters.metrica);
  const metric = `${requested} ${explicitMetric} ${normalized}`;
  if (metric.includes('utilidad') || metric.includes('ganancia')) return 'utilidad';
  if (metric.includes('costo')) return 'costo';
  if (metric.includes('precio') || metric.includes('flete')) return 'precio_viaje';
  if (metric.includes('factur')) return 'valor_a_facturar';
  return 'fecha';
};

const aggregation = (
  message: string,
  parameters: AssistantExtractedParameters
): AssistantOperationalQueryPlan['agregacion'] => {
  const normalized = normalize(message);
  const requested = normalize(parameters.operacion);
  const groupBy = normalize(parameters.agrupar_por) || undefined;
  let operation: AnalyticsAggregation | 'maximo' | 'minimo' | undefined;
  if (requested.includes('promedio') || normalized.includes('promedio')) operation = 'promedio';
  else if (requested.includes('conteo') || /\b(?:cuantos|cantidad|numero de)\b/.test(normalized)) operation = 'conteo';
  else if (/\b(?:mayor|mas alto|mas genero|mas facturo)\b/.test(normalized)) operation = 'maximo';
  else if (/\b(?:menor|mas bajo|menos genero|menos facturo)\b/.test(normalized)) operation = 'minimo';
  else if (requested.includes('suma') || /\b(?:total|suma|sumatoria)\b/.test(normalized)) operation = 'suma';
  if (!operation && !groupBy) return undefined;
  return {
    operacion: operation ?? 'suma',
    metrica: metricFromText(message, parameters),
    ...(groupBy ? { agrupar_por: groupBy } : {})
  };
};

export const buildOperationalQueryPlan = (input: {
  tool?: AssistantToolName;
  message: string;
  parameters?: AssistantExtractedParameters;
  previousSource?: OperationalQuerySource;
  previous?: Pick<AssistantOperationalQueryPlan, 'limite' | 'orden'>;
}): AssistantOperationalQueryPlan => {
  const parameters = input.parameters ?? {};
  const normalized = normalize(input.message);
  const source = querySource(input.tool, input.message, parameters, input.previousSource);
  const aggregate = aggregation(input.message, parameters);
  const requestedOrder = normalize(parameters.orden);
  const ascending =
    requestedOrder.includes('asc') ||
    /\b(?:mas antiguo|mas antiguos|primero|primeros|menor|menos)\b/.test(normalized);
  const explicitPeriod = Boolean(
    parameters.semana || parameters.anio || parameters.fecha_desde || parameters.fecha_hasta ||
      /\b(?:semana|mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|20\d{2})\b/.test(normalized)
  );
  const allTime = /\b(?:todos los viajes|todos los mantenimientos|historico completo|sin fecha|sin periodo|pendientes? de cobro|por cobrar|sin cobrar|pendientes? de pago|por pagar)\b/.test(normalized);
  const recent = /\b(?:ultimo|ultimos|ultima|ultimas|primero|primeros|primera|primeras|reciente|recientes)\b/.test(normalized);
  const comparedWeeksMatch = normalized.match(
    /\bsemanas?\s*(\d{1,2})\s*(?:y|vs\.?|contra|,)\s*(?:semana\s*)?(\d{1,2})\b/
  );
  const comparedWeeks = comparedWeeksMatch
    ? [Number(comparedWeeksMatch[1]), Number(comparedWeeksMatch[2])] as [number, number]
    : undefined;
  const hasExplicitLimit = Boolean(
    parameters.limite ||
      /\b(?:\d{1,2}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte)\s+(?:ultimos?|ultimas?|primeros?|primeras?|viajes?|mantenimientos?)\b/.test(normalized) ||
      /\b(?:ultimo|ultima|top)\b/.test(normalized)
  );
  const hasExplicitOrder = Boolean(
    parameters.orden || parameters.campo_orden ||
      /\b(?:mayor|menor|mas alto|mas bajo|mas antiguo|primero|reciente|precio|flete|factur|utilidad|ganancia|costo)\b/.test(normalized)
  );
  const parsedOrder = {
    campo: orderField(input.message, parameters, source),
    direccion: (ascending || aggregate?.operacion === 'minimo' ? 'asc' : 'desc') as AnalyticsOrder
  };

  return {
    fuente: source,
    modo: aggregate?.agrupar_por ? 'agrupado' : aggregate ? 'resumen' : 'listado',
    limite: hasExplicitLimit ? requestedLimit(input.message, parameters) : input.previous?.limite ?? 10,
    orden: hasExplicitOrder ? parsedOrder : input.previous?.orden ?? parsedOrder,
    periodo: explicitPeriod ? 'explicito' : allTime || recent ? 'todo' : 'predeterminado',
    ...(comparedWeeks && comparedWeeks.every((week) => week >= 1 && week <= 53)
      ? { comparar_semanas: comparedWeeks }
      : {}),
    ...(aggregate ? { agregacion: aggregate } : {})
  };
};

export const __testing = { requestedLimit };
