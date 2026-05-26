import {
  EstadoConductor,
  EstadoMantenimiento,
  EstadoVehiculo,
  EstadoViaje,
  Prisma,
  TipoGastoSemanalVehiculo
} from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import {
  formatGastoSemanal,
  formatGastosSemanales,
  toPrismaTipoGastoSemanal
} from './cierres-semanales.mapper.js';
import {
  cierreSemanalSemanaSchema,
  gastoSemanalFiltersSchema
} from './cierres-semanales.schema.js';
import type {
  CierreSemanalGenerarGastosInput,
  GastoSemanalCreateInput,
  GastoSemanalUpdateInput,
  TipoGastoSemanalApi
} from './cierres-semanales.schema.js';

const BONUS_CONFIG_DEFAULTS = {
  bonificacion_flete_monto_minimo: 1200,
  bonificacion_flete_monto_tramo: 100,
  bonificacion_flete_valor_tramo: 5,
  bonificacion_flete_monto_maximo: 0
} as const;

type BonusConfigKey = keyof typeof BONUS_CONFIG_DEFAULTS;

const viajeInclude = {
  cliente: true,
  vehiculo: true,
  conductor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  }
} satisfies Prisma.ViajeInclude;

const mantenimientoInclude = {
  vehiculo: true,
  tipo_mantenimiento: true,
  repuestos: {
    orderBy: { id: 'asc' }
  }
} satisfies Prisma.MantenimientoInclude;

const gastoSemanalInclude = {
  vehiculo: true,
  conductor: true
} satisfies Prisma.GastoSemanalVehiculoInclude;

type ViajeCierre = Prisma.ViajeGetPayload<{ include: typeof viajeInclude }>;
type MantenimientoCierre = Prisma.MantenimientoGetPayload<{
  include: typeof mantenimientoInclude;
}>;
type GastoSemanalCierre = Prisma.GastoSemanalVehiculoGetPayload<{
  include: typeof gastoSemanalInclude;
}>;
type GastoSemanalFormat = ReturnType<typeof formatGastoSemanal<GastoSemanalCierre>>;

const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
};

const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

const prismaToApiEstadoConductor = {
  [EstadoConductor.ACTIVO]: 'activo',
  [EstadoConductor.INACTIVO]: 'inactivo',
  [EstadoConductor.LICENCIA_VENCIDA]: 'licencia_vencida'
};

const prismaToApiEstadoMantenimiento = {
  [EstadoMantenimiento.PROGRAMADO]: 'programado',
  [EstadoMantenimiento.REALIZADO]: 'realizado',
  [EstadoMantenimiento.CANCELADO]: 'cancelado',
  [EstadoMantenimiento.VENCIDO]: 'vencido'
};

const toMoney = (value: number | string | Prisma.Decimal | null | undefined) => {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);
};

const zeroMoney = () => new Prisma.Decimal(0).toDecimalPlaces(2);

const addMoney = (
  left: number | string | Prisma.Decimal | null | undefined,
  right: number | string | Prisma.Decimal | null | undefined
) => {
  return toMoney(left).plus(toMoney(right)).toDecimalPlaces(2);
};

export const getIsoWeekRange = (anio: number, numeroSemana: number) => {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const fechaInicio = new Date(week1Monday);
  fechaInicio.setUTCDate(week1Monday.getUTCDate() + (numeroSemana - 1) * 7);

  const fechaFin = new Date(fechaInicio);
  fechaFin.setUTCDate(fechaInicio.getUTCDate() + 6);

  return { fechaInicio, fechaFin };
};

