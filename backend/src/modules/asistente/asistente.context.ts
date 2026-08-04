import type {
  AssistantAnalyticsContext,
  AssistantQueryContext
} from './asistente.engine.types.js';

type CommonFilters = AssistantQueryContext['filtros'];

export const requestsCobradoFilterClear = (normalized: string) =>
  /\b(?:sin filtro de cobro|quita(?:r)?(?: el filtro de)? cobro|cobrados y por cobrar|todos los estados)\b/.test(
    normalized
  );

const removePair = (
  filters: CommonFilters,
  idKey: 'cliente_id' | 'vehiculo_id' | 'conductor_id',
  labelKey: 'cliente_nombre' | 'vehiculo_placa' | 'conductor_nombre'
) => {
  delete filters[idKey];
  delete filters[labelKey];
};

export const clearRequestedConversationFilters = (
  current: CommonFilters,
  normalized: string
) => {
  const filters = { ...current };
  const clearAll =
    /\b(limpia|limpiar|quita|quitar|elimina|eliminar)\s+(?:todos\s+)?los filtros\b/.test(normalized) ||
    /\bsin filtros\b/.test(normalized);

  if (clearAll) return {};

  if (
    /\b(todos los|cualquier|sin filtro de|quita(?:r)?(?: el filtro de)?)\s+clientes?\b/.test(
      normalized
    )
  ) {
    removePair(filters, 'cliente_id', 'cliente_nombre');
  }
  if (
    /\b(todos los|cualquier|sin filtro de|quita(?:r)?(?: el filtro de)?)\s+(?:vehiculos?|carros?)\b/.test(
      normalized
    )
  ) {
    removePair(filters, 'vehiculo_id', 'vehiculo_placa');
  }
  if (
    /\b(todos los|cualquier|sin filtro de|quita(?:r)?(?: el filtro de)?)\s+(?:conductores?|choferes?|transportistas?)\b/.test(
      normalized
    )
  ) {
    removePair(filters, 'conductor_id', 'conductor_nombre');
  }
  if (
    /\b(todos los|cualquier|sin filtro de|quita(?:r)?(?: el filtro de)?)\s+(?:destinos?|rutas?)\b/.test(
      normalized
    )
  ) {
    delete filters.destino;
  }
  if (
    /\b(todas las|cualquier|sin filtro de|quita(?:r)?(?: el filtro de)?)\s+semanas?\b/.test(
      normalized
    )
  ) {
    delete filters.semana;
    delete filters.anio;
  }
  if (requestsCobradoFilterClear(normalized)) {
    delete filters.cobrado;
  }

  return filters;
};

export const commonFiltersFromAnalytics = (
  filters: AssistantAnalyticsContext['filtros']
): CommonFilters => ({
  ...(filters.cliente_id ? { cliente_id: filters.cliente_id } : {}),
  ...(filters.cliente_nombre ? { cliente_nombre: filters.cliente_nombre } : {}),
  ...(filters.vehiculo_id ? { vehiculo_id: filters.vehiculo_id } : {}),
  ...(filters.vehiculo_placa ? { vehiculo_placa: filters.vehiculo_placa } : {}),
  ...(filters.conductor_id ? { conductor_id: filters.conductor_id } : {}),
  ...(filters.conductor_nombre ? { conductor_nombre: filters.conductor_nombre } : {}),
  ...(filters.destino ? { destino: filters.destino } : {}),
  ...(filters.semana ? { semana: filters.semana } : {}),
  ...(filters.anio ? { anio: filters.anio } : {}),
  ...(typeof filters.cobrado === 'boolean' ? { cobrado: filters.cobrado } : {})
});

export const commonFiltersForAnalytics = (filters: CommonFilters) => ({
  ...(filters.cliente_id ? { cliente_id: filters.cliente_id } : {}),
  ...(filters.cliente_nombre ? { cliente_nombre: filters.cliente_nombre } : {}),
  ...(filters.vehiculo_id ? { vehiculo_id: filters.vehiculo_id } : {}),
  ...(filters.vehiculo_placa ? { vehiculo_placa: filters.vehiculo_placa } : {}),
  ...(filters.conductor_id ? { conductor_id: filters.conductor_id } : {}),
  ...(filters.conductor_nombre ? { conductor_nombre: filters.conductor_nombre } : {}),
  ...(filters.destino ? { destino: filters.destino } : {}),
  ...(filters.semana ? { semana: filters.semana } : {}),
  ...(filters.anio ? { anio: filters.anio } : {}),
  ...(typeof filters.cobrado === 'boolean' ? { cobrado: filters.cobrado } : {})
});

export const replaceCommonFiltersInAnalytics = (
  plan: AssistantAnalyticsContext['filtros'],
  common: CommonFilters
): AssistantAnalyticsContext['filtros'] => {
  const {
    cliente_id: _clienteId,
    cliente_nombre: _clienteNombre,
    vehiculo_id: _vehiculoId,
    vehiculo_placa: _vehiculoPlaca,
    conductor_id: _conductorId,
    conductor_nombre: _conductorNombre,
    destino: _destino,
    semana: _semana,
    anio: _anio,
    cobrado: _cobrado,
    ...analytics
  } = plan;

  return {
    ...analytics,
    ...commonFiltersForAnalytics(common),
    anio: common.anio ?? plan.anio
  };
};

export const conversationFilterLabels = (filters: CommonFilters) =>
  [
    filters.cliente_nombre ? `cliente ${filters.cliente_nombre}` : '',
    filters.vehiculo_placa ? `vehiculo ${filters.vehiculo_placa}` : '',
    filters.conductor_nombre ? `conductor ${filters.conductor_nombre}` : '',
    filters.destino ? `destino ${filters.destino}` : '',
    typeof filters.cobrado === 'boolean' ? (filters.cobrado ? 'cobrados' : 'por cobrar') : ''
  ].filter(Boolean);

export const isConversationFollowUp = (
  normalized: string,
  context?: AssistantQueryContext
) => {
  if (!context || context.tipo !== 'viajes' || /\b(ultimo|ultima)\b/.test(normalized)) {
    return false;
  }

  return (
    /^(ahora|y |solo |tambien |muestra|muestrame|dame|lista|cambia|quita|sin |todos |todas )/.test(
      normalized
    ) ||
    /\b(semana|cliente|vehiculo|carro|conductor|chofer|destino|ruta|cobrado|cobrados|por cobrar|siguiente|anterior)\b/.test(
      normalized
    )
  );
};
