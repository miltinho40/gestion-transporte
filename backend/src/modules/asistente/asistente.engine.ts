import { EstadoMantenimiento, EstadoViaje, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  getIsoWeekRange,
  getPagosSemanalesConductores
} from '../cierres-semanales/cierres-semanales.service.js';
import { createViaje, getViajeById, updateViaje } from '../viajes/viajes.service.js';
import { viajeCreateSchema, viajeUpdateSchema } from '../viajes/viajes.schema.js';
import {
  createMantenimiento,
  getMantenimientoById,
  updateMantenimiento
} from '../mantenimientos/mantenimientos.service.js';
import {
  mantenimientoCreateSchema,
  mantenimientoUpdateSchema
} from '../mantenimientos/mantenimientos.schema.js';
import { createCliente } from '../clientes/clientes.service.js';
import { clienteCreateSchema } from '../clientes/clientes.schema.js';
import { createVehiculo } from '../vehiculos/vehiculos.service.js';
import { vehiculoCreateSchema } from '../vehiculos/vehiculos.schema.js';
import { createConductor } from '../conductores/conductores.service.js';
import { conductorCreateSchema } from '../conductores/conductores.schema.js';
import type { AuditContext } from '../../utils/audit.js';
import { asistenteMensajeSchema } from './asistente.schema.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';
import type {
  AssistantExtractedParameters
} from './asistente.interpreter.js';
import type { AssistantToolName } from './asistente.tools.js';
import {
  resolveAssistantTripDefaults
} from './asistente.preferences.js';
import type {
  AssistantPreferenceRecord
} from './asistente.preferences.js';

type AssistantEngineInput = AsistenteMensajeInput & {
  herramienta?: AssistantToolName;
  entidades?: AssistantExtractedParameters;
  preferencias?: AssistantPreferenceRecord[];
};

type AssistantCard = {
  titulo: string;
  valor: string;
  detalle?: string;
};

type AssistantDraft = {
  tipo: 'viaje' | 'mantenimiento' | 'cliente' | 'vehiculo' | 'conductor';
  titulo: string;
  campos: Record<string, string>;
  advertencias: string[];
};

type AssistantAction = {
  label: string;
  route: string;
  query: Record<string, string>;
  operacion?: 'abrir' | 'guardar' | 'editar';
};

const openCreateFormAction = (
  normalized: string,
  tool?: AssistantToolName
): { respuesta: string; action: AssistantAction } | null => {
  const requested =
    tool === 'abrir_formulario' ||
    (/(abre|abrir|muestra|mostrar).*(modal|formulario|pantalla|nuevo|nueva)/.test(normalized) &&
      /(viaje|cliente|vehiculo|conductor)/.test(normalized));
  if (!requested) return null;

  const targets = [
    {
      matches: /\bclientes?\b/,
      singular: 'cliente',
      route: '/app/clientes'
    },
    {
      matches: /\bvehiculos?\b|\bcarros?\b/,
      singular: 'vehículo',
      route: '/app/vehiculos'
    },
    {
      matches: /\bconductores?\b|\bchofer(?:es)?\b|\btransportistas?\b/,
      singular: 'conductor',
      route: '/app/conductores'
    },
    {
      matches: /\bviajes?\b/,
      singular: 'viaje',
      route: '/app/viajes'
    }
  ] as const;
  const target = targets.find((item) => item.matches.test(normalized));
  if (!target) return null;

  return {
    respuesta: `Voy a abrir el formulario para crear un nuevo ${target.singular}.`,
    action: {
      label: `Nuevo ${target.singular}`,
      route: target.route,
      query: { new: '1' },
      operacion: 'abrir'
    }
  };
};

type AssistantQueryContext = {
  tipo: 'viajes';
  filtros: {
    cliente_id?: string;
    cliente_nombre?: string;
    vehiculo_id?: string;
    vehiculo_placa?: string;
    destino?: string;
    semana?: number;
    anio?: number;
    cobrado?: boolean;
  };
};

type AnalyticsMetric =
  | 'valor_a_facturar'
  | 'precio_viaje'
  | 'utilidad_viajes'
  | 'viaticos'
  | 'cantidad_viajes'
  | 'pago_conductor';
type AnalyticsDimension = 'vehiculo' | 'cliente' | 'conductor' | 'destino';
type AnalyticsAggregation = 'suma' | 'promedio' | 'conteo';
type AnalyticsOrder = 'asc' | 'desc';

type AssistantAnalyticsContext = {
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
    conductor_id?: string;
    conductor_nombre?: string;
  };
};

const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
] as const;

const MAX_ROUTE_SUGGESTIONS = 10;

const assistantStopWords = new Set([
  'a',
  'al',
  'carro',
  'con',
  'de',
  'del',
  'dejame',
  'el',
  'en',
  'la',
  'las',
  'le',
  'los',
  'me',
  'muestrame',
  'por',
  'que',
  'ultimo',
  'ultima',
  'un',
  'una',
  'vehiculo',
  'ver',
  'viaje'
]);

const repairMojibake = (value: string) =>
  value
    .replace(/Ã¡|ã¡/gi, 'a')
    .replace(/Ã©|ã©/gi, 'e')
    .replace(/Ã­|ã­/gi, 'i')
    .replace(/Ã³|ã³/gi, 'o')
    .replace(/Ãº|ãº/gi, 'u')
    .replace(/Ã±|ã±/gi, 'n');

const repairCommonEncodingIssues = (value: string) =>
  repairMojibake(value)
    .replace(/\u00c3\u00a1/gi, 'a')
    .replace(/\u00c3\u00a9/gi, 'e')
    .replace(/\u00c3\u00ad/gi, 'i')
    .replace(/\u00c3\u00b3/gi, 'o')
    .replace(/\u00c3\u00ba/gi, 'u')
    .replace(/\u00c3\u00b1/gi, 'n');

const normalizeText = (value: unknown) =>
  repairCommonEncodingIssues(String(value ?? ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const toMoney = (value: number | string | Prisma.Decimal | null | undefined) =>
  new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);

const money = (value: number | string | Prisma.Decimal | null | undefined) =>
  `$ ${toMoney(value).toFixed(2)}`;

const dateOnly = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? '-';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
};

const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const parseWeek = (message: string) => {
  const match = message.match(/(?:semana|sem)\s*#?\s*(\d{1,2})/i);
  const week = Number(match?.[1]);
  return Number.isInteger(week) && week >= 1 && week <= 53 ? week : null;
};

const parseYear = (message: string) => {
  const match = message.match(/\b(20\d{2})\b/);
  const year = Number(match?.[1]);
  return Number.isInteger(year) ? year : today().getUTCFullYear();
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const parseRelativeDate = (normalized: string) => {
  const base = today();
  if (normalized.includes('pasado manana') || normalized.includes('pasado maniana')) {
    return addDays(base, 2);
  }
  if (normalized.includes('manana') || normalized.includes('maniana')) {
    return addDays(base, 1);
  }
  if (normalized.includes('ayer')) {
    return addDays(base, -1);
  }
  return base;
};

const parseStructuredDate = (value: string | undefined, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parseMonth = (normalized: string) => {
  const index = monthNames.findIndex((name) => normalized.includes(name));
  if (index >= 0) return index;

  if (normalized.includes('mes pasado')) {
    const current = today();
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)).getUTCMonth();
  }

  return today().getUTCMonth();
};

const dateRangeFromMessage = (message: string, normalized: string) => {
  const week = parseWeek(message);
  const year = parseYear(message);

  if (week) {
    const { fechaInicio, fechaFin } = getIsoWeekRange(year, week);
    return {
      label: `semana ${week} de ${year}`,
      fechaInicio,
      fechaFin
    };
  }

  const month = parseMonth(normalized);
  const date = new Date(Date.UTC(year, month, 1));
  return {
    label: `${monthNames[month]} de ${year}`,
    fechaInicio: startOfMonth(date),
    fechaFin: endOfMonth(date)
  };
};

const viajeSemanaWhere = (fechaInicio: Date, fechaFin: Date): Prisma.ViajeWhereInput => ({
  OR: [
    { fecha_llegada: { gte: fechaInicio, lte: fechaFin } },
    { fecha_llegada: null, fecha_salida: { gte: fechaInicio, lte: fechaFin } }
  ]
});

const viajeProveedorSemanaWhere = (
  fechaInicio: Date,
  fechaFin: Date
): Prisma.ViajeProveedorWhereInput => ({
  OR: [
    { fecha_llegada: { gte: fechaInicio, lte: fechaFin } },
    { fecha_llegada: null, fecha_salida: { gte: fechaInicio, lte: fechaFin } }
  ]
});

const ownerWhere = (propietarioId: bigint | null) =>
  propietarioId ? { propietario_id: propietarioId } : {};

const topRowsText = (items: string[]) => (items.length ? items.join('\n') : 'No encontré registros para mostrar.');

const includesAll = (text: string, words: string[]) => words.every((word) => text.includes(word));
const textWords = (text: string) => new Set(text.split(/\s+/).filter(Boolean));
const hasWord = (words: Set<string>, word: string) => words.has(word);
const includesAllWords = (words: Set<string>, expected: string[]) => expected.every((word) => hasWord(words, word));
const wordCount = (text: string, word: string) => text.split(/\s+/).filter((item) => item === word).length;

const findCliente = async (propietarioId: bigint | null, normalized: string) => {
  const clientes = await prisma.cliente.findMany({
    where: {
      ...ownerWhere(propietarioId),
      activo: true
    },
    orderBy: { nombre: 'asc' },
    take: 200
  });

  return clientes.find((cliente) =>
    normalizeText(cliente.nombre)
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) => normalized.includes(word))
  );
};

const findConductor = async (propietarioId: bigint | null, normalized: string) => {
  const conductores = await prisma.conductor.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: 'ACTIVO'
    },
    orderBy: { nombre: 'asc' },
    take: 200
  });

  return conductores.find((conductor) =>
    normalizeText(conductor.nombre)
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) => normalized.includes(word))
  );
};

const findVehiculo = async (propietarioId: bigint | null, normalized: string) => {
  const vehiculos = await prisma.vehiculo.findMany({
    where: ownerWhere(propietarioId),
    orderBy: { placa: 'asc' },
    take: 200
  });

  return vehiculos.find((vehiculo) => normalized.includes(normalizeText(vehiculo.placa)));
};

const latestConductorForVehicle = async (
  propietarioId: bigint | null,
  vehiculoId: bigint
) => {
  const viaje = await prisma.viaje.findFirst({
    where: {
      ...ownerWhere(propietarioId),
      vehiculo_id: vehiculoId,
      estado: { not: EstadoViaje.CANCELADO }
    },
    select: {
      conductor: {
        select: {
          id: true,
          nombre: true,
          estado: true
        }
      }
    },
    orderBy: [
      { fecha_llegada: 'desc' },
      { fecha_salida: 'desc' },
      { id: 'desc' }
    ]
  });

  return viaje?.conductor.estado === 'ACTIVO' ? viaje.conductor : null;
};

type TarifaRutaMatch = Prisma.TarifaRutaGetPayload<{
  include: {
    ruta: true;
    tipo_carga: true;
  };
}>;

const tarifaOptionLabel = (tarifa: TarifaRutaMatch) =>
  [
    `${tarifa.ruta.origen} - ${tarifa.ruta.destino}`,
    tarifa.tipo_carga.nombre,
    tarifa.capacidad ? `cap. ${tarifa.capacidad}` : null,
    tarifa.toneladas ? `${toMoney(tarifa.toneladas).toFixed(2)} ton` : null,
    money(tarifa.precio)
  ]
    .filter(Boolean)
    .join(' | ');

const findTarifaRutaMatches = async (propietarioId: bigint | null, normalized: string) => {
  const tarifaWhere: Prisma.TarifaRutaWhereInput = propietarioId
    ? {
        propietario_id: { in: [propietarioId, BigInt(1)] },
        activa: true,
        ruta: {
          OR: [{ propietario_id: null }, { propietario_id: propietarioId }, { propietario_id: BigInt(1) }]
        }
      }
    : { activa: true };

  const tarifas = await prisma.tarifaRuta.findMany({
    where: tarifaWhere,
    include: {
      ruta: true,
      tipo_carga: true
    },
    orderBy: [{ ruta: { destino: 'asc' } }, { id: 'asc' }],
    take: 5000
  });

  const normalizedWords = textWords(normalized);
  const matches = tarifas.filter((tarifa) => {
    const optionText = normalizeText(tarifaOptionLabel(tarifa));
    const origenWords = normalizeText(tarifa.ruta.origen).split(/\s+/).filter((word) => word.length >= 3);
    const destinoWords = normalizeText(tarifa.ruta.destino).split(/\s+/).filter((word) => word.length >= 3);
    const tipoCargaWords = normalizeText(tarifa.tipo_carga.nombre)
      .split(/\s+/)
      .filter((word) => word.length >= 3);
    const selectedOption = optionText.includes(normalized) || normalized.includes(optionText);
    const sameOriginDestination = origenWords.length > 0 && includesAllWords(new Set(origenWords), destinoWords);
    const repeatedSameRouteWord =
      sameOriginDestination && destinoWords.some((word) => wordCount(normalized, word) >= 2);
    const routeMatch =
      includesAllWords(normalizedWords, destinoWords) &&
      (!origenWords.length || origenWords.some((word) => hasWord(normalizedWords, word))) &&
      (!sameOriginDestination || repeatedSameRouteWord);
    const cargoMatch = tipoCargaWords.length ? tipoCargaWords.some((word) => hasWord(normalizedWords, word)) : false;
    return selectedOption || routeMatch || (includesAllWords(normalizedWords, destinoWords) && cargoMatch);
  });

  return matches.sort((a, b) => {
    const aText = normalizeText(tarifaOptionLabel(a));
    const bText = normalizeText(tarifaOptionLabel(b));
    const aExact = normalized.includes(aText) || aText.includes(normalized) ? 1 : 0;
    const bExact = normalized.includes(bText) || bText.includes(normalized) ? 1 : 0;
    return bExact - aExact || Number(a.id - b.id);
  });
};

const findTarifaRuta = async (propietarioId: bigint | null, normalized: string) => {
  const matches = await findTarifaRutaMatches(propietarioId, normalized);
  return matches.length === 1 ? matches[0] : null;
};

const selectTarifaRuta = (matches: TarifaRutaMatch[], normalized: string) => {
  if (matches.length === 1) return matches[0];
  const exactMatches = matches.filter((tarifa) => normalized.includes(normalizeText(tarifaOptionLabel(tarifa))));
  return exactMatches.length === 1 ? exactMatches[0] : null;
};

const routeFieldMatches = (actual: string, expected: string | undefined) => {
  if (!expected) return true;
  const actualWords = new Set(textWords(normalizeText(actual)));
  const expectedWords = textWords(normalizeText(expected));
  return expectedWords.size > 0 && [...expectedWords].every((word) => actualWords.has(word));
};

const capacityFieldMatches = (actual: string | null, expected: string | undefined) => {
  if (!expected) return true;
  const expectedNumber = normalizeText(expected).match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
  const actualNumber = normalizeText(actual).match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');

  if (expectedNumber) return actualNumber === expectedNumber;
  return normalizeText(actual).includes(normalizeText(expected));
};

const narrowTarifaRutaMatches = (
  matches: TarifaRutaMatch[],
  entities: AssistantExtractedParameters | undefined
) => {
  if (!entities) return matches;

  return matches.filter(
    (tarifa) =>
      routeFieldMatches(tarifa.ruta.origen, entities.origen) &&
      routeFieldMatches(tarifa.ruta.destino, entities.destino) &&
      routeFieldMatches(tarifa.tipo_carga.nombre, entities.tipo_carga) &&
      capacityFieldMatches(tarifa.capacidad, entities.capacidad)
  );
};