export const getBonusConfig = async (propietarioId: bigint) => {
  const keys = Object.keys(BONUS_CONFIG_DEFAULTS) as BonusConfigKey[];
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave: { in: keys },
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  const values: Record<BonusConfigKey, number> = { ...BONUS_CONFIG_DEFAULTS };

  for (const key of keys) {
    const own = configs.find(
      (item) => item.clave === key && item.propietario_id === propietarioId
    );
    const global = configs.find((item) => item.clave === key && item.propietario_id === null);
    const selected = own ?? global;
    const parsed = Number(selected?.valor);

    if (Number.isFinite(parsed) && parsed >= 0) {
      values[key] = parsed;
    }
  }

  return {
    bonificacion_flete_monto_minimo: toMoney(values.bonificacion_flete_monto_minimo),
    bonificacion_flete_monto_tramo: toMoney(values.bonificacion_flete_monto_tramo || 100),
    bonificacion_flete_valor_tramo: toMoney(values.bonificacion_flete_valor_tramo),
    bonificacion_flete_monto_maximo: toMoney(values.bonificacion_flete_monto_maximo)
  };
};

export const calculateBonificacion = (
  totalFletes: Prisma.Decimal,
  config: Awaited<ReturnType<typeof getBonusConfig>>
) => {
  if (totalFletes.lte(config.bonificacion_flete_monto_minimo)) {
    return zeroMoney();
  }

  const tramo = config.bonificacion_flete_monto_tramo.gt(0)
    ? config.bonificacion_flete_monto_tramo
    : toMoney(100);
  const tramos = Math.ceil(totalFletes.minus(config.bonificacion_flete_monto_minimo).div(tramo).toNumber());
  let bonificacion = config.bonificacion_flete_valor_tramo.mul(tramos).toDecimalPlaces(2);

  if (config.bonificacion_flete_monto_maximo.gt(0)) {
    bonificacion = Prisma.Decimal.min(
      bonificacion,
      config.bonificacion_flete_monto_maximo
    ).toDecimalPlaces(2);
  }

  return bonificacion;
};

const buildVehiculoMini = (vehiculo: {
  id: bigint;
  placa: string;
  marca: string;
  modelo: string | null;
  estado: EstadoVehiculo;
}) => ({
  id: vehiculo.id,
  placa: vehiculo.placa,
  marca: vehiculo.marca,
  modelo: vehiculo.modelo,
  estado: prismaToApiEstadoVehiculo[vehiculo.estado]
});

const buildConductorMini = (conductor: {
  id: bigint;
  nombre: string;
  cedula: string;
  sueldo_semanal: Prisma.Decimal;
  estado: EstadoConductor;
}) => ({
  id: conductor.id,
  nombre: conductor.nombre,
  cedula: conductor.cedula,
  sueldo_semanal: conductor.sueldo_semanal,
  estado: prismaToApiEstadoConductor[conductor.estado]
});

type VehiculoAsignacion = {
  vehiculo: ReturnType<typeof buildVehiculoMini>;
  cantidad_viajes: number;
  total_fletes: Prisma.Decimal;
};

const createTotalesViajes = () => ({
  precio_flete: zeroMoney(),
  precio_real_flete: zeroMoney(),
  costo_estimado_gastos: zeroMoney(),
  costo_real_gastos: zeroMoney(),
  utilidad: zeroMoney()
});

const createVehiculoGrupo = (vehiculo: ReturnType<typeof buildVehiculoMini>) => ({
  vehiculo,
  viajes: [] as ReturnType<typeof formatViajeCierre>[],
  mantenimientos: [] as ReturnType<typeof formatMantenimientoCierre>[],
  gastos_semanales: [] as GastoSemanalFormat[],
  totales: {
    ...createTotalesViajes(),
    mantenimientos: zeroMoney(),
    gastos_semanales: zeroMoney(),
    resultado_operativo: zeroMoney()
  }
});

const createConductorGrupo = (conductor: ReturnType<typeof buildConductorMini>) => ({
  conductor,
  viajes: [] as ReturnType<typeof formatViajeCierre>[],
  vehiculos: new Map<string, VehiculoAsignacion>(),
  totales: {
    precio_flete: zeroMoney()
  },
  bonificacion_sugerida: zeroMoney(),
  vehiculo_asignado_gasto: null as ReturnType<typeof buildVehiculoMini> | null,
  gasto_sueldo_generado: null as GastoSemanalFormat | null,
  gasto_bonificacion_generado: null as GastoSemanalFormat | null
});

