import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  CONFIG_DEFINITIONS,
  OWNER_CONFIG_KEYS,
  SUPER_ADMIN_CONFIG_KEYS,
  type ConfigKey,
  type ConfiguracionUpdateInput,
  type OwnerConfigKey,
  type SuperAdminConfigKey
} from './configuraciones.schema.js';

const DEFAULT_VALUES = {
  precio_galon_diesel: '2',
  bonificacion_flete_monto_minimo: '1200',
  bonificacion_flete_monto_tramo: '100',
  bonificacion_flete_valor_tramo: '5',
  bonificacion_flete_monto_maximo: '0',
  alerta_mantenimiento_km_anticipacion: '500',
  alerta_licencia_dias_anticipacion: '90',
  alerta_viaje_sin_cobrar_semanas: '5'
} satisfies Record<ConfigKey, string>;

const isOwnerConfigKey = (value: string): value is OwnerConfigKey => {
  return OWNER_CONFIG_KEYS.includes(value as OwnerConfigKey);
};

const isSuperAdminConfigKey = (value: string): value is SuperAdminConfigKey => {
  return SUPER_ADMIN_CONFIG_KEYS.includes(value as SuperAdminConfigKey);
};

const formatConfig = (
  key: ConfigKey,
  config: {
    valor: string;
    descripcion: string | null;
    propietario_id: bigint | null;
    updated_at?: Date;
  } | null
) => {
  const definition = CONFIG_DEFINITIONS[key];

  return {
    id: key,
    clave: key,
    nombre: definition.nombre,
    valor: config?.valor ?? DEFAULT_VALUES[key],
    descripcion: config?.descripcion ?? definition.descripcion,
    origen: config?.propietario_id ? 'propietario' : 'global',
    updated_at: config?.updated_at ?? null
  };
};

const getSelectedConfigs = async (keys: readonly ConfigKey[], propietarioId?: bigint) => {
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave: { in: [...keys] },
      OR: propietarioId
        ? [{ propietario_id: null }, { propietario_id: propietarioId }]
        : [{ propietario_id: null }]
    }
  });

  return keys.map((key) => {
    const own = propietarioId
      ? configs.find((item) => item.clave === key && item.propietario_id === propietarioId)
      : null;
    const global = configs.find((item) => item.clave === key && item.propietario_id === null);

    return formatConfig(key, own ?? global ?? null);
  });
};

const upsertConfig = async (
  where: Prisma.ConfiguracionOperativaWhereInput,
  data: {
    propietario_id: bigint | null;
    clave: ConfigKey;
    valor: string;
    descripcion: string | null;
  }
) => {
  const current = await prisma.configuracionOperativa.findFirst({ where });

  if (current) {
    return prisma.configuracionOperativa.update({
      where: { id: current.id },
      data: {
        valor: data.valor,
        descripcion: data.descripcion
      }
    });
  }

  return prisma.configuracionOperativa.create({ data });
};

export const listConfiguracionesPropietario = async (propietarioIdInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  return getSelectedConfigs(OWNER_CONFIG_KEYS, propietarioId);
};

export const updateConfiguracionPropietario = async (
  propietarioIdInput: unknown,
  claveInput: unknown,
  input: ConfiguracionUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const clave = String(claveInput ?? '');

  if (!isOwnerConfigKey(clave)) {
    throw new AppError('Esta configuracion no puede ser modificada por el propietario', 403);
  }

  const config = await upsertConfig(
    {
      propietario_id: propietarioId,
      clave
    },
    {
      propietario_id: propietarioId,
      clave,
      valor: input.valor,
      descripcion: input.descripcion ?? CONFIG_DEFINITIONS[clave].descripcion
    }
  );

  return formatConfig(clave, config);
};

export const listConfiguracionesSuperAdmin = async () => {
  return getSelectedConfigs(SUPER_ADMIN_CONFIG_KEYS);
};

export const updateConfiguracionSuperAdmin = async (
  claveInput: unknown,
  input: ConfiguracionUpdateInput
) => {
  const clave = String(claveInput ?? '');

  if (!isSuperAdminConfigKey(clave)) {
    throw new AppError('Solo el precio del diesel es exclusivo del superadmin', 403);
  }

  const config = await upsertConfig(
    {
      propietario_id: null,
      clave
    },
    {
      propietario_id: null,
      clave,
      valor: input.valor,
      descripcion: input.descripcion ?? CONFIG_DEFINITIONS[clave].descripcion
    }
  );

  return formatConfig(clave, config);
};