const findTipoMantenimiento = async (propietarioId: bigint | null, normalized: string) => {
  const tipos = await prisma.tipoMantenimiento.findMany({
    where: propietarioId
      ? {
          activo: true,
          OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
        }
      : { activo: true },
    orderBy: { nombre: 'asc' },
    take: 200
  });

  return tipos.find((tipo) =>
    normalizeText(tipo.nombre)
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) => normalized.includes(word))
  );
};

const parseGuides = (message: string) => {
  const guiaSegment = message.match(/gu[ií]a(?:s)?\s*#?\s*([0-9,\-\s]+)/i)?.[1] ?? '';
  return guiaSegment
    .split(/[\s,;-]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{3,}$/.test(item));
};

const parseGuidesNormalized = (message: string) => {
  const guiaSegment = normalizeText(message).match(/guia(?:s)?\s*#?\s*([0-9,\-\s]+)/i)?.[1] ?? '';
  return guiaSegment
    .split(/[\s,;-]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{3,}$/.test(item));
};

const parseMoneyValue = (message: string) => {
  const match = message.match(/(?:flete|precio|valor|costo|por)\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/i);
  return match?.[1]?.replace(',', '.') ?? '';
};

const parseNamedMoneyValue = (message: string, labels: string[]) => {
  const normalizedLabels = labels.map((label) => normalizeText(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const match = normalizeText(message).match(
    new RegExp(`(?:${normalizedLabels.join('|')})\\s*\\$?\\s*(\\d+(?:[.,]\\d{1,2})?)`, 'i')
  );
  return match?.[1]?.replace(',', '.') ?? '';
};

const clientFieldValue = (message: string, labelPattern: string) => {
  const match = message.match(
    new RegExp(
      `(?:${labelPattern})\\s*:?\\s*(.+?)(?=\\s+(?:ruc|cedula|identificacion|telefono|celular|correo|email|contacto|direccion|comision|porcentaje)\\b|$)`,
      'i'
    )
  );
  return match?.[1]?.trim().replace(/[,.]+$/, '') ?? '';
};

const extractClientFields = (
  message: string,
  entities: AssistantExtractedParameters = {},
  nextMissing?: string
) => {
  const fields: Record<string, string> = {};
  const emailMatch = message.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const rucMatch = message.match(
    /(?:ruc(?:\/cedula)?|cedula|identificacion)\s*:?\s*([0-9A-Za-z-]{5,20})/i
  );
  const phoneMatch = message.match(
    /(?:telefono|celular|movil)\s*:?\s*(\+?[0-9][0-9\s-]{5,20})/i
  );
  const commissionMatch = message.match(
    /(?:comision|porcentaje)\s*:?\s*(\d+(?:[.,]\d{1,2})?)\s*%?/i
  );
  const nameFromText =
    clientFieldValue(
      message,
      '(?:crear|crea|registrar|registra|agregar|agrega)\\s+(?:un\\s+)?cliente(?:\\s+(?:nuevo|llamado|de nombre))?|nombre(?:\\s+del\\s+cliente)?'
    ) || clientFieldValue(message, 'cliente(?:\\s+(?:llamado|de nombre))?');

  const values = {
    nombre: entities.cliente ?? nameFromText,
    ruc_cedula: entities.ruc_cedula ?? rucMatch?.[1] ?? '',
    telefono: entities.telefono ?? phoneMatch?.[1]?.replace(/[\s-]+/g, '') ?? '',
    email: entities.email ?? emailMatch?.[0] ?? '',
    contacto_nombre:
      entities.contacto_nombre ??
      clientFieldValue(message, 'contacto(?:\\s+nombre)?'),
    direccion:
      entities.direccion ??
      clientFieldValue(message, 'direccion'),
    porcentaje_comision:
      entities.porcentaje_comision ??
      commissionMatch?.[1]?.replace(',', '.') ??
      ''
  };

  if (!values.nombre && nextMissing === 'nombre') {
    values.nombre = message.trim();
  }
  if (!values.ruc_cedula && nextMissing === 'RUC/cédula') {
    values.ruc_cedula = message.trim().replace(/\s+/g, '');
  }

  for (const [key, value] of Object.entries(values)) {
    const normalizedValue = String(value ?? '').trim();
    if (normalizedValue) fields[key] = normalizedValue;
  }

  return fields;
};

const vehicleFieldValue = (message: string, labelPattern: string) => {
  const match = message.match(
    new RegExp(
      `(?:${labelPattern})\\s*:?\\s*(.+?)(?=\\s+(?:placa|marca|modelo|color|año|anio|capacidad|toneladas?|kilometraje|km actual|rendimiento|categoria|peaje|estado|facturable)\\b|$)`,
      'i'
    )
  );
  return match?.[1]?.trim().replace(/[,.]+$/, '') ?? '';
};

const extractVehicleFields = (
  message: string,
  entities: AssistantExtractedParameters = {},
  nextMissing?: string
) => {
  const fields: Record<string, string> = {};
  const plateMatch = message.match(
    /(?:placa|vehiculo|vehículo|carro|camion|camión)\s*:?\s*([A-Z]{2,4}[-\s]?\d{3,4})\b/i
  );
  const tonnesMatch = message.match(
    /(?:(\d+(?:[.,]\d+)?)\s*toneladas?\b|toneladas?\s*:?\s*(\d+(?:[.,]\d+)?))/i
  );
  const numericValue = (pattern: RegExp) => pattern.exec(message)?.[1]?.replace(',', '.') ?? '';
  const values: Record<string, string> = {
    placa: entities.placa ?? entities.vehiculo ?? plateMatch?.[1]?.replace(/[-\s]/g, '').toUpperCase() ?? '',
    marca: entities.marca ?? vehicleFieldValue(message, 'marca'),
    modelo: entities.modelo ?? vehicleFieldValue(message, 'modelo'),
    color: entities.color ?? vehicleFieldValue(message, 'color'),
    anio:
      entities.anio ??
      numericValue(/(?:año|anio)\s*:?\s*(20\d{2}|19\d{2})\b/i),
    capacidad:
      entities.capacidad ??
      numericValue(/capacidad(?:\s+(?:de|para))?\s*:?\s*(\d+)\b/i),
    toneladas:
      entities.toneladas ??
      (tonnesMatch?.[1] ?? tonnesMatch?.[2] ?? '').replace(',', '.'),
    kilometraje_actual:
      entities.kilometraje_actual ??
      numericValue(/(?:kilometraje(?:\s+actual)?|km\s+actual)\s*:?\s*(\d+)\b/i),
    rendimiento_km_galon:
      entities.rendimiento_km_galon ??
      numericValue(/rendimiento(?:\s+km\/?galon)?\s*:?\s*(\d+(?:[.,]\d+)?)/i),
    categoria_peaje:
      entities.categoria_peaje ??
      vehicleFieldValue(message, 'categoria(?:\\s+de\\s+peaje)?|peaje'),
    estado: entities.estado ?? '',
    facturable: entities.facturable ?? ''
  };

  const bareValue = message.trim();
  const missingKey: Record<string, keyof typeof values> = {
    placa: 'placa',
    marca: 'marca',
    'categoría de peaje': 'categoria_peaje',
    capacidad: 'capacidad',
    toneladas: 'toneladas',
    'rendimiento km/galón': 'rendimiento_km_galon'
  };
  const targetKey = nextMissing ? missingKey[nextMissing] : undefined;
  if (targetKey && !values[targetKey]) {
    values[targetKey] =
      targetKey === 'placa'
        ? bareValue.replace(/[-\s]/g, '').toUpperCase()
        : bareValue;
  }

  if (!values.estado) {
    const normalized = normalizeText(message);
    values.estado = normalized.includes('mantenimiento')
      ? 'en_mantenimiento'
      : normalized.includes('en viaje')
        ? 'en_viaje'
        : normalized.includes('inactivo')
          ? 'inactivo'
          : '';
  }
  if (!values.facturable) {
    const normalized = normalizeText(message);
    if (normalized.includes('no facturable')) values.facturable = 'false';
    else if (normalized.includes('facturable')) values.facturable = 'true';
  }

  for (const [key, value] of Object.entries(values)) {
    const normalizedValue = String(value ?? '').trim();
    if (normalizedValue) fields[key] = normalizedValue;
  }

  return fields;
};

const normalizeAssistantDate = (value: string | undefined) => {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const localMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!localMatch) return '';

  const [, dayInput = '', monthInput = '', year = ''] = localMatch;
  const day = dayInput.padStart(2, '0');
  const month = monthInput.padStart(2, '0');
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  return dateOnly(date) === normalized ? normalized : '';
};

const conductorFieldValue = (message: string, labelPattern: string) => {
  const match = message.match(
    new RegExp(
      `(?:${labelPattern})\\s*:?\\s*(.+?)(?=\\s+(?:cedula|cédula|telefono|teléfono|celular|correo|email|licencia|caducidad|vence|nacimiento|sueldo|estado)\\b|$)`,
      'i'
    )
  );
  return match?.[1]?.trim().replace(/[,.]+$/, '') ?? '';
};

const extractConductorFields = (
  message: string,
  entities: AssistantExtractedParameters = {},
  nextMissing?: string
) => {
  const fields: Record<string, string> = {};
  const emailMatch = message.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const cedulaMatch = message.match(/(?:cedula|cédula)\s*:?\s*([0-9A-Za-z-]{5,20})/i);
  const phoneMatch = message.match(
    /(?:telefono|teléfono|celular|movil|móvil)\s*:?\s*(\+?[0-9][0-9\s-]{5,20})/i
  );
  const licenseMatch = message.match(
    /(?:numero|número|nro)?\s*(?:de\s+)?licencia\s*:?\s*([0-9A-Za-z-]{3,50})/i
  );
  const expiryMatch = message.match(
    /(?:caducidad(?:\s+de\s+licencia)?|licencia\s+(?:caduca|vence)|vence)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i
  );
  const birthMatch = message.match(
    /(?:fecha\s+de\s+nacimiento|nacimiento)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i
  );
  const salaryMatch = message.match(
    /(?:sueldo(?:\s+semanal)?)\s*:?\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/i
  );
  const nameFromText =
    conductorFieldValue(
      message,
      '(?:crear|crea|registrar|registra|agregar|agrega)\\s+(?:un\\s+)?(?:conductor|chofer|transportista)(?:\\s+(?:nuevo|llamado|de nombre))?'
    ) ||
    conductorFieldValue(message, 'nombre(?:\\s+del\\s+conductor)?');
  const values: Record<string, string> = {
    nombre: entities.conductor ?? nameFromText,
    cedula: entities.cedula ?? cedulaMatch?.[1] ?? '',
    telefono: entities.telefono ?? phoneMatch?.[1]?.replace(/[\s-]+/g, '') ?? '',
    email: entities.email ?? emailMatch?.[0] ?? '',
    numero_licencia: entities.numero_licencia ?? licenseMatch?.[1] ?? '',
    fecha_caducidad_licencia: normalizeAssistantDate(
      entities.fecha_caducidad_licencia ?? expiryMatch?.[1]
    ),
    fecha_nacimiento: normalizeAssistantDate(
      entities.fecha_nacimiento ?? birthMatch?.[1]
    ),
    sueldo_semanal:
      entities.sueldo_semanal ??
      salaryMatch?.[1]?.replace(',', '.') ??
      '',
    estado: entities.estado ?? ''
  };
  const missingKey: Record<string, keyof typeof values> = {
    nombre: 'nombre',
    'cédula': 'cedula',
    'teléfono': 'telefono',
    'número de licencia': 'numero_licencia',
    'fecha de caducidad de licencia': 'fecha_caducidad_licencia'
  };
  const targetKey = nextMissing ? missingKey[nextMissing] : undefined;
  if (targetKey && !values[targetKey]) {
    values[targetKey] =
      targetKey === 'fecha_caducidad_licencia'
        ? normalizeAssistantDate(message)
        : message.trim();
  }

  for (const [key, value] of Object.entries(values)) {
    const normalizedValue = String(value ?? '').trim();
    if (normalizedValue) fields[key] = normalizedValue;
  }

  return fields;
};

const nextMissingSuggestion = (missing: string[]) =>
  missing.length ? `Indica ${missing.slice(0, 3).join(', ')}.` : 'Abrir formulario para revisar y guardar.';

const actionsForDraft = (action: AssistantAction, tipo: AssistantDraft['tipo'], missing: string[]) =>
  action.operacion === 'editar' || missing.length
    ? [action]
    : [
        action,
        {
          ...action,
          label:
            tipo === 'viaje'
              ? 'Guardar viaje'
              : tipo === 'mantenimiento'
                ? 'Guardar mantenimiento'
                : tipo === 'cliente'
                  ? 'Guardar cliente'
                  : tipo === 'vehiculo'
                    ? 'Guardar vehículo'
                    : 'Guardar conductor',
          operacion: 'guardar' as const
        }
      ];

const assistantRecordId = (normalized: string, tipo: 'viaje' | 'mantenimiento') => {
  const match = normalized.match(new RegExp(`${tipo}\\s*#?\\s*(\\d+)`));
  return match?.[1] ?? '';
};

const buildEditDraftFromText = async (
  propietarioId: bigint | null,
  message: string,
  normalized: string
) => {
  const tipo = normalized.includes('mantenimiento') ? 'mantenimiento' : normalized.includes('viaje') ? 'viaje' : null;
  if (!tipo || !/(edita|editar|modifica|modificar|cambia|cambiar|actualiza|actualizar)/.test(normalized)) {
    return null;
  }

  const id = assistantRecordId(normalized, tipo);
  if (!id) {
    throw new AppError(`Indica el número del ${tipo} que quieres modificar.`, 400);
  }

  if (tipo === 'viaje') {
    const viaje = await getViajeById(propietarioId, id);
    const changes: Record<string, string> = {};
    const precio = parseNamedMoneyValue(message, ['precio', 'flete', 'precio viaje', 'valor']);
    const viaticos = parseNamedMoneyValue(message, ['viatico', 'viaticos']);
    const guias = parseGuidesNormalized(message);
    if (precio) changes.precio_flete = precio;
    if (viaticos) changes.viaticos = viaticos;
    if (guias.length) changes.numeros_guia_remision = guias.join(', ');
    if (!Object.keys(changes).length) {
      throw new AppError('Indica qué quieres modificar: precio, viáticos o guías.', 400);
    }

    return {
      tipo,
      draft: {
        tipo,
        titulo: `Cambios para viaje ${id}`,
        campos: {
          registro: id,
          fecha: dateOnly(viaje.fecha_salida),
          cliente: viaje.cliente.nombre,
          cambios: Object.entries(changes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ')
        },
        advertencias: ['Todavía no se ha modificado el viaje. Revisa los cambios y confirma.']
      } satisfies AssistantDraft,
      action: {
        label: 'Confirmar modificación',
        route: '/app/viajes',
        query: { id, ...changes },
        operacion: 'editar' as const
      }
    };
  }

  const mantenimiento = await getMantenimientoById(propietarioId, id);
  const changes: Record<string, string> = {};
  const costo = parseNamedMoneyValue(message, ['costo', 'valor', 'precio']);
  const km = message.match(/(?:km|kilometraje)\s*[:=]?\s*(\d+)/i)?.[1] ?? '';
  const descripcion = message.match(/(?:descripcion|detalle)\s*[:=]?\s*(.+)$/i)?.[1]?.trim() ?? '';
  if (costo) changes.costo_total = costo;
  if (km) changes.kilometraje_actual_vehiculo = km;
  if (descripcion) changes.descripcion = descripcion;
  if (!Object.keys(changes).length) {
    throw new AppError('Indica qué quieres modificar: costo, kilometraje o descripción.', 400);
  }

  return {
    tipo,
    draft: {
      tipo,
      titulo: `Cambios para mantenimiento ${id}`,
      campos: {
        registro: id,
        fecha: dateOnly(mantenimiento.fecha_mantenimiento),
        vehiculo: mantenimiento.vehiculo.placa,
        tipo: mantenimiento.tipo_mantenimiento.nombre,
        cambios: Object.entries(changes)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ')
      },
      advertencias: ['Todavía no se ha modificado el mantenimiento. Revisa los cambios y confirma.']
    } satisfies AssistantDraft,
    action: {
      label: 'Confirmar modificación',
      route: '/app/mantenimientos',
      query: { id, ...changes },
      operacion: 'editar' as const
    }
  };
};

const missingFromDraft = (draft: AssistantDraft) =>
  draft.tipo === 'viaje'
    ? [
        draft.campos['cliente'] === 'Por confirmar' ? 'cliente' : '',
        draft.campos['ruta'] === 'Por confirmar' ? 'ruta/precio' : '',
        draft.campos['vehiculo'] === 'Por confirmar' ? 'vehiculo' : '',
        draft.campos['conductor'] === 'Por confirmar' ? 'conductor' : '',
        draft.campos['viaticos'] === 'Por confirmar' ? 'viaticos' : ''
      ].filter((item): item is string => Boolean(item))
    : draft.tipo === 'mantenimiento'
      ? [
        draft.campos['vehiculo'] === 'Por confirmar' ? 'vehiculo' : '',
        draft.campos['tipo'] === 'Por confirmar' ? 'tipo de mantenimiento' : '',
        draft.campos['costo'] === 'Por confirmar' ? 'costo' : ''
      ].filter((item): item is string => Boolean(item))
      : draft.tipo === 'cliente'
        ? [
            draft.campos['nombre'] === 'Por confirmar' ? 'nombre' : '',
            draft.campos['ruc_cedula'] === 'Por confirmar' ? 'RUC/cédula' : '',
            draft.advertencias.some((warning) => warning.includes('con ese RUC/cédula'))
              ? 'RUC/cédula diferente'
              : ''
          ].filter((item): item is string => Boolean(item))
        : draft.tipo === 'vehiculo'
          ? [
              draft.campos['placa'] === 'Por confirmar' ? 'placa' : '',
              draft.campos['marca'] === 'Por confirmar' ? 'marca' : '',
              draft.campos['categoria_peaje'] === 'Por confirmar' ? 'categoría de peaje' : '',
              draft.campos['capacidad'] === 'Por confirmar' ? 'capacidad' : '',
              draft.campos['toneladas'] === 'Por confirmar' ? 'toneladas' : '',
              draft.campos['rendimiento'] === 'Por confirmar' ? 'rendimiento km/galón' : '',
              draft.advertencias.some((warning) => warning.includes('con esa placa'))
                ? 'placa diferente'
                : ''
            ].filter((item): item is string => Boolean(item))
          : [
              draft.campos['nombre'] === 'Por confirmar' ? 'nombre' : '',
              draft.campos['cedula'] === 'Por confirmar' ? 'cédula' : '',
              draft.campos['telefono'] === 'Por confirmar' ? 'teléfono' : '',
              draft.campos['numero_licencia'] === 'Por confirmar' ? 'número de licencia' : '',
              draft.campos['caducidad_licencia'] === 'Por confirmar'
                ? 'fecha de caducidad de licencia'
                : '',
              draft.advertencias.some((warning) => warning.includes('con esa cédula'))
                ? 'cédula diferente'
                : '',
              draft.advertencias.some((warning) => warning.includes('con esa licencia'))
                ? 'licencia diferente'
                : '',
              draft.advertencias.some((warning) => warning.includes('nacimiento no puede'))
                ? 'fecha de nacimiento válida'
                : ''
            ].filter((item): item is string => Boolean(item));

const billingPreviewFields = (
  priceInput: string | undefined,
  percentageInput: Prisma.Decimal | string | number | null | undefined
) => {
  if (!priceInput || percentageInput === null || percentageInput === undefined) {
    return {
      porcentaje_cliente: 'Por confirmar',
      valor_comision: 'Por confirmar',
      a_facturar: 'Por confirmar'
    };
  }

  const price = toMoney(priceInput);
  const percentage = toMoney(percentageInput);
  const commission = price
    .mul(percentage)
    .div(100)
    .toDecimalPlaces(2);

  return {
    porcentaje_cliente: `${percentage.toFixed(2)}%`,
    valor_comision: commission.toFixed(2),
    a_facturar: price.minus(commission).toDecimalPlaces(2).toFixed(2)
  };
};

const findCategoriaPeajeMatches = async (searchText: string) => {
  const normalized = normalizeText(searchText);
  if (!normalized) return [];

  const ejeMatch = normalized.match(/(\d+)\s*ejes?/);
  const numeroEjes = ejeMatch ? Number(ejeMatch[1]) : null;
  const categorias = await prisma.categoriaPeaje.findMany({
    where: { activo: true },
    orderBy: [{ propietario_id: 'asc' }, { nombre: 'asc' }]
  });

  return categorias.filter((categoria) => {
    const name = normalizeText(categoria.nombre);
    return (
      normalized === name ||
      normalized.includes(name) ||
      name.includes(normalized) ||
      (numeroEjes !== null && categoria.numero_ejes === numeroEjes)
    );
  });
};

const selectCategoriaPeaje = (
  matches: Awaited<ReturnType<typeof findCategoriaPeajeMatches>>,
  searchText: string
) => {
  const normalized = normalizeText(searchText);
  return (
    matches.find((categoria) => normalizeText(categoria.nombre) === normalized) ??
    (matches.length === 1 ? matches[0] : null)
  );
};

const buildClienteDraftFromQuery = async (
  propietarioId: bigint | null,
  query: Record<string, string>
) => {
  const [duplicateRuc, duplicateName] = propietarioId
    ? await Promise.all([
        query['ruc_cedula']
          ? prisma.cliente.findFirst({
              where: {
                propietario_id: propietarioId,
                ruc_cedula: query['ruc_cedula']
              }
            })
          : null,
        query['nombre']
          ? prisma.cliente.findFirst({
              where: {
                propietario_id: propietarioId,
                nombre: {
                  equals: query['nombre'],
                  mode: 'insensitive'
                }
              }
            })
          : null
      ])
    : [null, null];
  const missing = [
    !query['nombre'] ? 'nombre' : '',
    !query['ruc_cedula'] ? 'RUC/cédula' : ''
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    'Aún no guardo el cliente desde el chat.',
    duplicateRuc
      ? `Ya existe el cliente ${duplicateRuc.nombre} con ese RUC/cédula. Indica uno diferente.`
      : '',
    !duplicateRuc && duplicateName
      ? `Ya existe un cliente llamado ${duplicateName.nombre}. Verifica que no sea un duplicado.`
      : '',
    missing.length
      ? `Falta completar: ${missing.join(', ')}.`
      : 'Los datos obligatorios están completos y listos para confirmar.'
  ].filter(Boolean);

  return {
    draft: {
      tipo: 'cliente' as const,
      titulo: 'Borrador de cliente',
      campos: {
        nombre: query['nombre'] ?? 'Por confirmar',
        ruc_cedula: query['ruc_cedula'] ?? 'Por confirmar',
        telefono: query['telefono'] ?? 'No indicado',
        email: query['email'] ?? 'No indicado',
        contacto: query['contacto_nombre'] ?? 'No indicado',
        direccion: query['direccion'] ?? 'No indicada',
        comision: `${query['porcentaje_comision'] ?? '0'}%`
      },
      advertencias: warnings
    } satisfies AssistantDraft,
    missing,
    duplicateRuc: Boolean(duplicateRuc)
  };
};

const buildVehiculoDraftFromQuery = async (
  propietarioId: bigint | null,
  query: Record<string, string>
) => {
  const [duplicatePlate, categoria] = await Promise.all([
    propietarioId && query['placa']
      ? prisma.vehiculo.findFirst({
          where: {
            propietario_id: propietarioId,
            placa: {
              equals: query['placa'],
              mode: 'insensitive'
            }
          }
        })
      : null,
    query['categoria_peaje_id']
      ? prisma.categoriaPeaje.findFirst({
          where: {
            id: BigInt(query['categoria_peaje_id']),
            activo: true
          }
        })
      : null
  ]);
  const isPositive = (value?: string) => Number.isFinite(Number(value)) && Number(value) > 0;
  const missing = [
    !query['placa'] ? 'placa' : '',
    !query['marca'] ? 'marca' : '',
    !categoria ? 'categoría de peaje' : '',
    !isPositive(query['capacidad']) ? 'capacidad' : '',
    !isPositive(query['toneladas']) ? 'toneladas' : '',
    !isPositive(query['rendimiento_km_galon']) ? 'rendimiento km/galón' : ''
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    'Aún no guardo el vehículo desde el chat.',
    duplicatePlate
      ? `Ya existe un vehículo con esa placa (${duplicatePlate.placa}). Indica una placa diferente.`
      : '',
    missing.length
      ? `Falta completar: ${missing.join(', ')}.`
      : 'Los datos obligatorios están completos y listos para confirmar.'
  ].filter(Boolean);

  return {
    draft: {
      tipo: 'vehiculo' as const,
      titulo: 'Borrador de vehículo',
      campos: {
        placa: query['placa'] ?? 'Por confirmar',
        marca: query['marca'] ?? 'Por confirmar',
        modelo: query['modelo'] ?? 'No indicado',
        color: query['color'] ?? 'No indicado',
        anio: query['anio'] ?? 'No indicado',
        categoria_peaje: categoria?.nombre ?? 'Por confirmar',
        capacidad: query['capacidad'] ?? 'Por confirmar',
        toneladas: query['toneladas'] ?? 'Por confirmar',
        kilometraje: query['kilometraje_actual'] ?? '0',
        rendimiento: query['rendimiento_km_galon'] ?? 'Por confirmar',
        estado: query['estado'] ?? 'disponible',
        facturable: query['facturable'] === 'false' ? 'No' : 'Sí'
      },
      advertencias: warnings
    } satisfies AssistantDraft,
    missing,
    duplicatePlate: Boolean(duplicatePlate)
  };
};

const buildConductorDraftFromQuery = async (
  propietarioId: bigint | null,
  query: Record<string, string>
) => {
  const [duplicateCedula, duplicateLicense] = propietarioId
    ? await Promise.all([
        query['cedula']
          ? prisma.conductor.findFirst({
              where: {
                propietario_id: propietarioId,
                cedula: query['cedula']
              }
            })
          : null,
        query['numero_licencia']
          ? prisma.conductor.findFirst({
              where: {
                propietario_id: propietarioId,
                numero_licencia: query['numero_licencia']
              }
            })
          : null
      ])
    : [null, null];
  const expiry = query['fecha_caducidad_licencia']
    ? new Date(`${query['fecha_caducidad_licencia']}T00:00:00.000Z`)
    : null;
  const licenseExpired = Boolean(expiry && expiry < today());
  const birthDate = query['fecha_nacimiento']
    ? new Date(`${query['fecha_nacimiento']}T00:00:00.000Z`)
    : null;
  const invalidBirthDate = Boolean(birthDate && birthDate > today());
  const missing = [
    !query['nombre'] ? 'nombre' : '',
    !query['cedula'] ? 'cédula' : '',
    !query['telefono'] ? 'teléfono' : '',
    !query['numero_licencia'] ? 'número de licencia' : '',
    !query['fecha_caducidad_licencia'] ? 'fecha de caducidad de licencia' : ''
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    'Aún no guardo el conductor desde el chat.',
    duplicateCedula
      ? `Ya existe el conductor ${duplicateCedula.nombre} con esa cédula. Indica una diferente.`
      : '',
    duplicateLicense
      ? `Ya existe el conductor ${duplicateLicense.nombre} con esa licencia. Indica una diferente.`
      : '',
    invalidBirthDate
      ? 'La fecha de nacimiento no puede estar en el futuro.'
      : '',
    licenseExpired
      ? 'La licencia está vencida; el conductor se guardará con estado licencia vencida.'
      : '',
    missing.length
      ? `Falta completar: ${missing.join(', ')}.`
      : 'Los datos obligatorios están completos y listos para confirmar.'
  ].filter(Boolean);

  return {
    draft: {
      tipo: 'conductor' as const,
      titulo: 'Borrador de conductor',
      campos: {
        nombre: query['nombre'] ?? 'Por confirmar',
        cedula: query['cedula'] ?? 'Por confirmar',
        telefono: query['telefono'] ?? 'Por confirmar',
        email: query['email'] ?? 'No indicado',
        fecha_nacimiento: query['fecha_nacimiento'] ?? 'No indicada',
        numero_licencia: query['numero_licencia'] ?? 'Por confirmar',
        caducidad_licencia: query['fecha_caducidad_licencia'] ?? 'Por confirmar',
        sueldo_semanal: query['sueldo_semanal'] ?? '0',
        estado: licenseExpired ? 'licencia_vencida' : query['estado'] ?? 'activo'
      },
      advertencias: warnings
    } satisfies AssistantDraft,
    missing,
    duplicate: Boolean(duplicateCedula || duplicateLicense),
    invalidBirthDate,
    licenseExpired
  };
};

const buildViajeDraftFromQuery = async (query: Record<string, string>) => {
  const [cliente, conductor, vehiculo, tarifa] = await Promise.all([
    query['cliente_id'] ? prisma.cliente.findUnique({ where: { id: BigInt(query['cliente_id']) } }) : null,
    query['conductor_id'] ? prisma.conductor.findUnique({ where: { id: BigInt(query['conductor_id']) } }) : null,
    query['vehiculo_id'] ? prisma.vehiculo.findUnique({ where: { id: BigInt(query['vehiculo_id']) } }) : null,
    query['tarifa_ruta_id']
      ? prisma.tarifaRuta.findUnique({
          where: { id: BigInt(query['tarifa_ruta_id']) },
          include: { ruta: true }
        })
      : null
  ]);
  const missing = [
    !query['cliente_id'] ? 'cliente' : '',
    !query['tarifa_ruta_id'] ? 'ruta/precio' : '',
    !query['vehiculo_id'] ? 'vehiculo' : '',
    !query['conductor_id'] ? 'conductor' : '',
    !query['precio_flete'] ? 'precio' : '',
    !query['viaticos'] ? 'viaticos' : ''
  ].filter((item): item is string => Boolean(item));

  return {
    tipo: 'viaje' as const,
    titulo: 'Borrador de viaje',
    campos: {
      fecha_salida: query['fecha_salida'] ?? 'Por confirmar',
      fecha_entrega: query['fecha_llegada'] ?? 'Por confirmar',
      cliente: cliente?.nombre ?? 'Por confirmar',
      ruta: tarifa ? `${tarifa.ruta.origen} - ${tarifa.ruta.destino}` : 'Por confirmar',
      conductor: conductor?.nombre ?? 'Por confirmar',
      vehiculo: vehiculo?.placa ?? 'Por confirmar',
      guias: query['numeros_guia_remision'] ?? 'Por confirmar',
      precio_viaje: query['precio_flete'] ?? 'Por confirmar',
      ...billingPreviewFields(
        query['precio_flete'],
        cliente?.porcentaje_comision
      ),
      viaticos: query['viaticos'] ?? 'Por confirmar',
      costo_real_gasto: query['viaticos'] ?? 'Por confirmar'
    },
    advertencias: [
      'Aun no guardo el viaje desde el chat.',
      missing.length ? `Falta completar: ${missing.join(', ')}.` : 'Ya tengo los datos principales para abrir el formulario.'
    ],
    missing
  };
};

const buildMantenimientoDraftFromQuery = async (query: Record<string, string>) => {
  const [vehiculo, tipo] = await Promise.all([
    query['vehiculo_id'] ? prisma.vehiculo.findUnique({ where: { id: BigInt(query['vehiculo_id']) } }) : null,
    query['tipo_mantenimiento_id']
      ? prisma.tipoMantenimiento.findUnique({ where: { id: BigInt(query['tipo_mantenimiento_id']) } })
      : null
  ]);
  const missing = [
    !query['vehiculo_id'] ? 'vehiculo' : '',
    !query['tipo_mantenimiento_id'] ? 'tipo de mantenimiento' : '',
    !query['costo_total'] ? 'costo' : ''
  ].filter((item): item is string => Boolean(item));

  return {
    tipo: 'mantenimiento' as const,
    titulo: 'Borrador de mantenimiento',
    campos: {
      fecha: query['fecha_mantenimiento'] ?? 'Por confirmar',
      vehiculo: vehiculo ? `${vehiculo.placa} - ${vehiculo.marca}` : 'Por confirmar',
      tipo: tipo?.nombre ?? 'Por confirmar',
      costo: query['costo_total'] ?? 'Por confirmar'
    },
    advertencias: [
      'Aun no guardo el mantenimiento desde el chat.',
      missing.length ? `Falta completar: ${missing.join(', ')}.` : 'Ya tengo los datos principales para abrir el formulario.'
    ],
    missing
  };
};

const completeDraftFromContext = async (
  propietarioId: bigint | null,
  input: AsistenteMensajeInput,
  normalized: string,
  preferences: AssistantPreferenceRecord[] = []
): Promise<{ draft: AssistantDraft; action: AssistantAction | null; sugerencias: string[] } | null> => {
  const contextAction = input.contexto?.action;
  const contextDraft = input.contexto?.draft;
  if (!contextAction || !contextDraft) return null;

  const query = { ...contextAction.query };

  if (contextDraft.tipo === 'cliente') {
    const current = await buildClienteDraftFromQuery(propietarioId, query);
    const fields = extractClientFields(input.mensaje, {}, current.missing[0]);
    Object.assign(query, fields);

    const result = await buildClienteDraftFromQuery(propietarioId, query);
    return {
      draft: result.draft,
      action: { ...contextAction, query },
      sugerencias: result.duplicateRuc
        ? ['Indica otro RUC/cédula', 'Cancelar']
        : result.missing.length
          ? [`Indica ${result.missing[0]}.`, 'Cancelar']
          : ['Agregar teléfono, correo u otros datos', 'Cancelar']
    };
  }

  if (contextDraft.tipo === 'vehiculo') {
    const current = await buildVehiculoDraftFromQuery(propietarioId, query);
    const fields = extractVehicleFields(input.mensaje, {}, current.missing[0]);
    Object.assign(query, fields);

    const categorySearch = fields['categoria_peaje'] ?? '';
    const categoryMatches = categorySearch
      ? await findCategoriaPeajeMatches(categorySearch)
      : [];
    const categoria = selectCategoriaPeaje(categoryMatches, categorySearch);
    if (categoria) query['categoria_peaje_id'] = String(categoria.id);

    const result = await buildVehiculoDraftFromQuery(propietarioId, query);
    const categorySuggestions =
      !categoria && categoryMatches.length > 1
        ? categoryMatches.map((item) => `Categoría: ${item.nombre}`)
        : [];
    return {
      draft: categorySuggestions.length
        ? {
            ...result.draft,
            advertencias: [
              'Aún no guardo el vehículo desde el chat.',
              `Encontré ${categoryMatches.length} categorías de peaje. Elige una.`
            ]
          }
        : result.draft,
      action: { ...contextAction, query },
      sugerencias: categorySuggestions.length
        ? categorySuggestions
        : result.duplicatePlate
          ? ['Indica una placa diferente', 'Cancelar']
          : result.missing.length
            ? [`Indica ${result.missing[0]}.`, 'Cancelar']
            : ['Agregar modelo, color u otros datos', 'Cancelar']
    };
  }

  if (contextDraft.tipo === 'conductor') {
    const current = await buildConductorDraftFromQuery(propietarioId, query);
    const fields = extractConductorFields(input.mensaje, {}, current.missing[0]);
    Object.assign(query, fields);

    const result = await buildConductorDraftFromQuery(propietarioId, query);
    if (result.licenseExpired) query['estado'] = 'licencia_vencida';
    return {
      draft: result.draft,
      action: { ...contextAction, query },
      sugerencias: result.duplicate
        ? ['Indica una cédula o licencia diferente', 'Cancelar']
        : result.invalidBirthDate
          ? ['Corrige la fecha de nacimiento', 'Cancelar']
          : result.missing.length
            ? [`Indica ${result.missing[0]}.`, 'Cancelar']
            : ['Agregar correo, nacimiento o sueldo', 'Cancelar']
    };
  }

  if (contextDraft.tipo === 'viaje') {
    const [cliente, conductor, vehiculo] = await Promise.all([
      findCliente(propietarioId, normalized),
      findConductor(propietarioId, normalized),
      findVehiculo(propietarioId, normalized)
    ]);
    const guias = parseGuidesNormalized(input.mensaje);
    const precio = parseNamedMoneyValue(input.mensaje, ['precio', 'flete', 'precio viaje', 'valor']);
    const viaticos = parseNamedMoneyValue(input.mensaje, ['viatico', 'viaticos']);

    if (cliente) query['cliente_id'] = String(cliente.id);
    if (conductor) query['conductor_id'] = String(conductor.id);
    if (vehiculo) query['vehiculo_id'] = String(vehiculo.id);
    const defaults = resolveAssistantTripDefaults(preferences, {
      clienteId: query['cliente_id'],
      vehiculoId: query['vehiculo_id']
    });
    const appliedDefaults: string[] = [];
    if (!query['vehiculo_id'] && defaults.vehiculo) {
      query['vehiculo_id'] = defaults.vehiculo.vehiculo_id;
      appliedDefaults.push(
        `Preferencia ${defaults.vehiculo.alcance}: vehículo ${defaults.vehiculo.vehiculo_placa}`
      );
    }
    if (!query['conductor_id'] && defaults.conductor) {
      query['conductor_id'] = defaults.conductor.conductor_id;
      appliedDefaults.push(
        `Preferencia ${defaults.conductor.alcance}: conductor ${defaults.conductor.conductor_nombre}`
      );
    }

    const preferredCargo = !query['tarifa_ruta_id'] ? defaults.cargo : null;
    const tariffSearchText = normalizeText(
      [normalized, preferredCargo?.tipo_carga_nombre ?? ''].join(' ')
    );
    const tarifaMatches = await findTarifaRutaMatches(
      propietarioId,
      tariffSearchText
    );
    const tarifa = selectTarifaRuta(tarifaMatches, tariffSearchText);
    if (preferredCargo) {
      appliedDefaults.push(
        `Preferencia ${preferredCargo.alcance}: tipo de carga ${preferredCargo.tipo_carga_nombre}`
      );
    }
    if (tarifa) {
      query['tarifa_ruta_id'] = String(tarifa.id);
      if (!query['precio_flete']) query['precio_flete'] = tarifa.precio.toFixed(2);
    }
    if (precio) query['precio_flete'] = precio;
    if (viaticos) query['viaticos'] = viaticos;
    if (guias.length) query['numeros_guia_remision'] = guias.join(', ');

    const { missing, ...draft } = await buildViajeDraftFromQuery(query);
    const routeSuggestions =
      !query['tarifa_ruta_id'] && tarifaMatches.length > 1
        ? tarifaMatches.slice(0, MAX_ROUTE_SUGGESTIONS).map((item) => `Ruta: ${tarifaOptionLabel(item)}`)
        : [];
    return {
      draft: routeSuggestions.length
        ? {
            ...draft,
            advertencias: [
              'Aun no guardo el viaje desde el chat.',
              `Encontre ${tarifaMatches.length} precios que coinciden. Elige una ruta/precio.`,
              ...appliedDefaults.map((item) => `${item}.`)
            ]
          }
        : {
            ...draft,
            advertencias: [
              ...draft.advertencias,
              ...appliedDefaults.map((item) => `${item}.`)
            ]
          },
      action: { ...contextAction, query },
      sugerencias: routeSuggestions.length ? routeSuggestions : [nextMissingSuggestion(missing), 'Abrir viaje prellenado']
    };
  }

  const [vehiculo, tipo] = await Promise.all([
    findVehiculo(propietarioId, normalized),
    findTipoMantenimiento(propietarioId, normalized)
  ]);
  const costo = parseNamedMoneyValue(input.mensaje, ['costo', 'valor', 'precio']);

  if (vehiculo) query['vehiculo_id'] = String(vehiculo.id);
  if (tipo) query['tipo_mantenimiento_id'] = String(tipo.id);
  if (costo) query['costo_total'] = costo;

  const { missing, ...draft } = await buildMantenimientoDraftFromQuery(query);
  return {
    draft,
    action: { ...contextAction, query },
    sugerencias: [nextMissingSuggestion(missing), 'Abrir mantenimiento prellenado']
  };
};

const buildDraftFromText = async (
  propietarioId: bigint | null,
  message: string,
  normalized: string,
  tool?: AssistantToolName,
  entities?: AssistantExtractedParameters,
  preferences: AssistantPreferenceRecord[] = []
): Promise<{ draft: AssistantDraft; action: AssistantAction | null; sugerencias?: string[] } | null> => {
  const structuredText = normalizeText(
    [normalized, ...Object.values(entities ?? {})].join(' ')
  );

  if (
    tool === 'preparar_cliente' ||
    /(crea|crear|registra|registrar|agrega|agregar).*(cliente)/.test(normalized)
  ) {
    const query: Record<string, string> = {
      new: '1',
      porcentaje_comision: '0',
      ...extractClientFields(message, entities)
    };
    const result = await buildClienteDraftFromQuery(propietarioId, query);

    return {
      draft: result.draft,
      action: {
        label: 'Abrir cliente prellenado',
        route: '/app/clientes',
        query
      },
      sugerencias: result.duplicateRuc
        ? ['Indica otro RUC/cédula', 'Cancelar']
        : result.missing.length
          ? [`Indica ${result.missing[0]}.`, 'Cancelar']
          : ['Agregar teléfono, correo u otros datos', 'Cancelar']
    };
  }

  if (
    tool === 'preparar_vehiculo' ||
    /(crea|crear|registra|registrar|agrega|agregar).*(vehiculo|carro|camion)/.test(normalized)
  ) {
    const fields = extractVehicleFields(message, entities);
    const categorySearch = fields['categoria_peaje'] ?? '';
    const categoryMatches = categorySearch
      ? await findCategoriaPeajeMatches(categorySearch)
      : [];
    const categoria = selectCategoriaPeaje(categoryMatches, categorySearch);
    const query: Record<string, string> = {
      new: '1',
      kilometraje_actual: '0',
      rendimiento_km_galon: '16',
      estado: 'disponible',
      facturable: 'true',
      ...fields
    };
    if (categoria) query['categoria_peaje_id'] = String(categoria.id);

    const result = await buildVehiculoDraftFromQuery(propietarioId, query);
    const categorySuggestions =
      !categoria && categoryMatches.length > 1
        ? categoryMatches.map((item) => `Categoría: ${item.nombre}`)
        : [];

    return {
      draft: categorySuggestions.length
        ? {
            ...result.draft,
            advertencias: [
              'Aún no guardo el vehículo desde el chat.',
              `Encontré ${categoryMatches.length} categorías de peaje. Elige una.`
            ]
          }
        : result.draft,
      action: {
        label: 'Abrir vehículo prellenado',
        route: '/app/vehiculos',
        query
      },
      sugerencias: categorySuggestions.length
        ? categorySuggestions
        : result.duplicatePlate
          ? ['Indica una placa diferente', 'Cancelar']
          : result.missing.length
            ? [`Indica ${result.missing[0]}.`, 'Cancelar']
            : ['Agregar modelo, color u otros datos', 'Cancelar']
    };
  }

  if (
    tool === 'preparar_conductor' ||
    /(crea|crear|registra|registrar|agrega|agregar).*(conductor|chofer|transportista)/.test(normalized)
  ) {
    const fields = extractConductorFields(message, entities);
    const query: Record<string, string> = {
      new: '1',
      sueldo_semanal: '0',
      estado: 'activo',
      ...fields
    };
    const result = await buildConductorDraftFromQuery(propietarioId, query);
    if (result.licenseExpired) query['estado'] = 'licencia_vencida';

    return {
      draft: result.draft,
      action: {
        label: 'Abrir conductor prellenado',
        route: '/app/conductores',
        query
      },
      sugerencias: result.duplicate
        ? ['Indica una cédula o licencia diferente', 'Cancelar']
        : result.invalidBirthDate
          ? ['Corrige la fecha de nacimiento', 'Cancelar']
          : result.missing.length
            ? [`Indica ${result.missing[0]}.`, 'Cancelar']
            : ['Agregar correo, nacimiento o sueldo', 'Cancelar']
    };
  }

  if (
    tool === 'preparar_mantenimiento' ||
    /(crea|crear|registra|registrar|agrega|agregar).*(mantenimiento)/.test(normalized)
  ) {
    const fecha = parseStructuredDate(
      entities?.fecha_mantenimiento,
      parseRelativeDate(structuredText)
    );
    const [vehiculo, tipo] = await Promise.all([
      findVehiculo(propietarioId, normalizeText(entities?.vehiculo ?? structuredText)),
      findTipoMantenimiento(
        propietarioId,
        normalizeText(entities?.tipo_mantenimiento ?? structuredText)
      )
    ]);
    const costo =
      entities?.costo_total ??
      parseNamedMoneyValue(message, ['costo', 'valor', 'precio']);
    const query: Record<string, string> = {
      new: '1',
      fecha_mantenimiento: dateOnly(fecha)
    };
    if (vehiculo) query['vehiculo_id'] = String(vehiculo.id);
    if (tipo) query['tipo_mantenimiento_id'] = String(tipo.id);
    if (costo) query['costo_total'] = costo;

    return {
      draft: {
        tipo: 'mantenimiento',
        titulo: 'Borrador de mantenimiento',
        campos: {
          fecha: dateOnly(fecha),
          vehiculo: vehiculo ? `${vehiculo.placa} - ${vehiculo.marca}` : 'Por confirmar',
          tipo: tipo?.nombre ?? 'Por confirmar',
          costo: costo || 'Por confirmar'
        },
        advertencias: [
          'Aun no guardo el mantenimiento desde el chat.',
          vehiculo && tipo ? 'Puedo abrir el formulario prellenado para confirmar.' : 'Faltan datos para completar el formulario.'
        ]
      },
      action: {
        label: 'Abrir mantenimiento prellenado',
        route: '/app/mantenimientos',
        query
      }
    };
  }

  if (
    tool === 'preparar_viaje' ||
    /(crea|crear|registra|registrar|agrega|agregar).*(viaje)/.test(normalized)
  ) {
    const fechaSalida = parseStructuredDate(
      entities?.fecha_salida,
      parseRelativeDate(structuredText)
    );
    const fechaLlegada = addDays(fechaSalida, 1);
    const [cliente, explicitConductor, explicitVehicle] = await Promise.all([
      findCliente(propietarioId, normalizeText(entities?.cliente ?? structuredText)),
      findConductor(propietarioId, normalizeText(entities?.conductor ?? structuredText)),
      findVehiculo(propietarioId, normalizeText(entities?.vehiculo ?? structuredText))
    ]);
    let vehiculo = explicitVehicle;
    let conductor = explicitConductor;
    const defaults = resolveAssistantTripDefaults(preferences, {
      clienteId: cliente ? String(cliente.id) : undefined,
      vehiculoId: vehiculo ? String(vehiculo.id) : undefined
    });
    const appliedDefaults: string[] = [];

    if (!vehiculo && defaults.vehiculo) {
      vehiculo = (await prisma.vehiculo.findFirst({
        where: {
          id: BigInt(defaults.vehiculo.vehiculo_id),
          ...ownerWhere(propietarioId)
        }
      })) ?? undefined;
      if (vehiculo) {
        appliedDefaults.push(
          `Preferencia ${defaults.vehiculo.alcance}: vehículo ${vehiculo.placa}`
        );
      }
    }
    if (!conductor && defaults.conductor) {
      conductor = (await prisma.conductor.findFirst({
        where: {
          id: BigInt(defaults.conductor.conductor_id),
          ...ownerWhere(propietarioId),
          estado: 'ACTIVO'
        }
      })) ?? undefined;
      if (conductor) {
        appliedDefaults.push(
          `Preferencia ${defaults.conductor.alcance}: conductor ${conductor.nombre}`
        );
      }
    }

    const preferredCargo = !entities?.tipo_carga ? defaults.cargo : null;
    if (preferredCargo) {
      appliedDefaults.push(
        `Preferencia ${preferredCargo.alcance}: tipo de carga ${preferredCargo.tipo_carga_nombre}`
      );
    }
    const effectiveEntities = preferredCargo
      ? {
          ...entities,
          tipo_carga: preferredCargo.tipo_carga_nombre
        }
      : entities;
    const tariffSearchText = normalizeText(
      [structuredText, preferredCargo?.tipo_carga_nombre ?? ''].join(' ')
    );
    const tarifaMatchesRaw = await findTarifaRutaMatches(
      propietarioId,
      tariffSearchText
    );
    const tarifaMatches = narrowTarifaRutaMatches(
      tarifaMatchesRaw,
      effectiveEntities
    );
    const tarifa = selectTarifaRuta(tarifaMatches, tariffSearchText);
    const guias = entities?.numeros_guia_remision
      ? entities.numeros_guia_remision
          .split(/[\s,;-]+/)
          .map((item) => item.trim())
          .filter((item) => /^\d{3,}$/.test(item))
      : parseGuidesNormalized(message);
    const precio =
      entities?.precio_flete ??
      parseNamedMoneyValue(message, [
        'precio viaje',
        'precio del viaje',
        'precio',
        'flete',
        'valor del viaje'
      ]);
    const viaticos =
      entities?.viaticos ??
      parseNamedMoneyValue(message, ['viatico', 'viaticos']);
    const suggestedConductor =
      !conductor && vehiculo
        ? await latestConductorForVehicle(propietarioId, vehiculo.id)
        : null;
    const query: Record<string, string> = {
      new: '1',
      fecha_salida: dateOnly(fechaSalida),
      fecha_llegada: dateOnly(fechaLlegada)
    };
    if (cliente) query['cliente_id'] = String(cliente.id);
    if (conductor) query['conductor_id'] = String(conductor.id);
    if (vehiculo) query['vehiculo_id'] = String(vehiculo.id);
    if (tarifa) {
      query['tarifa_ruta_id'] = String(tarifa.id);
      query['precio_flete'] = precio || tarifa.precio.toFixed(2);
    } else if (precio) {
      query['precio_flete'] = precio;
    }
    if (guias.length) query['numeros_guia_remision'] = guias.join(', ');
    if (viaticos) query['viaticos'] = viaticos;

    const routeSuggestions =
      !tarifa && tarifaMatches.length > 1
        ? tarifaMatches.slice(0, MAX_ROUTE_SUGGESTIONS).map((item) => `Ruta: ${tarifaOptionLabel(item)}`)
        : [];
    const driverSuggestions = suggestedConductor
      ? [
          `Conductor: ${suggestedConductor.nombre}`,
          'Indicar otro conductor'
        ]
      : [];

    return {
      draft: {
        tipo: 'viaje',
        titulo: 'Borrador de viaje',
        campos: {
          fecha_salida: dateOnly(fechaSalida),
          fecha_entrega: dateOnly(fechaLlegada),
          cliente: cliente?.nombre ?? 'Por confirmar',
          ruta: tarifa ? `${tarifa.ruta.origen} - ${tarifa.ruta.destino}` : 'Por confirmar',
          conductor: conductor?.nombre ?? 'Por confirmar',
          vehiculo: vehiculo?.placa ?? 'Por confirmar',
          guias: guias.join(', ') || 'Por confirmar',
          precio_viaje: query['precio_flete'] ?? 'Por confirmar',
          ...billingPreviewFields(
            query['precio_flete'],
            cliente?.porcentaje_comision
          ),
          viaticos: query['viaticos'] ?? 'Por confirmar',
          costo_real_gasto: query['viaticos'] ?? 'Por confirmar'
        },
        advertencias: [
          'Aun no guardo el viaje desde el chat.',
          tarifa
            ? 'La ruta/precio fue encontrada en tus precios.'
            : routeSuggestions.length
              ? `Encontre ${tarifaMatches.length} precios que coinciden. Elige una ruta/precio.`
              : 'No encontre una tarifa de ruta clara.',
          ...appliedDefaults.map((item) => `${item}.`),
          suggestedConductor
            ? `Falta conductor. El ultimo utilizado en ${vehiculo?.placa} fue ${suggestedConductor.nombre}.`
            : conductor
              ? 'El conductor fue identificado.'
              : 'Falta indicar el conductor.'
        ]
      },
      action: {
        label: 'Abrir viaje prellenado',
        route: '/app/viajes',
        query
      },
      sugerencias: routeSuggestions.length
        ? routeSuggestions
        : driverSuggestions
    };
  }

  return null;
};

const pendingOwnTrips = async (propietarioId: bigint | null) => {
  const rows = await prisma.viaje.findMany({
    where: {
      ...ownerWhere(propietarioId),
      cobrado: false,
      estado: { not: EstadoViaje.CANCELADO }
    },
    include: {
      cliente: true,
      vehiculo: true,
      tarifa_ruta: { include: { ruta: true } }
    },
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { id: 'desc' }],
    take: 8
  });

  const total = rows.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_real_flete)), toMoney(0));

  return {
    respuesta:
      rows.length === 0
        ? 'No encontré viajes propios pendientes de cobro.'
        : `Tienes ${rows.length} viaje(s) propio(s) pendientes de cobro en la muestra reciente, por ${money(total)}.`,
    cards: [
      { titulo: 'Pendientes de cobro', valor: String(rows.length), detalle: 'Viajes propios recientes' },
      { titulo: 'A facturar', valor: money(total), detalle: 'Suma de la muestra' }
    ],
    detalle: topRowsText(
      rows.map(
        (viaje) =>
          `${dateOnly(viaje.fecha_llegada ?? viaje.fecha_salida)} | ${viaje.cliente.nombre} | ${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino} | ${viaje.vehiculo.placa} | ${money(viaje.precio_real_flete)}`
      )
    )
  };
};