const formatViajeCierre = (viaje: ViajeCierre, numeroSemana?: number) => {
  const costoRealGastos = toMoney(viaje.costo_real_gastos);
  const utilidad = toMoney(viaje.precio_real_flete).minus(costoRealGastos).toDecimalPlaces(2);
  const destino = viaje.tarifa_ruta.ruta.destino;
  const descripcionCarga = viaje.descripcion_carga?.trim() || 'carga';
  const guias = viaje.numeros_guia_remision.length
    ? viaje.numeros_guia_remision.join(', ')
    : 'sin guia';

  return {
    id: viaje.id,
    fecha_salida: viaje.fecha_salida,
    fecha_llegada: viaje.fecha_llegada,
    cliente: {
      id: viaje.cliente.id,
      nombre: viaje.cliente.nombre,
      ruc_cedula: viaje.cliente.ruc_cedula
    },
    vehiculo: buildVehiculoMini(viaje.vehiculo),
    conductor: buildConductorMini(viaje.conductor),
    ruta: {
      id: viaje.tarifa_ruta.ruta.id,
      origen: viaje.tarifa_ruta.ruta.origen,
      destino
    },
    tipo_carga: {
      id: viaje.tarifa_ruta.tipo_carga.id,
      nombre: viaje.tarifa_ruta.tipo_carga.nombre
    },
    descripcion_carga: viaje.descripcion_carga,
    numeros_guia_remision: viaje.numeros_guia_remision,
    precio_flete: viaje.precio_flete,
    precio_real_flete: viaje.precio_real_flete,
    costo_estimado_gastos: viaje.costo_estimado_gastos,
    costo_real_gastos: viaje.costo_real_gastos,
    utilidad,
    cobrado: viaje.cobrado,
    estado: prismaToApiEstadoViaje[viaje.estado],
    leyenda_facturacion: numeroSemana
      ? `1 viaje a ${destino}-${descripcionCarga} en sem#${numeroSemana}, guia #${guias}`
      : null
  };
};

const formatMantenimientoCierre = (mantenimiento: MantenimientoCierre) => ({
  id: mantenimiento.id,
  fecha_mantenimiento: mantenimiento.fecha_mantenimiento,
  vehiculo: buildVehiculoMini(mantenimiento.vehiculo),
  tipo_mantenimiento: {
    id: mantenimiento.tipo_mantenimiento.id,
    nombre: mantenimiento.tipo_mantenimiento.nombre
  },
  descripcion: mantenimiento.descripcion,
  costo_mano_obra: mantenimiento.costo_mano_obra,
  costo_repuestos: mantenimiento.costo_repuestos,
  costo_total: mantenimiento.costo_total,
  estado: prismaToApiEstadoMantenimiento[mantenimiento.estado],
  repuestos: mantenimiento.repuestos
});

const addViajeToTotales = (
  totales: ReturnType<typeof createTotalesViajes>,
  viaje: ViajeCierre
) => {
  const costoRealGastos = toMoney(viaje.costo_real_gastos);

  totales.precio_flete = addMoney(totales.precio_flete, viaje.precio_flete);
  totales.precio_real_flete = addMoney(totales.precio_real_flete, viaje.precio_real_flete);
  totales.costo_estimado_gastos = addMoney(
    totales.costo_estimado_gastos,
    viaje.costo_estimado_gastos
  );
  totales.costo_real_gastos = addMoney(totales.costo_real_gastos, costoRealGastos);
  totales.utilidad = addMoney(
    totales.utilidad,
    toMoney(viaje.precio_real_flete).minus(costoRealGastos)
  );
};

