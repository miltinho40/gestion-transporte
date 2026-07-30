import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import type { AuditContext } from '../../utils/audit.js';
import { recordAuditEvent } from '../../utils/audit.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';

const aliasEntitySchema = z.object({
  alias: z.string().trim().min(2).max(80),
  entidad_tipo: z.enum(['vehiculo', 'conductor', 'cliente']),
  entidad_id: z.string().regex(/^\d+$/),
  entidad_nombre: z.string().trim().min(1).max(160)
});

type AliasEntityValue = z.infer<typeof aliasEntitySchema>;

const clientCargoSchema = z.object({
  cliente_id: z.string().regex(/^\d+$/),
  cliente_nombre: z.string().trim().min(1).max(160),
  tipo_carga_id: z.string().regex(/^\d+$/),
  tipo_carga_nombre: z.string().trim().min(1).max(120)
});

const habitualVehicleSchema = z.object({
  cliente_id: z.string().regex(/^\d+$/).nullable(),
  cliente_nombre: z.string().trim().min(1).max(160).nullable(),
  vehiculo_id: z.string().regex(/^\d+$/),
  vehiculo_placa: z.string().trim().min(1).max(30)
});

const vehicleDriverSchema = z.object({
  vehiculo_id: z.string().regex(/^\d+$/),
  vehiculo_placa: z.string().trim().min(1).max(30),
  conductor_id: z.string().regex(/^\d+$/),
  conductor_nombre: z.string().trim().min(1).max(160)
});

export type AssistantPreferenceScope = 'personal' | 'propietario';
export type AssistantPreferenceRecord = {
  id?: bigint;
  tipo: string;
  clave?: string;
  alcance: string;
  scope_key: string;
  valor: unknown;
  descripcion?: string | null;
};

type ClientCargoValue = z.infer<typeof clientCargoSchema>;
type HabitualVehicleValue = z.infer<typeof habitualVehicleSchema>;
type VehicleDriverValue = z.infer<typeof vehicleDriverSchema>;
type SupportedPreferenceValue =
  | AliasEntityValue
  | ClientCargoValue
  | HabitualVehicleValue
  | VehicleDriverValue;

type PreferenceDraft = {
  tipo: 'preferencia';
  titulo: string;
  campos: Record<string, string>;
  advertencias: string[];
};