const pendingProviderTrips = async (propietarioId: bigint | null) => {
  const rows = await prisma.viajeProveedor.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: { not: EstadoViaje.CANCELADO },
      OR: [{ cobrado: false }, { pagado_proveedor: false }]
    },
    include: {
      cliente: true,
      proveedor: true,
      tarifa_ruta: { include: { ruta: true } }
    },
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { id: 'desc' }],
    take: 8
  });

  const porCobrar = rows.filter((viaje) => !viaje.cobrado);
  const porPagar = rows.filter((viaje) => !viaje.pagado_proveedor);
  const totalCobrar = porCobrar.reduce((sum, viaje) => sum.plus(toMoney(viaje.valor_a_facturar)), toMoney(0));
  const totalPagar = porPagar.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_pagar_proveedor)), toMoney(0));

  return {
    respuesta: `En viajes de proveedores encontré ${porCobrar.length} por cobrar y ${porPagar.length} por pagar en la muestra reciente.`,
    cards: [
      { titulo: 'Por cobrar', valor: money(totalCobrar), detalle: `${porCobrar.length} viaje(s)` },
      { titulo: 'Por pagar', valor: money(totalPagar), detalle: `${porPagar.length} viaje(s)` }
    ],
    detalle: topRowsText(
      rows.map(
        (viaje) =>
          `${dateOnly(viaje.fecha_llegada ?? viaje.fecha_salida)} | ${viaje.cliente.nombre} | ${viaje.proveedor.nombre} | ${viaje.tarifa_ruta.ruta.destino} | cobrar: ${viaje.cobrado ? 'si' : 'no'} | pagar: ${viaje.pagado_proveedor ? 'si' : 'no'}`
      )
    )
  };
};