const selectVehiculoAsignado = (
  vehiculos: ReturnType<typeof createConductorGrupo>['vehiculos']
) => {
  let selected: VehiculoAsignacion | null = null;

  for (const item of vehiculos.values()) {
    if (!selected) {
      selected = item;
      continue;
    }

    if (item.cantidad_viajes > selected.cantidad_viajes) {
      selected = item;
      continue;
    }

    if (
      item.cantidad_viajes === selected.cantidad_viajes &&
      item.total_fletes.gt(selected.total_fletes)
    ) {
      selected = item;
    }
  }

  return selected;
};

const getGastoSemanalById = async (propietarioId: bigint, id: bigint) => {
  const gasto = await prisma.gastoSemanalVehiculo.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    },
    include: gastoSemanalInclude
  });

  if (!gasto) {
    throw new AppError('Gasto semanal no encontrado', 404);
  }

  return gasto;
};

const ensureVehiculo = async (propietarioId: bigint, vehiculoId: bigint) => {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      id: vehiculoId,
      propietario_id: propietarioId
    }
  });

  if (!vehiculo) {
    throw new AppError('Vehiculo no encontrado', 404);
  }

  return vehiculo;
};

const ensureConductor = async (propietarioId: bigint, conductorId: bigint) => {
  const conductor = await prisma.conductor.findFirst({
    where: {
      id: conductorId,
      propietario_id: propietarioId
    }
  });

  if (!conductor) {
    throw new AppError('Conductor no encontrado', 404);
  }

  return conductor;
};

const assertConductorForGeneratedType = (
  tipo: TipoGastoSemanalVehiculo,
  conductorId: bigint | null
) => {
  if (
    (tipo === TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR ||
      tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR) &&
    !conductorId
  ) {
    throw new AppError('conductor_id es obligatorio para sueldo o bonificacion', 400);
  }
};