type PreferenceAction = {
  label: string;
  route: string;
  query: Record<string, string>;
  operacion: 'guardar' | 'editar';
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const stripArticle = (value: string) =>
  value
    .trim()
    .replace(/^(?:el|la|los|las|un|una|al)\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();

const preferenceScope = (user: JwtPayload) => ({
  propietarioId: parseBigIntId(user.propietario_id, 'propietario_id'),
  usuarioId: parseBigIntId(user.usuario_id, 'usuario_id')
});

const personalScopeKey = (usuarioId: bigint) => `usuario:${usuarioId}`;

const requestedPreferenceScope = (
  user: JwtPayload,
  message: string
): { alcance: AssistantPreferenceScope; scopeKey: string } => {
  const normalized = normalize(message);
  const ownerScope =
    /\b(compartid[ao]|para todos|para el equipo|del propietario|para este propietario)\b/.test(
      normalized
    );
  const { usuarioId } = preferenceScope(user);
  if (!ownerScope) {
    return { alcance: 'personal', scopeKey: personalScopeKey(usuarioId) };
  }
  if (!user.es_super_admin && user.rol !== 'admin') {
    throw new AppError(
      'Solo un administrador puede guardar preferencias compartidas del propietario',
      403
    );
  }
  return { alcance: 'propietario', scopeKey: 'propietario' };
};

const aliasStatement = (message: string) => {
  const match = message.match(
    /(?:recuerda|recordar|memoriza|memorizar|guarda(?:r)?(?:\s+como\s+preferencia)?)(?:\s+que)?\s+(.+?)\s+(?:es|significa|se\s+refiere\s+a)\s+(.+?)[.!?]*$/i
  );
  if (!match?.[1] || !match[2]) return null;

  const alias = stripArticle(match[1]);
  const target = stripArticle(match[2]);
  if (!alias || !target || normalize(alias) === normalize(target)) return null;
  return { alias, target };
};

export const isAssistantPreferenceCommand = (message: string) => {
  const normalized = normalize(message);
  return (
    /\b(recuerda|recordar|memoriza|memorizar|preferencia|preferencias)\b/.test(normalized) ||
    /\b(habitual|habitualmente|normalmente|predeterminad[oa])\b/.test(normalized) ||
    /\b(olvida|olvidar|borra|elimina)\b.*\b(recuerdo|preferencia|que)\b/.test(normalized) ||
    normalized.includes('que recuerdas de mi') ||
    normalized.includes('que tienes guardado')
  );
};

export const listAssistantPreferences = async (user: JwtPayload) => {
  const { propietarioId, usuarioId } = preferenceScope(user);
  const preferences = await prisma.preferenciaAsistente.findMany({
    where: {
      propietario_id: propietarioId,
      scope_key: {
        in: [personalScopeKey(usuarioId), 'propietario']
      },
      activa: true
    },
    orderBy: [{ tipo: 'asc' }, { clave: 'asc' }],
    take: 100
  });
  return preferences.sort((left, right) => {
    const leftPriority = left.scope_key === personalScopeKey(usuarioId) ? 0 : 1;
    const rightPriority = right.scope_key === personalScopeKey(usuarioId) ? 0 : 1;
    return leftPriority - rightPriority || left.tipo.localeCompare(right.tipo);
  });
};

const parseAliasPreference = (value: unknown) => {
  const parsed = aliasEntitySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parsePreferenceValue = (tipo: string, value: unknown): SupportedPreferenceValue | null => {
  const schema =
    tipo === 'alias_entidad'
      ? aliasEntitySchema
      : tipo === 'tipo_carga_cliente'
        ? clientCargoSchema
        : tipo === 'vehiculo_habitual'
          ? habitualVehicleSchema
          : tipo === 'conductor_vehiculo'
            ? vehicleDriverSchema
            : null;
  if (!schema) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const targetMatches = (name: string, target: string) => {
  const normalizedName = normalize(name);
  const normalizedTarget = normalize(target);
  if (!normalizedName || !normalizedTarget) return false;
  if (normalizedName === normalizedTarget) return true;

  const targetWords = normalizedTarget.split(/\s+/).filter((word) => word.length >= 3);
  return targetWords.length > 0 && targetWords.every((word) => normalizedName.includes(word));
};

const resolveAliasTarget = async (
  propietarioId: bigint,
  alias: string,
  target: string
): Promise<AliasEntityValue | null> => {
  const normalizedAlias = normalize(alias);
  const normalizedTarget = normalize(target);
  const [vehiculos, conductores, clientes] = await Promise.all([
    prisma.vehiculo.findMany({
      where: { propietario_id: propietarioId },
      select: { id: true, placa: true, marca: true, modelo: true },
      orderBy: { placa: 'asc' },
      take: 300
    }),
    prisma.conductor.findMany({
      where: { propietario_id: propietarioId },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 300
    }),
    prisma.cliente.findMany({
      where: { propietario_id: propietarioId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 300
    })
  ]);

  const vehiculo = vehiculos.find((item) => normalizedTarget.includes(normalize(item.placa)));
  if (vehiculo) {
    return {
      alias: normalizedAlias,
      entidad_tipo: 'vehiculo',
      entidad_id: String(vehiculo.id),
      entidad_nombre: vehiculo.placa
    };
  }

  const preferConductor = /\b(conductor|chofer|transportista)\b/.test(normalizedAlias);
  const preferCliente = /\b(cliente|empresa)\b/.test(normalizedAlias);
  const conductor = conductores.find((item) => targetMatches(item.nombre, target));
  const cliente = clientes.find((item) => targetMatches(item.nombre, target));

  if (preferConductor && conductor) {
    return {
      alias: normalizedAlias,
      entidad_tipo: 'conductor',
      entidad_id: String(conductor.id),
      entidad_nombre: conductor.nombre
    };
  }
  if (preferCliente && cliente) {
    return {
      alias: normalizedAlias,
      entidad_tipo: 'cliente',
      entidad_id: String(cliente.id),
      entidad_nombre: cliente.nombre
    };
  }
  if (conductor && !cliente) {
    return {
      alias: normalizedAlias,
      entidad_tipo: 'conductor',
      entidad_id: String(conductor.id),
      entidad_nombre: conductor.nombre
    };
  }
  if (cliente && !conductor) {
    return {
      alias: normalizedAlias,
      entidad_tipo: 'cliente',
      entidad_id: String(cliente.id),
      entidad_nombre: cliente.nombre
    };
  }

  return null;
};

const entityIsMentioned = (name: string, message: string) => {
  const words = normalize(name)
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  const normalizedMessage = normalize(message);
  return words.length > 0 && words.every((word) => normalizedMessage.includes(word));
};

const resolveDefaultPreference = async (
  propietarioId: bigint,
  message: string
): Promise<
  | { tipo: 'tipo_carga_cliente'; clave: string; valor: ClientCargoValue }
  | { tipo: 'vehiculo_habitual'; clave: string; valor: HabitualVehicleValue }
  | { tipo: 'conductor_vehiculo'; clave: string; valor: VehicleDriverValue }
  | null
> => {
  const normalized = normalize(message);
  const [clientes, vehiculos, conductores, tiposCarga] = await Promise.all([
    prisma.cliente.findMany({
      where: { propietario_id: propietarioId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 500
    }),
    prisma.vehiculo.findMany({
      where: { propietario_id: propietarioId },
      select: { id: true, placa: true },
      orderBy: { placa: 'asc' },
      take: 500
    }),
    prisma.conductor.findMany({
      where: { propietario_id: propietarioId, estado: 'ACTIVO' },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 500
    }),
    prisma.tipoCarga.findMany({
      where: {
        activo: true,
        OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 500
    })
  ]);

  const cliente = clientes
    .filter((item) => entityIsMentioned(item.nombre, message))
    .sort((a, b) => b.nombre.length - a.nombre.length)[0];
  const vehiculo = vehiculos.find((item) => normalized.includes(normalize(item.placa)));
  const conductor = conductores
    .filter((item) => entityIsMentioned(item.nombre, message))
    .sort((a, b) => b.nombre.length - a.nombre.length)[0];
  const tipoCarga = tiposCarga
    .filter((item) => entityIsMentioned(item.nombre, message))
    .sort((a, b) => b.nombre.length - a.nombre.length)[0];

  if (
    vehiculo &&
    conductor &&
    /\b(conduce|conductor|chofer|transportista)\b/.test(normalized)
  ) {
    const valor: VehicleDriverValue = {
      vehiculo_id: String(vehiculo.id),
      vehiculo_placa: vehiculo.placa,
      conductor_id: String(conductor.id),
      conductor_nombre: conductor.nombre
    };
    return {
      tipo: 'conductor_vehiculo',
      clave: `vehiculo:${vehiculo.id}:conductor`,
      valor
    };
  }

  if (cliente && vehiculo) {
    const valor: HabitualVehicleValue = {
      cliente_id: String(cliente.id),
      cliente_nombre: cliente.nombre,
      vehiculo_id: String(vehiculo.id),
      vehiculo_placa: vehiculo.placa
    };
    return {
      tipo: 'vehiculo_habitual',
      clave: `cliente:${cliente.id}:vehiculo`,
      valor
    };
  }

  if (cliente && tipoCarga) {
    const valor: ClientCargoValue = {
      cliente_id: String(cliente.id),
      cliente_nombre: cliente.nombre,
      tipo_carga_id: String(tipoCarga.id),
      tipo_carga_nombre: tipoCarga.nombre
    };
    return {
      tipo: 'tipo_carga_cliente',
      clave: `cliente:${cliente.id}:tipo_carga`,
      valor
    };
  }

  if (
    vehiculo &&
    /\b(vehiculo|carro|camion|flota)\b/.test(normalized) &&
    /\b(habitual|habitualmente|normalmente|predeterminad[oa])\b/.test(normalized)
  ) {
    const valor: HabitualVehicleValue = {
      cliente_id: null,
      cliente_nombre: null,
      vehiculo_id: String(vehiculo.id),
      vehiculo_placa: vehiculo.placa
    };
    return {
      tipo: 'vehiculo_habitual',
      clave: 'viaje:vehiculo_habitual',
      valor
    };
  }

  return null;
};

const preferenceSummary = (tipo: string, value: SupportedPreferenceValue) => {
  if (tipo === 'alias_entidad') {
    const alias = value as AliasEntityValue;
    return `"${alias.alias}" significa ${alias.entidad_nombre} (${alias.entidad_tipo})`;
  }
  if (tipo === 'tipo_carga_cliente') {
    const cargo = value as ClientCargoValue;
    return `${cargo.tipo_carga_nombre} será el tipo de carga habitual de ${cargo.cliente_nombre}`;
  }
  if (tipo === 'vehiculo_habitual') {
    const vehicle = value as HabitualVehicleValue;
    return vehicle.cliente_nombre
      ? `${vehicle.vehiculo_placa} será el vehículo habitual de ${vehicle.cliente_nombre}`
      : `${vehicle.vehiculo_placa} será el vehículo habitual general`;
  }
  const driver = value as VehicleDriverValue;
  return `${driver.conductor_nombre} será el conductor habitual de ${driver.vehiculo_placa}`;
};

const buildDefaultPreferenceDraft = async (
  user: JwtPayload,
  message: string
) => {
  const { propietarioId } = preferenceScope(user);
  const resolved = await resolveDefaultPreference(propietarioId, message);
  if (!resolved) {
    return {
      tipo: 'consulta' as const,
      respuesta:
        'No pude identificar una regla completa. Indica registros existentes, por ejemplo: ' +
        '"Para TRANSPALFRA usa normalmente CARTONES".',
      cards: [],
      detalle: '',
      sugerencias: [
        'Mi vehículo habitual es OAA1227',
        'Vicente conduce normalmente el OAA1227'
      ]
    };
  }

  const scope = requestedPreferenceScope(user, message);
  const summary = preferenceSummary(resolved.tipo, resolved.valor);
  const draft: PreferenceDraft = {
    tipo: 'preferencia',
    titulo: 'Nuevo valor predeterminado',
    campos: {
      regla: summary,
      alcance: scope.alcance === 'personal' ? 'Personal' : 'Propietario'
    },
    advertencias: ['La regla solo se guardará después de tu confirmación.']
  };
  const action: PreferenceAction = {
    label: 'Guardar preferencia',
    route: '/assistant/preferences',
    query: {
      preference_action: 'upsert',
      clave: resolved.clave.slice(0, 120),
      tipo: resolved.tipo,
      alcance: scope.alcance,
      scope_key: scope.scopeKey,
      valor: JSON.stringify(resolved.valor),
      descripcion: summary
    },
    operacion: 'guardar'
  };

  return {
    tipo: 'borrador' as const,
    respuesta: `Puedo guardar esta regla ${scope.alcance}: ${summary}. Confirma para continuar.`,
    cards: [],
    detalle: '',
    draft,
    actions: [action],
    sugerencias: ['Cancelar']
  };
};

const buildAliasPreferenceDraft = async (
  user: JwtPayload,
  message: string
) => {
  const statement = aliasStatement(message);
  if (!statement) {
    return {
      tipo: 'consulta' as const,
      respuesta:
        'Puedo recordar alias vinculados a registros reales. Por ejemplo: "Recuerda que mi camión es OAA1227".',
      cards: [],
      detalle: '',
      sugerencias: ['¿Qué recuerdas de mí?']
    };
  }

  const { propietarioId } = preferenceScope(user);
  const value = await resolveAliasTarget(
    propietarioId,
    statement.alias,
    statement.target
  );
  if (!value) {
    return {
      tipo: 'consulta' as const,
      respuesta:
        `No pude vincular "${statement.target}" con un vehículo, conductor o cliente disponible. ` +
        'Indica una placa o el nombre completo del registro.',
      cards: [],
      detalle: '',
      sugerencias: ['¿Qué recuerdas de mí?']
    };
  }

  const scope = requestedPreferenceScope(user, message);
  const draft: PreferenceDraft = {
    tipo: 'preferencia',
    titulo: 'Nueva preferencia',
    campos: {
      alias: value.alias,
      tipo: value.entidad_tipo,
      registro: value.entidad_nombre,
      alcance: scope.alcance === 'personal' ? 'Personal' : 'Propietario'
    },
    advertencias: ['La preferencia solo se guardará después de tu confirmación.']
  };
  const action: PreferenceAction = {
    label: 'Guardar preferencia',
    route: '/assistant/preferences',
    query: {
      preference_action: 'upsert',
      clave: `alias:${value.alias}`.slice(0, 120),
      tipo: 'alias_entidad',
      alcance: scope.alcance,
      scope_key: scope.scopeKey,
      valor: JSON.stringify(value),
      descripcion: preferenceSummary('alias_entidad', value)
    },
    operacion: 'guardar'
  };

  return {
    tipo: 'borrador' as const,
    respuesta:
      `Puedo recordar que ${preferenceSummary('alias_entidad', value)} ` +
      `con alcance ${scope.alcance}. Confirma para guardarlo.`,
    cards: [],
    detalle: '',
    draft,
    actions: [action],
    sugerencias: ['Cancelar']
  };
};

const preferenceToText = (preference: {
  tipo: string;
  valor: unknown;
  descripcion: string | null;
  alcance?: string;
}) => {
  const value = parsePreferenceValue(preference.tipo, preference.valor);
  const summary = value
    ? preferenceSummary(preference.tipo, value)
    : preference.descripcion ?? 'Preferencia guardada';
  const scopeLabel = preference.alcance === 'propietario' ? 'Propietario' : 'Personal';
  return `[${scopeLabel}] ${summary}`;
};

const buildForgetPreferenceDraft = async (user: JwtPayload, message: string) => {
  const normalized = normalize(message);
  const preferences = await listAssistantPreferences(user);
  const candidates = preferences.filter((preference) => {
    const value = parsePreferenceValue(preference.tipo, preference.valor);
    if (!value) return false;
    if (preference.tipo === 'alias_entidad') {
      const alias = value as AliasEntityValue;
      return (
        normalized.includes(alias.alias) ||
        normalized.includes(normalize(alias.entidad_nombre))
      );
    }
    return normalized.includes(normalize(preference.descripcion ?? ''));
  });

  if (!candidates.length) {
    return {
      tipo: 'consulta' as const,
      respuesta: 'No encontré una preferencia activa que coincida con lo que deseas olvidar.',
      cards: [],
      detalle: '',
      sugerencias: ['¿Qué recuerdas de mí?']
    };
  }
  if (candidates.length > 1) {
    return {
      tipo: 'consulta' as const,
      respuesta: 'Encontré varias preferencias. Indica el alias exacto que deseas olvidar.',
      cards: [],
      detalle: candidates.map((item) => `- ${preferenceToText(item)}`).join('\n'),
      sugerencias: []
    };
  }

  const preference = candidates[0]!;
  const description = preferenceToText(preference);
  const draft: PreferenceDraft = {
    tipo: 'preferencia',
    titulo: 'Olvidar preferencia',
    campos: {
      preferencia: description
    },
    advertencias: ['La preferencia se desactivará después de tu confirmación.']
  };
  const action: PreferenceAction = {
    label: 'Olvidar preferencia',
    route: '/assistant/preferences',
    query: {
      preference_action: 'deactivate',
      id: String(preference.id),
      clave: preference.clave
    },
    operacion: 'editar'
  };

  return {
    tipo: 'borrador' as const,
    respuesta: `Puedo olvidar esta preferencia: ${description}. Confirma para continuar.`,
    cards: [],
    detalle: '',
    draft,
    actions: [action],
    sugerencias: ['Cancelar']
  };
};

export const consultAssistantPreferences = async (user: JwtPayload) => {
  const preferences = await listAssistantPreferences(user);
  const forgetSuggestions = preferences
    .slice(0, 4)
    .map((preference) => `Olvida ${preference.descripcion ?? preference.clave}`);

  return {
    tipo: 'consulta' as const,
    respuesta: preferences.length
      ? `Tengo ${preferences.length} preferencia(s) activa(s) para ti en este propietario.`
      : 'Todavía no tengo preferencias guardadas para ti en este propietario.',
    cards: [{ titulo: 'Preferencias', valor: String(preferences.length) }],
    detalle: preferences.length
      ? preferences.map((item, index) => `${index + 1}. ${preferenceToText(item)}`).join('\n')
      : '',
    sugerencias: preferences.length
      ? forgetSuggestions
      : ['Recuerda que mi camión es OAA1227']
  };
};

export const resolveAssistantTripDefaults = (
  preferences: AssistantPreferenceRecord[],
  context: {
    clienteId?: string;
    vehiculoId?: string;
  }
) => {
  const cargoPreference = context.clienteId
    ? preferences.find((preference) => {
        if (preference.tipo !== 'tipo_carga_cliente') return false;
        const value = clientCargoSchema.safeParse(preference.valor);
        return value.success && value.data.cliente_id === context.clienteId;
      })
    : undefined;

  const clientVehiclePreference = context.clienteId
    ? preferences.find((preference) => {
        if (preference.tipo !== 'vehiculo_habitual') return false;
        const value = habitualVehicleSchema.safeParse(preference.valor);
        return value.success && value.data.cliente_id === context.clienteId;
      })
    : undefined;
  const generalVehiclePreference = preferences.find((preference) => {
    if (preference.tipo !== 'vehiculo_habitual') return false;
    const value = habitualVehicleSchema.safeParse(preference.valor);
    return value.success && value.data.cliente_id === null;
  });
  const vehiclePreference = clientVehiclePreference ?? generalVehiclePreference;
  const vehicleValue = vehiclePreference
    ? habitualVehicleSchema.parse(vehiclePreference.valor)
    : null;
  const effectiveVehicleId = context.vehiculoId ?? vehicleValue?.vehiculo_id;

  const driverPreference = effectiveVehicleId
    ? preferences.find((preference) => {
        if (preference.tipo !== 'conductor_vehiculo') return false;
        const value = vehicleDriverSchema.safeParse(preference.valor);
        return value.success && value.data.vehiculo_id === effectiveVehicleId;
      })
    : undefined;

  const cargoValue = cargoPreference
    ? clientCargoSchema.parse(cargoPreference.valor)
    : null;
  const driverValue = driverPreference
    ? vehicleDriverSchema.parse(driverPreference.valor)
    : null;
  const source = (preference: AssistantPreferenceRecord | undefined) =>
    preference?.alcance === 'propietario' ? 'propietario' : 'personal';

  return {
    cargo: cargoValue
      ? {
          ...cargoValue,
          alcance: source(cargoPreference)
        }
      : null,
    vehiculo: vehicleValue
      ? {
          ...vehicleValue,
          alcance: source(vehiclePreference)
        }
      : null,
    conductor: driverValue
      ? {
          ...driverValue,
          alcance: source(driverPreference)
        }
      : null
  };
};

export const prepareAssistantPreference = async (
  user: JwtPayload,
  message: string
) => {
  const normalized = normalize(message);
  if (/\b(olvida|olvidar|borra|elimina)\b/.test(normalized)) {
    return buildForgetPreferenceDraft(user, message);
  }
  if (/\b(habitual|habitualmente|normalmente|predeterminad[oa])\b/.test(normalized)) {
    return buildDefaultPreferenceDraft(user, message);
  }
  return buildAliasPreferenceDraft(user, message);
};

const ensurePreferenceTarget = async (
  propietarioId: bigint,
  tipo: string,
  value: SupportedPreferenceValue
) => {
  if (tipo === 'tipo_carga_cliente') {
    const cargo = value as ClientCargoValue;
    const [cliente, tipoCarga] = await Promise.all([
      prisma.cliente.findFirst({
        where: {
          id: BigInt(cargo.cliente_id),
          propietario_id: propietarioId,
          activo: true
        },
        select: { id: true }
      }),
      prisma.tipoCarga.findFirst({
        where: {
          id: BigInt(cargo.tipo_carga_id),
          activo: true,
          OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
        },
        select: { id: true }
      })
    ]);
    if (!cliente || !tipoCarga) {
      throw new AppError('El cliente o tipo de carga ya no está disponible', 400);
    }
    return;
  }

  if (tipo === 'vehiculo_habitual') {
    const vehicle = value as HabitualVehicleValue;
    const [vehiculo, cliente] = await Promise.all([
      prisma.vehiculo.findFirst({
        where: { id: BigInt(vehicle.vehiculo_id), propietario_id: propietarioId },
        select: { id: true }
      }),
      vehicle.cliente_id
        ? prisma.cliente.findFirst({
            where: {
              id: BigInt(vehicle.cliente_id),
              propietario_id: propietarioId,
              activo: true
            },
            select: { id: true }
          })
        : Promise.resolve({ id: BigInt(0) })
    ]);
    if (!vehiculo || !cliente) {
      throw new AppError('El vehículo o cliente ya no está disponible', 400);
    }
    return;
  }

  if (tipo === 'conductor_vehiculo') {
    const driver = value as VehicleDriverValue;
    const [vehiculo, conductor] = await Promise.all([
      prisma.vehiculo.findFirst({
        where: { id: BigInt(driver.vehiculo_id), propietario_id: propietarioId },
        select: { id: true }
      }),
      prisma.conductor.findFirst({
        where: {
          id: BigInt(driver.conductor_id),
          propietario_id: propietarioId,
          estado: 'ACTIVO'
        },
        select: { id: true }
      })
    ]);
    if (!vehiculo || !conductor) {
      throw new AppError('El vehículo o conductor ya no está disponible', 400);
    }
    return;
  }

  const alias = value as AliasEntityValue;
  const id = BigInt(alias.entidad_id);
  const exists =
    alias.entidad_tipo === 'vehiculo'
      ? await prisma.vehiculo.findFirst({
          where: { id, propietario_id: propietarioId },
          select: { id: true }
        })
      : alias.entidad_tipo === 'conductor'
        ? await prisma.conductor.findFirst({
            where: { id, propietario_id: propietarioId },
            select: { id: true }
          })
        : await prisma.cliente.findFirst({
            where: { id, propietario_id: propietarioId, activo: true },
            select: { id: true }
          });

  if (!exists) {
    throw new AppError('El registro asociado a la preferencia ya no está disponible', 400);
  }
};

export const applyAssistantPreference = async (
  user: JwtPayload,
  input: AsistenteMensajeInput,
  audit?: AuditContext
) => {
  const action = input.contexto?.action;
  if (
    !input.contexto?.confirmar ||
    action?.route !== '/assistant/preferences' ||
    !['guardar', 'editar'].includes(action.operacion ?? '')
  ) {
    throw new AppError('La preferencia debe confirmarse antes de aplicarla', 400);
  }

  const { propietarioId, usuarioId } = preferenceScope(user);
  const preferenceAction = action.query['preference_action'];

  if (preferenceAction === 'deactivate') {
    const id = parseBigIntId(action.query['id'], 'preferencia_id');
    const current = await prisma.preferenciaAsistente.findFirst({
      where: {
        id,
        propietario_id: propietarioId,
        scope_key: {
          in: [personalScopeKey(usuarioId), 'propietario']
        },
        activa: true
      }
    });
    if (!current) throw new AppError('Preferencia activa no encontrada', 404);
    if (
      current.alcance === 'propietario' &&
      !user.es_super_admin &&
      user.rol !== 'admin'
    ) {
      throw new AppError(
        'Solo un administrador puede desactivar preferencias compartidas',
        403
      );
    }

    const updated = await prisma.preferenciaAsistente.update({
      where: { id: current.id },
      data: { activa: false }
    });
    await recordAuditEvent({
      ...audit,
      propietarioId,
      usuarioId,
      entidad: 'preferencia_asistente',
      entidadId: updated.id,
      accion: 'desactivar',
      resumen: current.descripcion ?? current.clave,
      antes: { activa: true },
      despues: { activa: false }
    });
    return {
      tipo: 'accion' as const,
      respuesta: `Listo, olvidé la preferencia: ${preferenceToText(current)}.`,
      cards: [{ titulo: 'Preferencia', valor: 'Desactivada' }],
      detalle: '',
      sugerencias: ['¿Qué recuerdas de mí?']
    };
  }

  if (preferenceAction !== 'upsert') {
    throw new AppError('Acción de preferencia no permitida', 400);
  }

  const tipo = String(action.query['tipo'] ?? '');
  const rawValue = JSON.parse(action.query['valor'] ?? '{}') as unknown;
  const value = parsePreferenceValue(tipo, rawValue);
  if (!value) throw new AppError('Valor de preferencia no permitido', 400);
  await ensurePreferenceTarget(propietarioId, tipo, value);
  const key = String(action.query['clave'] ?? '').trim().slice(0, 120);
  const allowedKey =
    (tipo === 'alias_entidad' && key.startsWith('alias:')) ||
    (tipo === 'tipo_carga_cliente' && /^cliente:\d+:tipo_carga$/.test(key)) ||
    (tipo === 'vehiculo_habitual' &&
      (/^cliente:\d+:vehiculo$/.test(key) || key === 'viaje:vehiculo_habitual')) ||
    (tipo === 'conductor_vehiculo' && /^vehiculo:\d+:conductor$/.test(key));
  if (!allowedKey) throw new AppError('Clave de preferencia no permitida', 400);

  const requestedScope = action.query['alcance'] === 'propietario'
    ? 'propietario'
    : 'personal';
  const expectedScope = requestedScope === 'propietario'
    ? requestedPreferenceScope(user, 'preferencia compartida para todos')
    : {
        alcance: 'personal' as const,
        scopeKey: personalScopeKey(usuarioId)
      };
  if (action.query['scope_key'] !== expectedScope.scopeKey) {
    throw new AppError('El alcance de la preferencia no es válido', 400);
  }
  const description = preferenceSummary(tipo, value);

  const preference = await prisma.preferenciaAsistente.upsert({
    where: {
      propietario_id_scope_key_clave: {
        propietario_id: propietarioId,
        scope_key: expectedScope.scopeKey,
        clave: key
      }
    },
    create: {
      propietario_id: propietarioId,
      usuario_id: usuarioId,
      alcance: expectedScope.alcance,
      scope_key: expectedScope.scopeKey,
      tipo,
      clave: key,
      valor: value as Prisma.InputJsonValue,
      descripcion: description,
      activa: true
    },
    update: {
      usuario_id: usuarioId,
      alcance: expectedScope.alcance,
      tipo,
      valor: value as Prisma.InputJsonValue,
      descripcion: description,
      activa: true
    }
  });
  await recordAuditEvent({
    ...audit,
    propietarioId,
    usuarioId,
    entidad: 'preferencia_asistente',
    entidadId: preference.id,
    accion: 'guardar',
    resumen: preference.descripcion,
    despues: { tipo: preference.tipo, clave: preference.clave, activa: true }
  });

  return {
    tipo: 'accion' as const,
    respuesta: `Listo, recordaré que ${description}.`,
    cards: [
      { titulo: 'Preferencia', valor: 'Guardada' },
      {
        titulo: 'Alcance',
        valor: expectedScope.alcance === 'personal' ? 'Personal' : 'Propietario'
      }
    ],
    detalle: '',
    sugerencias: ['¿Qué recuerdas de mí?']
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const accentInsensitivePattern = (value: string) =>
  [...normalize(value)]
    .map((character) => {
      if (character === 'a') return '[aáàäâ]';
      if (character === 'e') return '[eéèëê]';
      if (character === 'i') return '[iíìïî]';
      if (character === 'o') return '[oóòöô]';
      if (character === 'u') return '[uúùüû]';
      if (character === 'n') return '[nñ]';
      if (/\s/.test(character)) return '\\s+';
      return escapeRegExp(character);
    })
    .join('');

export const applyAssistantPreferencesToMessage = (
  message: string,
  preferences: Array<{ tipo: string; valor: unknown }>
) => {
  if (isAssistantPreferenceCommand(message)) {
    return { message, applied: [] as string[] };
  }

  let expanded = message;
  const applied: string[] = [];
  for (const preference of preferences) {
    if (preference.tipo !== 'alias_entidad') continue;
    const value = parseAliasPreference(preference.valor);
    if (!value) continue;

    const expression = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${accentInsensitivePattern(value.alias)})(?=$|[^\\p{L}\\p{N}])`,
      'giu'
    );
    if (!expression.test(expanded)) continue;
    expression.lastIndex = 0;
    expanded = expanded.replace(
      expression,
      (_match, prefix: string) => `${prefix}${value.entidad_nombre}`
    );
    applied.push(value.alias);
  }

  return { message: expanded, applied };
};

export const __testing = {
  aliasStatement,
  applyAssistantPreferencesToMessage,
  isAssistantPreferenceCommand,
  normalize,
  resolveAssistantTripDefaults
};
