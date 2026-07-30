import type { JwtPayload } from '../../config/jwt.js';
import { AppError } from '../../utils/app-error.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';

export type AssistantToolName =
  | 'interpretar_solicitud'
  | 'consultar_viajes'
  | 'consultar_viajes_pendientes'
  | 'consultar_viajes_proveedor'
  | 'consultar_mantenimientos'
  | 'consultar_cierre_semanal'
  | 'analizar_operacion'
  | 'abrir_formulario'
  | 'preparar_cliente'
  | 'preparar_vehiculo'
  | 'preparar_conductor'
  | 'preparar_viaje'
  | 'preparar_mantenimiento'
  | 'preparar_edicion'
  | 'preparar_preferencia'
  | 'consultar_preferencias'
  | 'cancelar_borrador'
  | 'aplicar_borrador'
  | 'aplicar_preferencia';

export interface AssistantToolDefinition {
  name: AssistantToolName;
  category: 'lectura' | 'preparacion' | 'escritura';
  requiresConfirmation: boolean;
  scope: 'propietario' | 'intermediario' | 'cualquiera';
}

export const assistantToolCatalog: Record<AssistantToolName, AssistantToolDefinition> = {
  interpretar_solicitud: {
    name: 'interpretar_solicitud',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  consultar_viajes: {
    name: 'consultar_viajes',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  consultar_viajes_pendientes: {
    name: 'consultar_viajes_pendientes',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  consultar_viajes_proveedor: {
    name: 'consultar_viajes_proveedor',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'intermediario'
  },
  consultar_mantenimientos: {
    name: 'consultar_mantenimientos',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  consultar_cierre_semanal: {
    name: 'consultar_cierre_semanal',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  analizar_operacion: {
    name: 'analizar_operacion',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  abrir_formulario: {
    name: 'abrir_formulario',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  preparar_cliente: {
    name: 'preparar_cliente',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  preparar_vehiculo: {
    name: 'preparar_vehiculo',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  preparar_conductor: {
    name: 'preparar_conductor',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  preparar_viaje: {
    name: 'preparar_viaje',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  preparar_mantenimiento: {
    name: 'preparar_mantenimiento',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  preparar_edicion: {
    name: 'preparar_edicion',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'propietario'
  },
  preparar_preferencia: {
    name: 'preparar_preferencia',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  consultar_preferencias: {
    name: 'consultar_preferencias',
    category: 'lectura',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  cancelar_borrador: {
    name: 'cancelar_borrador',
    category: 'preparacion',
    requiresConfirmation: false,
    scope: 'cualquiera'
  },
  aplicar_borrador: {
    name: 'aplicar_borrador',
    category: 'escritura',
    requiresConfirmation: true,
    scope: 'propietario'
  },
  aplicar_preferencia: {
    name: 'aplicar_preferencia',
    category: 'escritura',
    requiresConfirmation: true,
    scope: 'cualquiera'
  }
};

export const isAssistantToolAllowed = (
  tool: AssistantToolDefinition,
  user: JwtPayload | undefined,
  confirmed: boolean
) => {
  if (!user?.propietario_id) return false;

  if (
    tool.scope === 'propietario' &&
    !user.es_super_admin &&
    user.es_propietario === false
  ) {
    return false;
  }

  if (
    tool.scope === 'intermediario' &&
    !user.es_super_admin &&
    user.es_intermediario === false
  ) {
    return false;
  }

  return !tool.requiresConfirmation || confirmed;
};

export const assistantToolsAllowedForUser = (
  user: JwtPayload,
  confirmed = false
) =>
  Object.values(assistantToolCatalog).filter((tool) =>
    isAssistantToolAllowed(tool, user, confirmed)
  );

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const selectAssistantTool = (input: AsistenteMensajeInput): AssistantToolDefinition => {
  const normalized = normalize(input.mensaje);

  if (normalized.includes('cancelar')) {
    return assistantToolCatalog.cancelar_borrador;
  }

  if (
    input.contexto?.confirmar &&
    input.contexto.action?.route === '/assistant/preferences'
  ) {
    return assistantToolCatalog.aplicar_preferencia;
  }

  if (input.contexto?.confirmar && input.contexto.action?.operacion) {
    return assistantToolCatalog.aplicar_borrador;
  }

  if (input.contexto?.draft?.tipo === 'preferencia') {
    return assistantToolCatalog.preparar_preferencia;
  }

  if (input.contexto?.draft?.tipo === 'viaje') {
    return assistantToolCatalog.preparar_viaje;
  }

  if (input.contexto?.draft?.tipo === 'cliente') {
    return assistantToolCatalog.preparar_cliente;
  }

  if (input.contexto?.draft?.tipo === 'vehiculo') {
    return assistantToolCatalog.preparar_vehiculo;
  }

  if (input.contexto?.draft?.tipo === 'conductor') {
    return assistantToolCatalog.preparar_conductor;
  }

  if (input.contexto?.draft?.tipo === 'mantenimiento') {
    return assistantToolCatalog.preparar_mantenimiento;
  }

  if (
    normalized.includes('que recuerdas de mi') ||
    normalized.includes('que tienes guardado') ||
    normalized.includes('mis preferencias') ||
    normalized.includes('muestra mis preferencias')
  ) {
    return assistantToolCatalog.consultar_preferencias;
  }

  if (
    /\b(recuerda|recordar|memoriza|memorizar)\b/.test(normalized) ||
    /\b(habitual|habitualmente|normalmente|predeterminad[oa])\b/.test(normalized) ||
    /\b(olvida|olvidar|borra|elimina)\b.*\b(preferencia|recuerdo|que)\b/.test(normalized)
  ) {
    return assistantToolCatalog.preparar_preferencia;
  }

  if (/(modifica|modificar|actualiza|actualizar|edita|editar)/.test(normalized)) {
    return assistantToolCatalog.preparar_edicion;
  }

  if (
    /(abre|abrir|muestra|mostrar).*(modal|formulario|pantalla|nuevo|nueva)/.test(normalized) &&
    /(viaje|cliente|vehiculo|conductor)/.test(normalized)
  ) {
    return assistantToolCatalog.abrir_formulario;
  }

  if (/(crea|crear|registra|registrar|agrega|agregar).*(mantenimiento)/.test(normalized)) {
    return assistantToolCatalog.preparar_mantenimiento;
  }

  if (/(crea|crear|registra|registrar|agrega|agregar).*(cliente)/.test(normalized)) {
    return assistantToolCatalog.preparar_cliente;
  }

  if (/(crea|crear|registra|registrar|agrega|agregar).*(vehiculo|carro|camion)/.test(normalized)) {
    return assistantToolCatalog.preparar_vehiculo;
  }

  if (/(crea|crear|registra|registrar|agrega|agregar).*(conductor|chofer|transportista)/.test(normalized)) {
    return assistantToolCatalog.preparar_conductor;
  }

  if (/(crea|crear|registra|registrar|agrega|agregar).*(viaje)/.test(normalized)) {
    return assistantToolCatalog.preparar_viaje;
  }

  if (normalized.includes('proveedor')) {
    return assistantToolCatalog.consultar_viajes_proveedor;
  }

  if (normalized.includes('mantenimiento') || normalized.includes('aceite')) {
    return assistantToolCatalog.consultar_mantenimientos;
  }

  if (normalized.includes('cierre')) {
    return assistantToolCatalog.consultar_cierre_semanal;
  }

  if (
    (
      /(mas|mayor|menor|promedio|top|ranking|compara|comparar|genero|facturo|facturado|gano|ganado|sueldo|pago)/.test(normalized) &&
      /(vehiculo|cliente|conductor|chofer|transportista|destino|ruta|viaje|factur|utilidad|viatico|sueldo|pago)/.test(normalized)
    ) ||
    /(?:cuanto|cuantos|que).*(?:gano|recibio|cobro)/.test(normalized)
  ) {
    return assistantToolCatalog.analizar_operacion;
  }

  if (input.contexto?.consulta?.tipo === 'analitica_viajes') {
    return assistantToolCatalog.analizar_operacion;
  }

  if (
    normalized.includes('pendiente') ||
    normalized.includes('sin cobrar') ||
    normalized.includes('por cobrar') ||
    normalized.includes('cobro')
  ) {
    return assistantToolCatalog.consultar_viajes_pendientes;
  }

  if (
    normalized.includes('viaje') ||
    normalized.includes('facturacion') ||
    normalized.includes('utilidad') ||
    normalized.includes('ganancia') ||
    input.contexto?.consulta?.tipo === 'viajes'
  ) {
    return assistantToolCatalog.consultar_viajes;
  }

  return assistantToolCatalog.interpretar_solicitud;
};

export const assertAssistantToolAllowed = (
  tool: AssistantToolDefinition,
  user: JwtPayload | undefined,
  confirmed: boolean
) => {
  if (!user) {
    throw new AppError('Usuario no autenticado', 401);
  }

  if (!user.propietario_id) {
    throw new AppError('Debes seleccionar un propietario para usar el asistente', 400);
  }

  if (
    tool.scope === 'propietario' &&
    !user.es_super_admin &&
    user.es_propietario === false
  ) {
    throw new AppError('Esta solicitud requiere acceso a la flota propia', 403);
  }

  if (
    tool.scope === 'intermediario' &&
    !user.es_super_admin &&
    user.es_intermediario === false
  ) {
    throw new AppError('Esta solicitud requiere acceso de intermediario', 403);
  }

  if (tool.requiresConfirmation && !confirmed) {
    throw new AppError('Debes confirmar la accion antes de aplicarla', 400);
  }
};