const buildCierreData = async (
  propietarioId: bigint,
  anio: number,
  numeroSemana: number
) => {
  const { fechaInicio, fechaFin } = getIsoWeekRange(anio, numeroSemana);
  const [config, viajes, mantenimientos, gastosSemanales] = await Promise.all([
    getBonusConfig(propietarioId),
    prisma.viaje.findMany({
      where: {
        propietario_id: propietarioId,
        estado: { not: EstadoViaje.CANCELADO },
        fecha_salida: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: viajeInclude,
      orderBy: [{ fecha_salida: 'asc' }, { id: 'asc' }]
    }),
    prisma.mantenimiento.findMany({
      where: {
        propietario_id: propietarioId,
        estado: { not: EstadoMantenimiento.CANCELADO },
        fecha_mantenimiento: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: mantenimientoInclude,
      orderBy: [{ fecha_mantenimiento: 'asc' }, { id: 'asc' }]
    }),
    prisma.gastoSemanalVehiculo.findMany({
      where: {
        propietario_id: propietarioId,
        anio,
        numero_semana: numeroSemana
      },
      include: gastoSemanalInclude,
      orderBy: [{ vehiculo_id: 'asc' }, { tipo: 'asc' }, { id: 'asc' }]
    })
  ]);

  const vehiculos = new Map<string, ReturnType<typeof createVehiculoGrupo>>();
  const conductores = new Map<string, ReturnType<typeof createConductorGrupo>>();
  const gastosPorConductorTipo = new Map<string, GastoSemanalCierre>();
  const totales = {
    ...createTotalesViajes(),
    mantenimientos: zeroMoney(),
    gastos_semanales: zeroMoney(),
    sueldos_sugeridos: zeroMoney(),
    bonificaciones_sugeridas: zeroMoney(),
    resultado_operativo: zeroMoney()
  };

  const getVehiculoGrupo = (vehiculo: ReturnType<typeof buildVehiculoMini>) => {
    const key = vehiculo.id.toString();
    let grupo = vehiculos.get(key);

    if (!grupo) {
      grupo = createVehiculoGrupo(vehiculo);
      vehiculos.set(key, grupo);
    }

    return grupo;
  };

  const getConductorGrupo = (conductor: ReturnType<typeof buildConductorMini>) => {
    const key = conductor.id.toString();
    let grupo = conductores.get(key);

    if (!grupo) {
      grupo = createConductorGrupo(conductor);
      conductores.set(key, grupo);
    }

    return grupo;
  };

  for (const viaje of viajes) {
    const viajeFormat = formatViajeCierre(viaje, numeroSemana);
    const vehiculoGrupo = getVehiculoGrupo(viajeFormat.vehiculo);
    const conductorGrupo = getConductorGrupo(viajeFormat.conductor);

    vehiculoGrupo.viajes.push(viajeFormat);
    conductorGrupo.viajes.push(viajeFormat);
    addViajeToTotales(vehiculoGrupo.totales, viaje);
    addViajeToTotales(totales, viaje);

    conductorGrupo.totales.precio_flete = addMoney(
      conductorGrupo.totales.precio_flete,
      viaje.precio_flete
    );

    const vehiculoKey = viaje.vehiculo_id.toString();
    const vehiculoAsignacion = conductorGrupo.vehiculos.get(vehiculoKey) ?? {
      vehiculo: viajeFormat.vehiculo,
      cantidad_viajes: 0,
      total_fletes: zeroMoney()
    };
    vehiculoAsignacion.cantidad_viajes += 1;
    vehiculoAsignacion.total_fletes = addMoney(
      vehiculoAsignacion.total_fletes,
      viaje.precio_flete
    );
    conductorGrupo.vehiculos.set(vehiculoKey, vehiculoAsignacion);
  }

  for (const mantenimiento of mantenimientos) {
    const mantenimientoFormat = formatMantenimientoCierre(mantenimiento);
    const vehiculoGrupo = getVehiculoGrupo(mantenimientoFormat.vehiculo);

    vehiculoGrupo.mantenimientos.push(mantenimientoFormat);
    vehiculoGrupo.totales.mantenimientos = addMoney(
      vehiculoGrupo.totales.mantenimientos,
      mantenimiento.costo_total
    );
    totales.mantenimientos = addMoney(totales.mantenimientos, mantenimiento.costo_total);
  }

  for (const gasto of gastosSemanales) {
    const gastoFormat = formatGastoSemanal(gasto);
    const vehiculoGrupo = getVehiculoGrupo(buildVehiculoMini(gasto.vehiculo));

    vehiculoGrupo.gastos_semanales.push(gastoFormat);
    vehiculoGrupo.totales.gastos_semanales = addMoney(
      vehiculoGrupo.totales.gastos_semanales,
      gasto.monto
    );
    totales.gastos_semanales = addMoney(totales.gastos_semanales, gasto.monto);

    if (gasto.conductor_id) {
      gastosPorConductorTipo.set(`${gasto.conductor_id}:${gasto.tipo}`, gasto);
    }
  }

  const conductoresOperativos: {
    conductor_id: bigint;
    vehiculo_id: bigint;
    sueldo_semanal: Prisma.Decimal;
    bonificacion_sugerida: Prisma.Decimal;
  }[] = [];

  for (const conductorGrupo of conductores.values()) {
    const vehiculoAsignado = selectVehiculoAsignado(conductorGrupo.vehiculos);
    const bonificacion = calculateBonificacion(conductorGrupo.totales.precio_flete, config);
    conductorGrupo.bonificacion_sugerida = bonificacion;
    conductorGrupo.vehiculo_asignado_gasto = vehiculoAsignado?.vehiculo ?? null;

    const gastoSueldo = gastosPorConductorTipo.get(
      `${conductorGrupo.conductor.id}:${TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR}`
    );
    const gastoBonificacion = gastosPorConductorTipo.get(
      `${conductorGrupo.conductor.id}:${TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR}`
    );
    conductorGrupo.gasto_sueldo_generado = gastoSueldo ? formatGastoSemanal(gastoSueldo) : null;
    conductorGrupo.gasto_bonificacion_generado = gastoBonificacion
      ? formatGastoSemanal(gastoBonificacion)
      : null;

    totales.sueldos_sugeridos = addMoney(
      totales.sueldos_sugeridos,
      conductorGrupo.conductor.sueldo_semanal
    );
    totales.bonificaciones_sugeridas = addMoney(totales.bonificaciones_sugeridas, bonificacion);

    if (vehiculoAsignado) {
      conductoresOperativos.push({
        conductor_id: conductorGrupo.conductor.id,
        vehiculo_id: vehiculoAsignado.vehiculo.id,
        sueldo_semanal: toMoney(conductorGrupo.conductor.sueldo_semanal),
        bonificacion_sugerida: bonificacion
      });
    }
  }

  for (const vehiculoGrupo of vehiculos.values()) {
    vehiculoGrupo.totales.resultado_operativo = toMoney(vehiculoGrupo.totales.utilidad)
      .minus(vehiculoGrupo.totales.mantenimientos)
      .minus(vehiculoGrupo.totales.gastos_semanales)
      .toDecimalPlaces(2);
  }

  totales.resultado_operativo = toMoney(totales.utilidad)
    .minus(totales.mantenimientos)
    .minus(totales.gastos_semanales)
    .toDecimalPlaces(2);

  return {
    semana: {
      anio,
      numero_semana: numeroSemana,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    },
    configuracion_bonificacion: config,
    resumen: {
      cantidad_viajes: viajes.length,
      cantidad_mantenimientos: mantenimientos.length,
      cantidad_gastos_semanales: gastosSemanales.length,
      totales
    },
    vehiculos: [...vehiculos.values()]
      .map((grupo) => ({
        ...grupo,
        cantidad_viajes: grupo.viajes.length,
        cantidad_mantenimientos: grupo.mantenimientos.length,
        cantidad_gastos_semanales: grupo.gastos_semanales.length
      }))
      .sort((a, b) => a.vehiculo.placa.localeCompare(b.vehiculo.placa)),
    conductores: [...conductores.values()]
      .map((grupo) => ({
        conductor: grupo.conductor,
        cantidad_viajes: grupo.viajes.length,
        viajes: grupo.viajes,
        vehiculos_trabajados: [...grupo.vehiculos.values()].map((item) => ({
          vehiculo: item.vehiculo,
          cantidad_viajes: item.cantidad_viajes,
          total_fletes: item.total_fletes
        })),
        totales: grupo.totales,
        sueldo_semanal: grupo.conductor.sueldo_semanal,
        bonificacion_sugerida: grupo.bonificacion_sugerida,
        vehiculo_asignado_gasto: grupo.vehiculo_asignado_gasto,
        gasto_sueldo_generado: grupo.gasto_sueldo_generado,
        gasto_bonificacion_generado: grupo.gasto_bonificacion_generado
      }))
      .sort((a, b) => a.conductor.nombre.localeCompare(b.conductor.nombre)),
    conductores_operativos: conductoresOperativos
  };
};

const upsertGeneratedGasto = async (
  tx: Prisma.TransactionClient,
  data: {
    propietarioId: bigint;
    vehiculoId: bigint;
    conductorId: bigint;
    anio: number;
    numeroSemana: number;
    fechaInicio: Date;
    fechaFin: Date;
    tipo: TipoGastoSemanalVehiculo;
    descripcion: string;
    monto: Prisma.Decimal;
  }
) => {
  const existing = await tx.gastoSemanalVehiculo.findFirst({
    where: {
      propietario_id: data.propietarioId,
      conductor_id: data.conductorId,
      anio: data.anio,
      numero_semana: data.numeroSemana,
      tipo: data.tipo
    }
  });

  if (data.monto.lte(0) && !existing) {
    return null;
  }

  if (existing) {
    return tx.gastoSemanalVehiculo.update({
      where: { id: existing.id },
      data: {
        vehiculo_id: data.vehiculoId,
        fecha_inicio: data.fechaInicio,
        fecha_fin: data.fechaFin,
        descripcion: data.descripcion,
        monto: data.monto,
        es_generado: true
      },
      include: gastoSemanalInclude
    });
  }

  return tx.gastoSemanalVehiculo.create({
    data: {
      propietario_id: data.propietarioId,
      vehiculo_id: data.vehiculoId,
      conductor_id: data.conductorId,
      anio: data.anio,
      numero_semana: data.numeroSemana,
      fecha_inicio: data.fechaInicio,
      fecha_fin: data.fechaFin,
      tipo: data.tipo,
      descripcion: data.descripcion,
      monto: data.monto,
      es_generado: true
    },
    include: gastoSemanalInclude
  });
};

export const getCierreSemanal = async (propietarioIdInput: unknown, input: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const parsed = cierreSemanalSemanaSchema.parse(input);
  const cierre = await buildCierreData(propietarioId, parsed.anio, parsed.numero_semana);

  const { conductores_operativos: _internal, ...response } = cierre;
  return response;
};

export const generarGastosCierreSemanal = async (
  propietarioIdInput: unknown,
  input: CierreSemanalGenerarGastosInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const cierre = await buildCierreData(propietarioId, input.anio, input.numero_semana);

  const gastos = await prisma.$transaction(async (tx) => {
    const items: GastoSemanalCierre[] = [];

    for (const conductor of cierre.conductores_operativos) {
      if (input.generar_sueldos) {
        const gasto = await upsertGeneratedGasto(tx, {
          propietarioId,
          vehiculoId: conductor.vehiculo_id,
          conductorId: conductor.conductor_id,
          anio: cierre.semana.anio,
          numeroSemana: cierre.semana.numero_semana,
          fechaInicio: cierre.semana.fecha_inicio,
          fechaFin: cierre.semana.fecha_fin,
          tipo: TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR,
          descripcion: `Sueldo semanal conductor sem#${cierre.semana.numero_semana}`,
          monto: conductor.sueldo_semanal
        });

        if (gasto) items.push(gasto);
      }

      if (input.generar_bonificaciones) {
        const gasto = await upsertGeneratedGasto(tx, {
          propietarioId,
          vehiculoId: conductor.vehiculo_id,
          conductorId: conductor.conductor_id,
          anio: cierre.semana.anio,
          numeroSemana: cierre.semana.numero_semana,
          fechaInicio: cierre.semana.fecha_inicio,
          fechaFin: cierre.semana.fecha_fin,
          tipo: TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR,
          descripcion: `Bonificacion conductor sem#${cierre.semana.numero_semana}`,
          monto: conductor.bonificacion_sugerida
        });

        if (gasto) items.push(gasto);
      }
    }

    return items;
  });

  const cierreActualizado = await buildCierreData(propietarioId, input.anio, input.numero_semana);
  const { conductores_operativos: _internal, ...response } = cierreActualizado;

  return {
    gastos_generados: formatGastosSemanales(gastos),
    cierre: response
  };
};

export const listGastosSemanales = async (propietarioIdInput: unknown, filters: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const parsed = gastoSemanalFiltersSchema.parse(filters);
  const where: Prisma.GastoSemanalVehiculoWhereInput = {
    propietario_id: propietarioId
  };

  if (parsed.anio !== undefined) where.anio = parsed.anio;
  if (parsed.numero_semana !== undefined) where.numero_semana = parsed.numero_semana;
  if (parsed.vehiculo_id) where.vehiculo_id = parseBigIntId(parsed.vehiculo_id, 'vehiculo_id');
  if (parsed.conductor_id) {
    where.conductor_id = parseBigIntId(parsed.conductor_id, 'conductor_id');
  }
  if (parsed.tipo) where.tipo = toPrismaTipoGastoSemanal(parsed.tipo);

  const gastos = await prisma.gastoSemanalVehiculo.findMany({
    where,
    include: gastoSemanalInclude,
    orderBy: [{ anio: 'desc' }, { numero_semana: 'desc' }, { id: 'desc' }]
  });

  return formatGastosSemanales(gastos);
};

export const createGastoSemanal = async (
  propietarioIdInput: unknown,
  input: GastoSemanalCreateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const vehiculoId = parseBigIntId(input.vehiculo_id, 'vehiculo_id');
  const conductorId = input.conductor_id
    ? parseBigIntId(input.conductor_id, 'conductor_id')
    : null;
  const tipo = toPrismaTipoGastoSemanal(input.tipo ?? 'varios')!;
  const { fechaInicio, fechaFin } = getIsoWeekRange(input.anio, input.numero_semana);

  assertConductorForGeneratedType(tipo, conductorId);
  await ensureVehiculo(propietarioId, vehiculoId);
  if (conductorId) await ensureConductor(propietarioId, conductorId);

  const gasto = await prisma.gastoSemanalVehiculo.create({
    data: {
      propietario_id: propietarioId,
      vehiculo_id: vehiculoId,
      conductor_id: conductorId,
      anio: input.anio,
      numero_semana: input.numero_semana,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      tipo,
      descripcion: input.descripcion,
      monto: toMoney(input.monto),
      es_generado: input.es_generado ?? false
    },
    include: gastoSemanalInclude
  });

  return formatGastoSemanal(gasto);
};

export const updateGastoSemanal = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: GastoSemanalUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getGastoSemanalById(propietarioId, id);
  const vehiculoId = input.vehiculo_id
    ? parseBigIntId(input.vehiculo_id, 'vehiculo_id')
    : current.vehiculo_id;
  const conductorId = Object.hasOwn(input, 'conductor_id')
    ? input.conductor_id
      ? parseBigIntId(input.conductor_id, 'conductor_id')
      : null
    : current.conductor_id;
  const tipo = input.tipo ? toPrismaTipoGastoSemanal(input.tipo)! : current.tipo;
  const anio = input.anio ?? current.anio;
  const numeroSemana = input.numero_semana ?? current.numero_semana;
  const { fechaInicio, fechaFin } = getIsoWeekRange(anio, numeroSemana);

  assertConductorForGeneratedType(tipo, conductorId);
  if (input.vehiculo_id) await ensureVehiculo(propietarioId, vehiculoId);
  if (conductorId && Object.hasOwn(input, 'conductor_id')) {
    await ensureConductor(propietarioId, conductorId);
  }

  const gasto = await prisma.gastoSemanalVehiculo.update({
    where: { id },
    data: {
      vehiculo_id: input.vehiculo_id ? vehiculoId : undefined,
      conductor_id: Object.hasOwn(input, 'conductor_id') ? conductorId : undefined,
      anio: input.anio,
      numero_semana: input.numero_semana,
      fecha_inicio:
        input.anio !== undefined || input.numero_semana !== undefined ? fechaInicio : undefined,
      fecha_fin:
        input.anio !== undefined || input.numero_semana !== undefined ? fechaFin : undefined,
      tipo: input.tipo ? tipo : undefined,
      descripcion: Object.hasOwn(input, 'descripcion') ? input.descripcion : undefined,
      monto: input.monto !== undefined ? toMoney(input.monto) : undefined,
      es_generado: input.es_generado
    },
    include: gastoSemanalInclude
  });

  return formatGastoSemanal(gasto);
};

export const deleteGastoSemanal = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getGastoSemanalById(propietarioId, id);

  const gasto = await prisma.gastoSemanalVehiculo.delete({
    where: { id },
    include: gastoSemanalInclude
  });

  return formatGastoSemanal(gasto);
};