const maintenanceSummary = async (propietarioId: bigint | null, input: string, normalized: string) => {
  const range = dateRangeFromMessage(input, normalized);
  const rows = await prisma.mantenimiento.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: EstadoMantenimiento.REALIZADO,
      fecha_mantenimiento: { gte: range.fechaInicio, lte: range.fechaFin }
    },
    include: {
      vehiculo: true,
      tipo_mantenimiento: true
    },
    orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }],
    take: 8
  });

  const total = rows.reduce((sum, item) => sum.plus(toMoney(item.costo_total)), toMoney(0));

  return {
    respuesta: `Encontré ${rows.length} mantenimiento(s) realizado(s) en ${range.label}, por ${money(total)}.`,
    cards: [
      { titulo: 'Mantenimientos', valor: String(rows.length), detalle: range.label },
      { titulo: 'Costo total', valor: money(total), detalle: 'Muestra consultada' }
    ],
    detalle: topRowsText(
      rows.map(
        (item) =>
          `${dateOnly(item.fecha_mantenimiento)} | ${item.vehiculo.placa} | ${item.tipo_mantenimiento.nombre} | ${money(item.costo_total)}`
      )
    )
  };
};

const travelSummary = async (propietarioId: bigint | null, input: string, normalized: string) => {
  const range = dateRangeFromMessage(input, normalized);
  const rows = await prisma.viaje.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: { not: EstadoViaje.CANCELADO },
      ...viajeSemanaWhere(range.fechaInicio, range.fechaFin)
    },
    include: {
      cliente: true,
      vehiculo: true,
      tarifa_ruta: { include: { ruta: true } }
    },
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { id: 'desc' }],
    take: 12
  });

  const totalViajes = rows.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_flete)), toMoney(0));
  const facturar = rows.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_real_flete)), toMoney(0));
  const utilidad = rows.reduce(
    (sum, viaje) => sum.plus(toMoney(viaje.precio_real_flete).minus(toMoney(viaje.costo_real_gastos))),
    toMoney(0)
  );

  return {
    respuesta: `En ${range.label} encontré ${rows.length} viaje(s) propio(s). Valor a facturar: ${money(facturar)}. Utilidad viajes: ${money(utilidad)}.`,
    cards: [
      { titulo: 'Viajes', valor: String(rows.length), detalle: range.label },
      { titulo: 'Precio viaje', valor: money(totalViajes) },
      { titulo: 'A facturar', valor: money(facturar) },
      { titulo: 'Utilidad viajes', valor: money(utilidad) }
    ],
    detalle: topRowsText(
      rows.slice(0, 6).map(
        (viaje) =>
          `${dateOnly(viaje.fecha_llegada ?? viaje.fecha_salida)} | ${viaje.cliente.nombre} | ${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino} | ${money(viaje.precio_real_flete)}`
      )
    )
  };
};

const parseCobradoFilter = (normalized: string) => {
  if (normalized.includes('no cobrados') || normalized.includes('sin cobrar') || normalized.includes('por cobrar')) {
    return false;
  }
  if (normalized.includes('cobrados') || normalized.includes('cobrado')) {
    return true;
  }
  return undefined;
};

const analyticsMetrics = new Set<AnalyticsMetric>([
  'valor_a_facturar',
  'precio_viaje',
  'utilidad_viajes',
  'viaticos',
  'cantidad_viajes',
  'pago_conductor'
]);
const analyticsDimensions = new Set<AnalyticsDimension>([
  'vehiculo',
  'cliente',
  'conductor',
  'destino'
]);

const currentIsoWeek = () => {
  const date = today();
  const day = date.getUTCDay() || 7;
  const thursday = addDays(date, 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return {
    anio: thursday.getUTCFullYear(),
    semana: Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  };
};

const parseAnalyticsPlan = (
  message: string,
  normalized: string,
  entities: AssistantExtractedParameters = {},
  previous?: AssistantAnalyticsContext['filtros']
): AssistantAnalyticsContext['filtros'] => {
  const current = currentIsoWeek();
  const entityMetric = entities.metrica as AnalyticsMetric | undefined;
  const entityDimension = entities.agrupar_por as AnalyticsDimension | undefined;
  const detectedMetric: AnalyticsMetric | undefined =
    /\b(gano|ganado|recibio|sueldo|pago conductor|pago del conductor)\b/.test(normalized)
      ? 'pago_conductor'
      : normalized.includes('mas viajes') ||
    normalized.includes('más viajes') ||
    normalized.includes('cantidad de viajes')
      ? 'cantidad_viajes'
      : normalized.includes('utilidad') || normalized.includes('ganancia')
        ? 'utilidad_viajes'
        : normalized.includes('viatico') || normalized.includes('viático') || normalized.includes('gasto')
          ? 'viaticos'
          : normalized.includes('precio viaje') ||
              normalized.includes('precio del viaje') ||
              normalized.includes('flete')
            ? 'precio_viaje'
            : normalized.includes('factur')
              ? 'valor_a_facturar'
              : undefined;
  const detectedDimension: AnalyticsDimension | undefined =
    detectedMetric === 'pago_conductor'
      ? 'conductor'
      : normalized.includes('cliente')
      ? 'cliente'
      : normalized.includes('conductor') || normalized.includes('chofer')
        ? 'conductor'
        : normalized.includes('destino') || normalized.includes('ruta')
          ? 'destino'
          : normalized.includes('vehiculo') || normalized.includes('vehículo') || normalized.includes('carro')
            ? 'vehiculo'
            : undefined;
  const metric =
    (entityMetric && analyticsMetrics.has(entityMetric) ? entityMetric : undefined) ??
    detectedMetric ??
    previous?.metrica ??
    'valor_a_facturar';
  const dimension =
    (entityDimension && analyticsDimensions.has(entityDimension) ? entityDimension : undefined) ??
    detectedDimension ??
    previous?.agrupar_por ??
    'vehiculo';
  const requestedOperation = normalizeText(entities.operacion);
  const operation: AnalyticsAggregation =
    metric === 'cantidad_viajes'
      ? 'conteo'
      : requestedOperation.includes('promedio') || normalized.includes('promedio')
        ? 'promedio'
        : 'suma';
  const requestedOrder = normalizeText(entities.orden);
  const order: AnalyticsOrder =
    requestedOrder.includes('asc') || normalized.includes('menor')
      ? 'asc'
      : requestedOrder.includes('desc') || normalized.includes('mayor') || normalized.includes('mas')
        ? 'desc'
        : previous?.orden ?? 'desc';
  const explicitWeek = entities.semana ? Number(entities.semana) : parseWeek(message);
  const explicitYear = entities.anio
    ? Number(entities.anio)
    : Number(message.match(/\b(20\d{2})\b/)?.[1] ?? 0);
  const relativeWeek =
    previous?.semana && normalized.includes('siguiente')
      ? Math.min(previous.semana + 1, 53)
      : previous?.semana && normalized.includes('anterior')
        ? Math.max(previous.semana - 1, 1)
        : undefined;
  const limitInput =
    Number(entities.limite ?? 0) ||
    Number(normalized.match(/\btop\s*(\d{1,2})\b/)?.[1] ?? 0) ||
    (normalized.includes('cual') || normalized.includes('cuál') || normalized.includes('mas') ? 1 : 5);
  const cobrado = parseCobradoFilter(normalized);
  const clearCobrado =
    normalized.includes('quitar filtro') ||
    normalized.includes('sin filtro de cobro') ||
    normalized.includes('todos los viajes');
  const resolvedCobrado = clearCobrado ? undefined : cobrado ?? previous?.cobrado;

  return {
    metrica: metric,
    agrupar_por: dimension,
    operacion: operation,
    orden: order,
    limite: Math.min(Math.max(limitInput || previous?.limite || 5, 1), 10),
    semana: explicitWeek ?? relativeWeek ?? previous?.semana ?? current.semana,
    anio: explicitYear || previous?.anio || current.anio,
    ...(typeof resolvedCobrado === 'boolean' ? { cobrado: resolvedCobrado } : {}),
    ...(previous?.conductor_id ? { conductor_id: previous.conductor_id } : {}),
    ...(previous?.conductor_nombre ? { conductor_nombre: previous.conductor_nombre } : {})
  };
};

const analyticsMetricLabel: Record<AnalyticsMetric, string> = {
  valor_a_facturar: 'A facturar',
  precio_viaje: 'Precio viaje',
  utilidad_viajes: 'Utilidad viajes',
  viaticos: 'Viáticos y gastos',
  cantidad_viajes: 'Viajes',
  pago_conductor: 'Pago semanal'
};

const analyticsDimensionLabel: Record<AnalyticsDimension, string> = {
  vehiculo: 'vehículo',
  cliente: 'cliente',
  conductor: 'conductor',
  destino: 'destino'
};

const analyticsTripValue = (
  metric: AnalyticsMetric,
  trip: {
    precio_flete: Prisma.Decimal;
    precio_real_flete: Prisma.Decimal;
    viaticos: Prisma.Decimal;
    costo_real_gastos: Prisma.Decimal | null;
  }
) => {
  if (metric === 'pago_conductor') return toMoney(0);
  if (metric === 'cantidad_viajes') return toMoney(1);
  if (metric === 'precio_viaje') return toMoney(trip.precio_flete);
  if (metric === 'viaticos') return toMoney(trip.costo_real_gastos ?? trip.viaticos);
  if (metric === 'utilidad_viajes') {
    return toMoney(trip.precio_real_flete).minus(
      toMoney(trip.costo_real_gastos ?? trip.viaticos)
    );
  }
  return toMoney(trip.precio_real_flete);
};

const resolveAnalyticsConductor = async (
  propietarioId: bigint | null,
  normalized: string,
  entities: AssistantExtractedParameters,
  plan: AssistantAnalyticsContext['filtros']
) => {
  const clearConductor =
    normalized.includes('todos los conductores') ||
    normalized.includes('todos los choferes') ||
    normalized.includes('compara conductores') ||
    normalized.includes('comparar conductores') ||
    (
      !entities.conductor &&
      (normalized.includes('conductor') || normalized.includes('chofer')) &&
      /(mas|mayor|ranking|top)/.test(normalized)
    );
  if (clearConductor) {
    const { conductor_id: _id, conductor_nombre: _nombre, ...rest } = plan;
    return {
      plan: rest as AssistantAnalyticsContext['filtros'],
      ambiguos: [] as string[]
    };
  }

  const conductores = await prisma.conductor.findMany({
    where: ownerWhere(propietarioId),
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
    take: 300
  });
  const entityName = normalizeText(entities.conductor);
  const sourceWords = textWords(entityName || normalized);
  const candidates = conductores
    .map((conductor) => {
      const name = normalizeText(conductor.nombre);
      const words = name.split(/\s+/).filter((word) => word.length >= 3);
      const score = entityName && name === entityName
        ? 100
        : entityName && (name.includes(entityName) || entityName.includes(name))
          ? 50
          : words.filter((word) => sourceWords.has(word)).length;
      return { ...conductor, score };
    })
    .filter((conductor) => conductor.score > 0)
    .sort((left, right) => right.score - left.score || left.nombre.localeCompare(right.nombre));

  if (!candidates.length) {
    return { plan, ambiguos: [] as string[] };
  }

  const best = candidates[0]!;
  const tied = candidates.filter((candidate) => candidate.score === best.score);
  if (tied.length > 1) {
    return {
      plan,
      ambiguos: tied.slice(0, 8).map((candidate) => candidate.nombre)
    };
  }

  return {
    plan: {
      ...plan,
      conductor_id: String(best.id),
      conductor_nombre: best.nombre
    },
    ambiguos: [] as string[]
  };
};

const analyticsDriverPaymentQuery = async (
  propietarioId: bigint | null,
  plan: AssistantAnalyticsContext['filtros']
) => {
  const pagos = await getPagosSemanalesConductores(
    propietarioId,
    plan.anio,
    plan.semana ?? currentIsoWeek().semana,
    plan.conductor_id ? BigInt(plan.conductor_id) : undefined
  );

  if (!pagos.length) {
    const subject = plan.conductor_nombre ? ` para ${plan.conductor_nombre}` : '';
    return {
      tipo: 'consulta' as const,
      respuesta: `No encontré pagos ni viajes${subject} en la semana ${plan.semana} de ${plan.anio}.`,
      cards: [],
      detalle: '',
      contexto: {
        tipo: 'analitica_viajes' as const,
        filtros: plan
      },
      sugerencias: ['Semana siguiente', 'Comparar conductores']
    };
  }

  const selected = pagos.slice(0, plan.conductor_id ? 1 : plan.limite);
  const first = selected[0]!;
  const specific = Boolean(plan.conductor_id);
  const respuesta = specific
    ? `En la semana ${plan.semana} de ${plan.anio}, ${first.conductor.nombre} ganó ${money(first.total)}: sueldo ${money(first.sueldo)}, bono ${money(first.bono)}, retornos ${money(first.retornos)} y domingos ${money(first.domingos)}.`
    : `En la semana ${plan.semana} de ${plan.anio}, ${first.conductor.nombre} tuvo el mayor pago semanal: ${money(first.total)}.`;

  return {
    tipo: 'consulta' as const,
    respuesta,
    cards: [
      {
        titulo: 'Sueldo semanal',
        valor: money(first.sueldo),
        detalle: first.sueldo_generado ? 'Registrado en el cierre' : 'Calculado'
      },
      {
        titulo: 'Bono',
        valor: money(first.bono),
        detalle: first.bono_generado ? 'Registrado en el cierre' : 'Calculado'
      },
      {
        titulo: 'Retornos',
        valor: money(first.retornos),
        detalle: `${first.cantidad_retornos} viaje(s)`
      },
      {
        titulo: 'Domingos',
        valor: money(first.domingos),
        detalle: `${first.cantidad_domingos} viaje(s)`
      },
      { titulo: 'Total ganado', valor: money(first.total) },
      { titulo: 'Viajes', valor: String(first.cantidad_viajes) }
    ],
    detalle: selected
      .map(
        (item, index) =>
          `${index + 1}. ${item.conductor.nombre} | sueldo: ${money(item.sueldo)} | bono: ${money(item.bono)} | retornos: ${money(item.retornos)} | domingos: ${money(item.domingos)} | total: ${money(item.total)}`
      )
      .join('\n'),
    contexto: {
      tipo: 'analitica_viajes' as const,
      filtros: plan
    },
    sugerencias: specific
      ? ['Semana siguiente', 'Comparar conductores']
      : ['Semana siguiente']
  };
};

const analyticsTravelQuery = async (
  propietarioId: bigint | null,
  plan: AssistantAnalyticsContext['filtros']
) => {
  if (plan.metrica === 'pago_conductor') {
    return analyticsDriverPaymentQuery(propietarioId, plan);
  }

  const { fechaInicio, fechaFin } = getIsoWeekRange(plan.anio, plan.semana ?? currentIsoWeek().semana);
  const trips = await prisma.viaje.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: { not: EstadoViaje.CANCELADO },
      ...viajeSemanaWhere(fechaInicio, fechaFin),
      ...(plan.conductor_id ? { conductor_id: BigInt(plan.conductor_id) } : {}),
      ...(typeof plan.cobrado === 'boolean' ? { cobrado: plan.cobrado } : {})
    },
    select: {
      precio_flete: true,
      precio_real_flete: true,
      viaticos: true,
      costo_real_gastos: true,
      vehiculo: { select: { placa: true } },
      cliente: { select: { nombre: true } },
      conductor: { select: { nombre: true } },
      tarifa_ruta: {
        select: {
          ruta: {
            select: { destino: true }
          }
        }
      }
    }
  });
  const groups = new Map<string, { total: Prisma.Decimal; count: number }>();

  for (const trip of trips) {
    const key =
      plan.agrupar_por === 'cliente'
        ? trip.cliente.nombre
        : plan.agrupar_por === 'conductor'
          ? trip.conductor.nombre
          : plan.agrupar_por === 'destino'
            ? trip.tarifa_ruta.ruta.destino
            : trip.vehiculo.placa;
    const current = groups.get(key) ?? { total: toMoney(0), count: 0 };
    current.total = current.total.plus(analyticsTripValue(plan.metrica, trip));
    current.count += 1;
    groups.set(key, current);
  }

  const rows = [...groups.entries()]
    .map(([nombre, values]) => ({
      nombre,
      count: values.count,
      value:
        plan.operacion === 'promedio' && values.count
          ? values.total.div(values.count).toDecimalPlaces(2)
          : values.total.toDecimalPlaces(2)
    }))
    .sort((left, right) => {
      const comparison = left.value.comparedTo(right.value);
      return plan.orden === 'asc' ? comparison : -comparison;
    })
    .slice(0, plan.limite);
  const metricLabel = analyticsMetricLabel[plan.metrica];
  const dimensionLabel = analyticsDimensionLabel[plan.agrupar_por];
  const collectionLabel = `${dimensionLabel}${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    return {
      tipo: 'consulta' as const,
      respuesta: `No encontré viajes para la semana ${plan.semana} de ${plan.anio} con esos filtros.`,
      cards: [],
      detalle: '',
      contexto: {
        tipo: 'analitica_viajes' as const,
        filtros: plan
      },
      sugerencias: ['Quitar filtro de cobro', 'Cambiar semana']
    };
  }

  const first = rows[0]!;
  const valueLabel =
    plan.metrica === 'cantidad_viajes' ? String(first.count) : money(first.value);
  const metricPhrase =
    plan.metrica === 'valor_a_facturar'
      ? 'valor a facturar'
      : metricLabel.toLowerCase();
  const tripLabel = first.count === 1 ? 'viaje' : 'viajes';
  const resultPhrase =
    plan.metrica === 'cantidad_viajes'
      ? `${first.count} ${tripLabel}`
      : `${valueLabel} en ${first.count} ${tripLabel}`;
  return {
    tipo: 'consulta' as const,
    respuesta: `En la semana ${plan.semana} de ${plan.anio}, el ${dimensionLabel} con ${plan.orden === 'desc' ? 'mayor' : 'menor'} ${metricPhrase} fue ${first.nombre}, con ${resultPhrase}.`,
    cards: [
      { titulo: `Primer ${dimensionLabel}`, valor: first.nombre },
      { titulo: metricLabel, valor: valueLabel },
      { titulo: 'Viajes', valor: String(first.count) },
      { titulo: 'Periodo', valor: `Semana ${plan.semana} / ${plan.anio}` }
    ],
    detalle: rows
      .map((row, index) =>
        `${index + 1}. ${row.nombre} | ${metricLabel}: ${
          plan.metrica === 'cantidad_viajes' ? row.count : money(row.value)
        } | viajes: ${row.count}`
      )
      .join('\n'),
    contexto: {
      tipo: 'analitica_viajes' as const,
      filtros: plan
    },
    sugerencias: [`Ver top ${Math.min(5, groups.size)} ${collectionLabel}`, 'Cambiar semana', 'Solo cobrados']
  };
};

const parseTravelContextFilters = async (
  propietarioId: bigint | null,
  message: string,
  normalized: string,
  previous?: AssistantQueryContext['filtros']
) => {
  const filters: AssistantQueryContext['filtros'] = { ...(previous ?? {}) };
  const week = parseWeek(message);
  const year = parseYear(message);
  const cobrado = parseCobradoFilter(normalized);
  const [cliente, vehiculo] = await Promise.all([
    findCliente(propietarioId, normalized),
    findVehiculo(propietarioId, normalized)
  ]);

  if (week) filters.semana = week;
  if (!week && previous?.semana && (normalized.includes('siguiente') || normalized.includes('proxima'))) {
    filters.semana = Math.min(previous.semana + 1, 53);
  }
  if (!week && previous?.semana && normalized.includes('anterior')) {
    filters.semana = Math.max(previous.semana - 1, 1);
  }
  if (week || /\b20\d{2}\b/.test(message)) filters.anio = year;
  if (cliente) {
    filters.cliente_id = String(cliente.id);
    filters.cliente_nombre = cliente.nombre;
  }
  if (vehiculo) {
    filters.vehiculo_id = String(vehiculo.id);
    filters.vehiculo_placa = vehiculo.placa;
  }
  if (cobrado !== undefined) filters.cobrado = cobrado;

  return filters;
};

const travelSummaryWithFilters = async (
  propietarioId: bigint | null,
  message: string,
  normalized: string,
  previous?: AssistantQueryContext['filtros']
) => {
  const filters = await parseTravelContextFilters(propietarioId, message, normalized, previous);
  const week = filters.semana ?? parseWeek(message);
  const year = filters.anio ?? parseYear(message);

  if (!week) {
    const result = await travelSummary(propietarioId, message, normalized);
    return {
      ...result,
      contexto: { tipo: 'viajes' as const, filtros: filters }
    };
  }

  const { fechaInicio, fechaFin } = getIsoWeekRange(year, week);
  const rows = await prisma.viaje.findMany({
    where: {
      ...ownerWhere(propietarioId),
      estado: { not: EstadoViaje.CANCELADO },
      ...viajeSemanaWhere(fechaInicio, fechaFin),
      ...(filters.cliente_id ? { cliente_id: BigInt(filters.cliente_id) } : {}),
      ...(filters.vehiculo_id ? { vehiculo_id: BigInt(filters.vehiculo_id) } : {}),
      ...(filters.cobrado !== undefined ? { cobrado: filters.cobrado } : {})
    },
    include: {
      cliente: true,
      vehiculo: true,
      conductor: true,
      tarifa_ruta: { include: { ruta: true, tipo_carga: true } }
    },
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { id: 'desc' }],
    take: 50
  });

  const totalViajes = rows.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_flete)), toMoney(0));
  const facturar = rows.reduce((sum, viaje) => sum.plus(toMoney(viaje.precio_real_flete)), toMoney(0));
  const utilidad = rows.reduce(
    (sum, viaje) => sum.plus(toMoney(viaje.precio_real_flete).minus(toMoney(viaje.costo_real_gastos))),
    toMoney(0)
  );
  const labelParts = [
    filters.cliente_nombre ? `cliente ${filters.cliente_nombre}` : '',
    filters.vehiculo_placa ? `vehiculo ${filters.vehiculo_placa}` : '',
    filters.cobrado !== undefined ? (filters.cobrado ? 'cobrados' : 'por cobrar') : '',
    `semana ${week} de ${year}`
  ].filter(Boolean);

  return {
    respuesta: `Encontré ${rows.length} viaje(s) de ${labelParts.join(', ')}. A facturar: ${money(facturar)}. Utilidad viajes: ${money(utilidad)}.`,
    cards: [
      { titulo: 'Viajes', valor: String(rows.length), detalle: `Semana ${week}` },
      { titulo: 'Precio viaje', valor: money(totalViajes) },
      { titulo: 'A facturar', valor: money(facturar) },
      { titulo: 'Utilidad viajes', valor: money(utilidad) }
    ],
    detalle: topRowsText(
      rows.slice(0, 12).map(
        (viaje) =>
          `${dateOnly(viaje.fecha_llegada ?? viaje.fecha_salida)} | ${viaje.cliente.nombre} | ${viaje.vehiculo.placa} | ${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino} | ${money(viaje.precio_real_flete)} | ${viaje.cobrado ? 'cobrado' : 'por cobrar'}`
      )
    ),
    contexto: {
      tipo: 'viajes' as const,
      filtros: {
        ...filters,
        semana: week,
        anio: year
      }
    }
  };
};

const isTravelContinuation = (normalized: string, context?: AssistantQueryContext) =>
  context?.tipo === 'viajes' &&
  (parseWeek(normalized) !== null ||
    normalized.includes('ahora') ||
    normalized.includes('siguiente') ||
    normalized.includes('anterior') ||
    normalized.includes('cobrado') ||
    normalized.includes('cobrados'));

const normalizeAssistantQueryContext = (input: AsistenteMensajeInput): AssistantQueryContext | undefined => {
  const consulta = input.contexto?.consulta;
  if (!consulta || consulta.tipo !== 'viajes') return undefined;
  const filtros = consulta.filtros ?? {};

  return {
    tipo: 'viajes',
    filtros: {
      cliente_id: filtros['cliente_id'] == null ? undefined : String(filtros['cliente_id']),
      cliente_nombre: filtros['cliente_nombre'] == null ? undefined : String(filtros['cliente_nombre']),
      vehiculo_id: filtros['vehiculo_id'] == null ? undefined : String(filtros['vehiculo_id']),
      vehiculo_placa: filtros['vehiculo_placa'] == null ? undefined : String(filtros['vehiculo_placa']),
      destino: filtros['destino'] == null ? undefined : String(filtros['destino']),
      semana: filtros['semana'] == null ? undefined : Number(filtros['semana']),
      anio: filtros['anio'] == null ? undefined : Number(filtros['anio']),
      cobrado: typeof filtros['cobrado'] === 'boolean' ? filtros['cobrado'] : undefined
    }
  };
};

const normalizeAnalyticsContext = (
  input: AsistenteMensajeInput
): AssistantAnalyticsContext | undefined => {
  const consulta = input.contexto?.consulta;
  if (!consulta || consulta.tipo !== 'analitica_viajes') return undefined;
  const filtros = consulta.filtros ?? {};
  const metric = String(filtros['metrica'] ?? '') as AnalyticsMetric;
  const dimension = String(filtros['agrupar_por'] ?? '') as AnalyticsDimension;
  const operation = String(filtros['operacion'] ?? '') as AnalyticsAggregation;
  const order = String(filtros['orden'] ?? '') as AnalyticsOrder;
  if (!analyticsMetrics.has(metric) || !analyticsDimensions.has(dimension)) return undefined;

  return {
    tipo: 'analitica_viajes',
    filtros: {
      metrica: metric,
      agrupar_por: dimension,
      operacion: ['suma', 'promedio', 'conteo'].includes(operation) ? operation : 'suma',
      orden: order === 'asc' ? 'asc' : 'desc',
      limite: Math.min(Math.max(Number(filtros['limite'] ?? 5), 1), 10),
      semana: filtros['semana'] == null ? undefined : Number(filtros['semana']),
      anio: Number(filtros['anio'] ?? currentIsoWeek().anio),
      cobrado: typeof filtros['cobrado'] === 'boolean' ? filtros['cobrado'] : undefined,
      conductor_id:
        filtros['conductor_id'] == null ? undefined : String(filtros['conductor_id']),
      conductor_nombre:
        filtros['conductor_nombre'] == null ? undefined : String(filtros['conductor_nombre'])
    }
  };
};

const meaningfulWords = (normalized: string) =>
  normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !assistantStopWords.has(word) && !/^\d+$/.test(word));

const parseRequestedCount = (normalized: string) => {
  const directNumber = normalized.match(/\b(\d{1,2})\s+(?:ultimos|ultimas)\b/)?.[1];
  if (directNumber) return Math.min(Math.max(Number(directNumber), 1), 10);

  const wordNumbers: Record<string, number> = {
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };
  const wordMatch = normalized.match(/\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:ultimos|ultimas)\b/)?.[1];
  return wordMatch ? wordNumbers[wordMatch] : 1;
};

const latestMaintenanceForVehicleLegacy = async (propietarioId: bigint | null, normalized: string) => {
  const vehiculo = await findVehiculo(propietarioId, normalized);
  if (!vehiculo) {
    return {
      respuesta: 'Indícame la placa del vehículo. Ejemplo: "muéstrame el último cambio de aceite del OAA1227".',
      cards: [],
      detalle: ''
    };
  }

  const tipo = await findTipoMantenimiento(propietarioId, normalized);
  const mantenimiento = await prisma.mantenimiento.findFirst({
    where: {
      ...ownerWhere(propietarioId),
      vehiculo_id: vehiculo.id,
      estado: EstadoMantenimiento.REALIZADO,
      ...(tipo ? { tipo_mantenimiento_id: tipo.id } : {})
    },
    include: {
      vehiculo: true,
      tipo_mantenimiento: true,
      repuestos: true
    },
    orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }]
  });

  if (!mantenimiento) {
    return {
      respuesta: tipo
        ? `No encontré ${tipo.nombre} registrado para ${vehiculo.placa}.`
        : `No encontré mantenimientos registrados para ${vehiculo.placa}.`,
      cards: [{ titulo: 'Vehículo', valor: vehiculo.placa }],
      detalle: ''
    };
  }

  const repuestos = mantenimiento.repuestos
    .map((repuesto) => `${repuesto.nombre_repuesto} (${money(repuesto.costo_total)})`)
    .join(', ');

  return {
    respuesta: `El último ${mantenimiento.tipo_mantenimiento.nombre} de ${vehiculo.placa} fue el ${dateOnly(
      mantenimiento.fecha_mantenimiento
    )}, por ${money(mantenimiento.costo_total)}.`,
    cards: [
      { titulo: 'Vehículo', valor: vehiculo.placa },
      { titulo: 'Fecha', valor: dateOnly(mantenimiento.fecha_mantenimiento) },
      { titulo: 'Kilometraje', valor: String(mantenimiento.kilometraje_actual_vehiculo) },
      { titulo: 'Costo total', valor: money(mantenimiento.costo_total) }
    ],
    detalle: [
      `Tipo: ${mantenimiento.tipo_mantenimiento.nombre}`,
      mantenimiento.descripcion ? `Descripción: ${mantenimiento.descripcion}` : '',
      repuestos ? `Repuestos: ${repuestos}` : '',
      mantenimiento.proximo_mantenimiento_km ? `Próx. km: ${mantenimiento.proximo_mantenimiento_km}` : '',
      mantenimiento.proximo_mantenimiento_fecha
        ? `Próx. fecha: ${dateOnly(mantenimiento.proximo_mantenimiento_fecha)}`
        : ''
    ]
      .filter(Boolean)
      .join('\n'),
    actions: [
      {
        label: 'Abrir mantenimiento',
        route: '/app/mantenimientos',
        query: { edit: String(mantenimiento.id) }
      }
    ]
  };
};

const latestMaintenanceForVehicleList = async (propietarioId: bigint | null, normalized: string) => {
  const vehiculo = await findVehiculo(propietarioId, normalized);
  if (!vehiculo) {
    return {
      respuesta: 'Indicame la placa del vehiculo. Ejemplo: "muestrame los dos ultimos cambios de aceite del OAA1227".',
      cards: [],
      detalle: ''
    };
  }

  const tipo = await findTipoMantenimiento(propietarioId, normalized);
  const tipoFilter: Prisma.MantenimientoWhereInput = normalized.includes('aceite')
    ? { tipo_mantenimiento: { nombre: { contains: 'ACEITE', mode: 'insensitive' } } }
    : tipo
      ? { tipo_mantenimiento_id: tipo.id }
      : {};
  const tipoLabel = normalized.includes('aceite') ? 'aceite' : (tipo?.nombre ?? 'mantenimiento');
  const count = parseRequestedCount(normalized);
  const mantenimientos = await prisma.mantenimiento.findMany({
    where: {
      ...ownerWhere(propietarioId),
      vehiculo_id: vehiculo.id,
      estado: EstadoMantenimiento.REALIZADO,
      ...tipoFilter
    },
    include: {
      vehiculo: true,
      tipo_mantenimiento: true,
      repuestos: true
    },
    orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }],
    take: count
  });

  if (!mantenimientos.length) {
    return {
      respuesta: tipo
        ? `No encontre ${tipoLabel} registrado para ${vehiculo.placa}.`
        : `No encontre mantenimientos registrados para ${vehiculo.placa}.`,
      cards: [{ titulo: 'Vehiculo', valor: vehiculo.placa }],
      detalle: ''
    };
  }

  const total = mantenimientos.reduce((sum, item) => sum.plus(toMoney(item.costo_total)), toMoney(0));
  const detalle = topRowsText(
    mantenimientos.map((item, index) => {
      const repuestos = item.repuestos
        .map((repuesto) => repuesto.nombre_repuesto)
        .filter(Boolean)
        .join(', ');
      return [
        `${index + 1}. ${dateOnly(item.fecha_mantenimiento)} | ${item.tipo_mantenimiento.nombre} | km ${item.kilometraje_actual_vehiculo} | ${money(item.costo_total)}`,
        item.descripcion ? `   Descripcion: ${item.descripcion}` : '',
        repuestos ? `   Repuestos: ${repuestos}` : '',
        item.proximo_mantenimiento_km ? `   Prox. km: ${item.proximo_mantenimiento_km}` : '',
        item.proximo_mantenimiento_fecha ? `   Prox. fecha: ${dateOnly(item.proximo_mantenimiento_fecha)}` : ''
      ]
        .filter(Boolean)
        .join('\n');
    })
  );

  const mantenimiento = mantenimientos[0]!;
  return {
    respuesta:
      count === 1
        ? `El ultimo ${mantenimiento.tipo_mantenimiento.nombre} de ${vehiculo.placa} fue el ${dateOnly(
            mantenimiento.fecha_mantenimiento
          )}, por ${money(mantenimiento.costo_total)}.`
        : `Encontre ${mantenimientos.length} mantenimiento(s) reciente(s) de ${tipoLabel} para ${vehiculo.placa}.`,
    cards: [
      { titulo: 'Vehiculo', valor: vehiculo.placa },
      { titulo: 'Registros', valor: String(mantenimientos.length) },
      { titulo: 'Costo total', valor: money(total) }
    ],
    detalle,
    actions: [
      {
        label: count === 1 ? 'Abrir mantenimiento' : 'Abrir el mas reciente',
        route: '/app/mantenimientos',
        query: { edit: String(mantenimiento.id) }
      }
    ]
  };
};

const latestTripForVehicleDestination = async (propietarioId: bigint | null, normalized: string) => {
  const vehiculo = await findVehiculo(propietarioId, normalized);
  if (!vehiculo) {
    return {
      respuesta: 'Indícame la placa del vehículo. Ejemplo: "déjame ver el último viaje a Vinces del OAA1588".',
      cards: [],
      detalle: ''
    };
  }

  const targetWords = meaningfulWords(normalized).filter((word) => !normalizeText(vehiculo.placa).includes(word));
  const viajes = await prisma.viaje.findMany({
    where: {
      ...ownerWhere(propietarioId),
      vehiculo_id: vehiculo.id,
      estado: { not: EstadoViaje.CANCELADO }
    },
    include: {
      cliente: true,
      conductor: true,
      vehiculo: true,
      tarifa_ruta: { include: { ruta: true, tipo_carga: true } }
    },
    orderBy: [{ fecha_llegada: 'desc' }, { fecha_salida: 'desc' }, { id: 'desc' }],
    take: 300
  });

  const viaje = viajes.find((item) => {
    const destinoWords = normalizeText(item.tarifa_ruta.ruta.destino)
      .split(/\s+/)
      .filter((word) => word.length >= 3);
    return targetWords.length
      ? targetWords.some((word) => destinoWords.includes(word))
      : true;
  });

  if (!viaje) {
    const destino = targetWords.join(' ') || 'ese destino';
    return {
      respuesta: `No encontré viajes recientes de ${vehiculo.placa} a ${destino}.`,
      cards: [{ titulo: 'Vehículo', valor: vehiculo.placa }],
      detalle: ''
    };
  }

  const ruta = `${viaje.tarifa_ruta.ruta.origen} - ${viaje.tarifa_ruta.ruta.destino}`;
  const guias = viaje.numeros_guia_remision?.length ? viaje.numeros_guia_remision.join(', ') : 'Sin guías';

  return {
    respuesta: `El último viaje de ${vehiculo.placa} a ${viaje.tarifa_ruta.ruta.destino} fue el ${dateOnly(
      viaje.fecha_llegada ?? viaje.fecha_salida
    )}.`,
    cards: [
      { titulo: 'Vehículo', valor: vehiculo.placa },
      { titulo: 'Cliente', valor: viaje.cliente.nombre },
      { titulo: 'Ruta', valor: ruta },
      { titulo: 'A facturar', valor: money(viaje.precio_real_flete) }
    ],
    detalle: [
      `Fecha salida: ${dateOnly(viaje.fecha_salida)}`,
      `Fecha entrega: ${dateOnly(viaje.fecha_llegada ?? viaje.fecha_salida)}`,
      `Conductor: ${viaje.conductor.nombre}`,
      `Tipo carga: ${viaje.tarifa_ruta.tipo_carga.nombre}`,
      `Capacidad: ${viaje.tarifa_ruta.capacidad ?? '-'}`,
      `Toneladas: ${viaje.tarifa_ruta.toneladas ? toMoney(viaje.tarifa_ruta.toneladas).toFixed(2) : '-'}`,
      `Guías: ${guias}`,
      `Precio viaje: ${money(viaje.precio_flete)}`,
      `Viáticos: ${money(viaje.viaticos)}`,
      `Cobrado: ${viaje.cobrado ? 'sí' : 'no'}`
    ].join('\n'),
    actions: [
      {
        label: 'Abrir viaje',
        route: '/app/viajes',
        query: { edit: String(viaje.id) }
      }
    ]
  };
};

const saveDraftFromContext = async (
  propietarioIdInput: unknown,
  input: AsistenteMensajeInput,
  audit?: AuditContext
) => {
  const action = input.contexto?.action;
  if (!action || !['guardar', 'editar'].includes(action.operacion ?? '')) {
    throw new AppError('No hay un borrador listo para aplicar.', 400);
  }

  const query = action.query;
  if (action.operacion === 'editar') {
    if (action.route === '/app/viajes') {
      const payload = viajeUpdateSchema.parse({
        precio_flete: query['precio_flete'],
        viaticos: query['viaticos'],
        numeros_guia_remision: query['numeros_guia_remision']
      });
      const viaje = await updateViaje(propietarioIdInput, query.id, payload, audit);
      return {
        tipo: 'accion' as const,
        respuesta: `Viaje ${query.id} actualizado correctamente.`,
        cards: [{ titulo: 'Registro actualizado', valor: 'Viaje' }],
        detalle: `Precio viaje: ${money(viaje.precio_flete)}\nViáticos: ${money(viaje.viaticos)}`,
        sugerencias: ['Consultar viajes pendientes', 'Modificar otro viaje']
      };
    }

    const payload = mantenimientoUpdateSchema.parse({
      costo_mano_obra: query['costo_total'],
      costo_repuestos: query['costo_total'] ? 0 : undefined,
      kilometraje_actual_vehiculo: query['kilometraje_actual_vehiculo'],
      descripcion: query['descripcion']
    });
    const mantenimiento = await updateMantenimiento(propietarioIdInput, query.id, payload, audit);
    return {
      tipo: 'accion' as const,
      respuesta: `Mantenimiento ${query.id} actualizado correctamente.`,
      cards: [{ titulo: 'Registro actualizado', valor: 'Mantenimiento' }],
      detalle: `Costo: ${money(mantenimiento.costo_total)}\nKilometraje: ${mantenimiento.kilometraje_actual_vehiculo}`,
      sugerencias: ['Consultar mantenimientos', 'Modificar otro mantenimiento']
    };
  }

  if (action.route === '/app/viajes') {
    const payload = viajeCreateSchema.parse({
      cliente_id: query['cliente_id'],
      vehiculo_id: query['vehiculo_id'],
      conductor_id: query['conductor_id'],
      tarifa_ruta_id: query['tarifa_ruta_id'],
      fecha_salida: query['fecha_salida'],
      fecha_llegada: query['fecha_llegada'],
      numeros_guia_remision: query['numeros_guia_remision'] ?? '',
      precio_flete: query['precio_flete'],
      viaticos: query['viaticos'] ?? 0,
      estado: 'programado'
    });
    const viaje = await createViaje(propietarioIdInput, payload, audit);
    return {
      tipo: 'accion' as const,
      respuesta: `Viaje guardado correctamente con el número ${String(viaje.id)}.`,
      cards: [{ titulo: 'Registro creado', valor: 'Viaje' }],
      detalle: `Fecha: ${dateOnly(viaje.fecha_salida)}\nPrecio viaje: ${money(viaje.precio_flete)}`,
      sugerencias: ['Crear otro viaje', 'Consultar viajes pendientes']
    };
  }

  if (action.route === '/app/mantenimientos') {
    const payload = mantenimientoCreateSchema.parse({
      vehiculo_id: query['vehiculo_id'],
      tipo_mantenimiento_id: query['tipo_mantenimiento_id'],
      fecha_mantenimiento: query['fecha_mantenimiento'],
      costo_mano_obra: query['costo_total'] ?? 0,
      costo_repuestos: 0,
      estado: 'realizado',
      actualizar_kilometraje_vehiculo: true
    });
    const mantenimiento = await createMantenimiento(propietarioIdInput, payload, audit);
    return {
      tipo: 'accion' as const,
      respuesta: `Mantenimiento guardado correctamente con el número ${String(mantenimiento.id)}.`,
      cards: [{ titulo: 'Registro creado', valor: 'Mantenimiento' }],
      detalle: `Fecha: ${dateOnly(mantenimiento.fecha_mantenimiento)}\nCosto: ${money(mantenimiento.costo_total)}`,
      sugerencias: ['Crear otro mantenimiento', 'Consultar mantenimientos']
    };
  }

  if (action.route === '/app/clientes') {
    const payload = clienteCreateSchema.parse({
      nombre: query['nombre'],
      ruc_cedula: query['ruc_cedula'],
      telefono: query['telefono'],
      email: query['email'],
      contacto_nombre: query['contacto_nombre'],
      direccion: query['direccion'],
      porcentaje_comision: query['porcentaje_comision'] ?? 0,
      activo: true
    });
    const cliente = await createCliente(propietarioIdInput, payload);
    return {
      tipo: 'accion' as const,
      respuesta: `Cliente ${cliente.nombre} guardado correctamente.`,
      cards: [{ titulo: 'Registro creado', valor: 'Cliente' }],
      detalle: `RUC/cédula: ${cliente.ruc_cedula}\nComisión: ${cliente.porcentaje_comision.toFixed(2)}%`,
      sugerencias: ['Crear otro cliente', 'Crear un viaje']
    };
  }

  if (action.route === '/app/vehiculos') {
    const payload = vehiculoCreateSchema.parse({
      categoria_peaje_id: query['categoria_peaje_id'],
      placa: query['placa']?.toUpperCase(),
      marca: query['marca'],
      modelo: query['modelo'],
      color: query['color'],
      anio: query['anio'],
      capacidad: query['capacidad'],
      toneladas: query['toneladas'],
      kilometraje_actual: query['kilometraje_actual'] ?? 0,
      rendimiento_km_galon: query['rendimiento_km_galon'] ?? 16,
      estado: query['estado'] ?? 'disponible',
      facturable: query['facturable'] !== 'false'
    });
    const vehiculo = await createVehiculo(propietarioIdInput, payload);
    return {
      tipo: 'accion' as const,
      respuesta: `Vehículo ${vehiculo.placa} guardado correctamente.`,
      cards: [{ titulo: 'Registro creado', valor: 'Vehículo' }],
      detalle: `Marca: ${vehiculo.marca}\nCategoría: ${vehiculo.categoria_peaje.nombre}\nCapacidad: ${vehiculo.capacidad}`,
      sugerencias: ['Crear otro vehículo', 'Crear un conductor']
    };
  }

  if (action.route === '/app/conductores') {
    const payload = conductorCreateSchema.parse({
      nombre: query['nombre'],
      cedula: query['cedula'],
      telefono: query['telefono'],
      email: query['email'],
      fecha_nacimiento: query['fecha_nacimiento'],
      numero_licencia: query['numero_licencia'],
      fecha_caducidad_licencia: query['fecha_caducidad_licencia'],
      sueldo_semanal: query['sueldo_semanal'] ?? 0,
      estado: query['estado'] ?? 'activo'
    });
    const conductor = await createConductor(propietarioIdInput, payload);
    return {
      tipo: 'accion' as const,
      respuesta: `Conductor ${conductor.nombre} guardado correctamente.`,
      cards: [{ titulo: 'Registro creado', valor: 'Conductor' }],
      detalle: `Cédula: ${conductor.cedula}\nLicencia: ${conductor.numero_licencia}\nSueldo semanal: ${money(conductor.sueldo_semanal)}`,
      sugerencias: ['Crear otro conductor', 'Crear un viaje']
    };
  }

  throw new AppError('Tipo de borrador no soportado.', 400);
};

const closureSummary = async (propietarioId: bigint | null, input: string) => {
  const week = parseWeek(input);
  if (!week) {
    return {
      respuesta: 'Indícame la semana que quieres revisar. Ejemplo: "revisa cierre semana 26".',
      cards: [],
      detalle: ''
    };
  }

  const year = parseYear(input);
  const rows = await prisma.cierreSemanal.findMany({
    where: {
      ...ownerWhere(propietarioId),
      anio: year,
      numero_semana: week
    },
    include: { vehiculo: true },
    orderBy: [{ resultado_operativo: 'asc' }],
    take: 8
  });

  const resultado = rows.reduce((sum, cierre) => sum.plus(toMoney(cierre.resultado_operativo)), toMoney(0));

  return {
    respuesta:
      rows.length === 0
        ? `No encontré cierres guardados para la semana ${week} de ${year}.`
        : `Encontré ${rows.length} cierre(s) guardado(s) para la semana ${week}. Ganancia total: ${money(resultado)}.`,
    cards: [
      { titulo: 'Cierres', valor: String(rows.length), detalle: `Semana ${week}` },
      { titulo: 'Ganancia', valor: money(resultado) }
    ],
    detalle: topRowsText(
      rows.map(
        (cierre) =>
          `${cierre.vehiculo.placa} | viajes: ${cierre.cantidad_viajes} | mant.: ${money(cierre.total_mantenimientos)} | ganancia: ${money(cierre.resultado_operativo)}`
      )
    )
  };
};

export const procesarMensajeAsistenteEngine = async (
  propietarioIdInput: unknown,
  input: AssistantEngineInput,
  audit?: AuditContext
) => {
  const tool = input.herramienta;
  const entities = input.entidades;
  const preferences = input.preferencias ?? [];
  const parsed = asistenteMensajeSchema.parse(input);
  const propietarioId = propietarioIdInput ? parseBigIntId(propietarioIdInput, 'propietario_id') : null;
  const normalized = normalizeText(parsed.mensaje);
  const queryContext = normalizeAssistantQueryContext(parsed);
  const analyticsContext = normalizeAnalyticsContext(parsed);

  if (parsed.contexto?.confirmar && parsed.contexto.action?.operacion === 'guardar') {
    return saveDraftFromContext(propietarioIdInput, parsed, audit);
  }

  if (parsed.contexto?.confirmar && parsed.contexto.action?.operacion === 'editar') {
    return saveDraftFromContext(propietarioIdInput, parsed, audit);
  }

  const openForm = openCreateFormAction(normalized, tool);
  if (openForm) {
    return {
      tipo: 'accion',
      respuesta: openForm.respuesta,
      cards: [],
      detalle: '',
      actions: [openForm.action],
      sugerencias: []
    };
  }

  const editDraft = await buildEditDraftFromText(propietarioId, parsed.mensaje, normalized);
  if (editDraft) {
    return {
      tipo: 'borrador',
      respuesta: `Preparé los cambios para el ${editDraft.tipo}. Confirma antes de aplicarlos.`,
      cards: [],
      detalle: '',
      draft: editDraft.draft,
      actions: [editDraft.action],
      sugerencias: ['Cancelar']
    };
  }

  const completedDraft = await completeDraftFromContext(
    propietarioId,
    parsed,
    normalized,
    preferences
  );

  if (completedDraft) {
    return {
      tipo: 'borrador',
      respuesta: `Actualice el borrador de ${completedDraft.draft.tipo}. ${completedDraft.sugerencias[0]}`,
      cards: [],
      detalle: '',
      draft: completedDraft.draft,
      actions: completedDraft.action
        ? actionsForDraft(completedDraft.action, completedDraft.draft.tipo, missingFromDraft(completedDraft.draft))
        : [],
      sugerencias: completedDraft.sugerencias
    };
  }

  const draftResult = await buildDraftFromText(
    propietarioId,
    parsed.mensaje,
    normalized,
    tool,
    entities,
    preferences
  );

  if (draftResult) {
    const draftLabel =
      draftResult.draft.tipo === 'viaje'
        ? 'viaje'
        : draftResult.draft.tipo === 'mantenimiento'
          ? 'mantenimiento'
          : draftResult.draft.tipo === 'cliente'
            ? 'cliente'
            : draftResult.draft.tipo === 'vehiculo'
              ? 'vehículo'
              : 'conductor';
    return {
      tipo: 'borrador',
      respuesta: `Preparé un ${draftLabel} como borrador. Todavía no guardo cambios desde el asistente.`,
      cards: [],
      detalle: '',
      draft: draftResult.draft,
      actions: draftResult.action
        ? actionsForDraft(draftResult.action, draftResult.draft.tipo, missingFromDraft(draftResult.draft))
        : [],
      sugerencias: draftResult.sugerencias?.length
        ? draftResult.sugerencias
        : [nextMissingSuggestion(missingFromDraft(draftResult.draft)), 'Cancelar']
    };
  }

  if (tool === 'analizar_operacion') {
    const basePlan = parseAnalyticsPlan(
      parsed.mensaje,
      normalized,
      entities,
      analyticsContext?.filtros
    );
    const resolved = await resolveAnalyticsConductor(
      propietarioId,
      normalized,
      entities ?? {},
      basePlan
    );
    if (resolved.ambiguos.length) {
      return {
        tipo: 'consulta',
        respuesta: `Encontré varios conductores que coinciden. Indica cuál deseas consultar: ${resolved.ambiguos.join(', ')}.`,
        cards: [],
        detalle: '',
        contexto: {
          tipo: 'analitica_viajes' as const,
          filtros: basePlan
        },
        sugerencias: resolved.ambiguos
      };
    }
    return analyticsTravelQuery(propietarioId, resolved.plan);
  }

  if (isTravelContinuation(normalized, queryContext)) {
    const result = await travelSummaryWithFilters(propietarioId, parsed.mensaje, normalized, queryContext?.filtros);
    return { tipo: 'consulta', ...result, sugerencias: ['Cambiar semana', 'Ver viajes'] };
  }

  if (
    (normalized.includes('ultimo') || normalized.includes('ultima')) &&
    !normalized.includes('viaje') &&
    (normalized.includes('mantenimiento') || normalized.includes('aceite') || normalized.includes('cambio'))
  ) {
    const result = await latestMaintenanceForVehicleList(propietarioId, normalized);
    return { tipo: 'consulta', ...result, sugerencias: ['Ver mantenimientos', 'Crear mantenimiento'] };
  }

  if ((normalized.includes('ultimo') || normalized.includes('ultima')) && normalized.includes('viaje')) {
    const result = await latestTripForVehicleDestination(propietarioId, normalized);
    return { tipo: 'consulta', ...result, sugerencias: ['Ver viajes', 'Crear viaje'] };
  }

  if (normalized.includes('proveedor') || normalized.includes('proveedores')) {
    const result = await pendingProviderTrips(propietarioId);
    return { tipo: 'consulta', ...result, sugerencias: ['Ver viajes proveedores', 'Copiar resumen'] };
  }

  if (normalized.includes('mantenimiento')) {
    const result = await maintenanceSummary(propietarioId, parsed.mensaje, normalized);
    return { tipo: 'consulta', ...result, sugerencias: ['Ver mantenimientos', 'Crear mantenimiento'] };
  }

  if (normalized.includes('cierre')) {
    const result = await closureSummary(propietarioId, parsed.mensaje);
    return { tipo: 'consulta', ...result, sugerencias: ['Ir a cierre semanal', 'Revisar alertas'] };
  }

  if (
    normalized.includes('pendiente') ||
    normalized.includes('sin cobrar') ||
    normalized.includes('por cobrar') ||
    normalized.includes('cobro')
  ) {
    const result = await pendingOwnTrips(propietarioId);
    return { tipo: 'consulta', ...result, sugerencias: ['Ver viajes', 'Marcar cobrados'] };
  }

  if (
    normalized.includes('viaje') ||
    normalized.includes('facture') ||
    normalized.includes('facture') ||
    normalized.includes('facturacion') ||
    normalized.includes('utilidad') ||
    normalized.includes('ganancia')
  ) {
    const result = await travelSummaryWithFilters(propietarioId, parsed.mensaje, normalized, queryContext?.filtros);
    return { tipo: 'consulta', ...result, sugerencias: ['Cambiar semana', 'Ver reporte de viajes'] };
  }

  throw new AppError(
    'Todavia no entendi esa solicitud. Prueba con: viajes pendientes de cobro, mantenimientos de junio, cierre semana 26, o crea un viaje.',
    400
  );
};

export const __testing = {
  assistantRecordId,
  billingPreviewFields,
  capacityFieldMatches,
  extractClientFields,
  extractConductorFields,
  extractVehicleFields,
  missingFromDraft,
  normalizeText,
  openCreateFormAction,
  parseAnalyticsPlan,
  parseGuidesNormalized,
  parseNamedMoneyValue,
  parseStructuredDate,
  parseWeek
};
