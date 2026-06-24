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
  },
  gastos_viaje: {
    include: {
      tipo_gasto: true
    },
    orderBy: { id: 'asc' }
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

const normalizeText = (value: unknown) => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

const isRetornoGastoViaje = (value: unknown) => normalizeText(value) === 'RETORNO';

const viajeFechaEntrega = (viaje: { fecha_salida: Date; fecha_llegada: Date | null }) =>
  viaje.fecha_llegada ?? viaje.fecha_salida;

const buildViajeSemanaWhere = (fechaInicio: Date, fechaFin: Date): Prisma.ViajeWhereInput => ({
  OR: [
    {
      fecha_llegada: {
        gte: fechaInicio,
        lte: fechaFin
      }
    },
    {
      fecha_llegada: null,
      fecha_salida: {
        gte: fechaInicio,
        lte: fechaFin
      }
    }
  ]
});

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

const todayUtcDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const assertSemanaTerminada = (fechaFin: Date) => {
  if (todayUtcDateOnly() <= fechaFin) {
    throw new AppError('No se pueden generar gastos porque la semana aun no termina', 400);
  }
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
  const retornoGastosViaje = viaje.gastos_viaje
    .filter((gasto) => isRetornoGastoViaje(gasto.tipo_gasto.nombre))
    .reduce((total, gasto) => total.plus(toMoney(gasto.monto)), zeroMoney())
    .toDecimalPlaces(2);
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
    retorno_gastos_viaje: retornoGastosViaje,
    precio_real_flete: viaje.precio_real_flete,
    viaticos: viaje.viaticos,
    costo_estimado_gastos: viaje.costo_estimado_gastos,
    costo_real_gastos: viaje.costo_real_gastos,
    utilidad,
    cobrado: viaje.cobrado,
    retorno: viaje.retorno,
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
  numeroSemana: number,
  vehiculoIdInput: unknown
) => {
  const vehiculoId = parseBigIntId(vehiculoIdInput, 'vehiculo_id');
  const { fechaInicio, fechaFin } = getIsoWeekRange(anio, numeroSemana);
  const vehiculoSeleccionado = await ensureVehiculo(propietarioId, vehiculoId);
  const vehiculoSeleccionadoMini = buildVehiculoMini(vehiculoSeleccionado);
  const [config, viajes, mantenimientos, gastosSemanales] = await Promise.all([
    getBonusConfig(propietarioId),
    prisma.viaje.findMany({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        estado: { not: EstadoViaje.CANCELADO },
        ...buildViajeSemanaWhere(fechaInicio, fechaFin)
      },
      include: viajeInclude,
      orderBy: [{ fecha_llegada: 'asc' }, { fecha_salida: 'asc' }, { id: 'asc' }]
    }),
    prisma.mantenimiento.findMany({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        estado: EstadoMantenimiento.REALIZADO,
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
        vehiculo_id: vehiculoId,
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
  const viajesDetalle: ReturnType<typeof formatViajeCierre>[] = [];
  const mantenimientosDetalle: ReturnType<typeof formatMantenimientoCierre>[] = [];
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

  getVehiculoGrupo(vehiculoSeleccionadoMini);

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

    viajesDetalle.push(viajeFormat);
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

    mantenimientosDetalle.push(mantenimientoFormat);
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
    vehiculo: vehiculoSeleccionadoMini,
    configuracion_bonificacion: config,
    resumen: {
      cantidad_viajes: viajes.length,
      cantidad_mantenimientos: mantenimientos.length,
      cantidad_gastos_semanales: gastosSemanales.length,
      cantidad_gastos_generados: gastosSemanales.filter((gasto) => gasto.es_generado).length,
      totales
    },
    viajes: viajesDetalle,
    mantenimientos: mantenimientosDetalle,
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

type CierreData = Awaited<ReturnType<typeof buildCierreData>>;

const moneyString = (value: number | string | Prisma.Decimal | null | undefined) =>
  toMoney(value).toFixed(2);

const dateOnlyString = (value: Date) => value.toISOString().slice(0, 10);

const buildCierreMetrics = (cierre: CierreData) => ({
  cantidad_viajes: cierre.resumen.cantidad_viajes,
  cantidad_mantenimientos: cierre.resumen.cantidad_mantenimientos,
  cantidad_gastos_semanales: cierre.resumen.cantidad_gastos_semanales,
  total_precio_flete: toMoney(cierre.resumen.totales.precio_flete),
  total_precio_real_flete: toMoney(cierre.resumen.totales.precio_real_flete),
  total_utilidad: toMoney(cierre.resumen.totales.utilidad),
  total_mantenimientos: toMoney(cierre.resumen.totales.mantenimientos),
  total_gastos_semanales: toMoney(cierre.resumen.totales.gastos_semanales),
  total_sueldos: toMoney(cierre.resumen.totales.sueldos_sugeridos),
  total_bonificaciones: toMoney(cierre.resumen.totales.bonificaciones_sugeridas),
  resultado_operativo: toMoney(cierre.resumen.totales.resultado_operativo)
});

const buildCierreSnapshot = (cierre: CierreData) => {
  const metrics = buildCierreMetrics(cierre);

  return {
    version: 1,
    semana: {
      anio: cierre.semana.anio,
      numero_semana: cierre.semana.numero_semana,
      fecha_inicio: dateOnlyString(cierre.semana.fecha_inicio),
      fecha_fin: dateOnlyString(cierre.semana.fecha_fin)
    },
    vehiculo: {
      id: String(cierre.vehiculo.id),
      placa: cierre.vehiculo.placa,
      marca: cierre.vehiculo.marca,
      modelo: cierre.vehiculo.modelo
    },
    resumen: {
      cantidad_viajes: metrics.cantidad_viajes,
      cantidad_mantenimientos: metrics.cantidad_mantenimientos,
      cantidad_gastos_semanales: metrics.cantidad_gastos_semanales,
      totales: {
        total_precio_flete: moneyString(metrics.total_precio_flete),
        total_precio_real_flete: moneyString(metrics.total_precio_real_flete),
        total_utilidad: moneyString(metrics.total_utilidad),
        total_mantenimientos: moneyString(metrics.total_mantenimientos),
        total_gastos_semanales: moneyString(metrics.total_gastos_semanales),
        total_sueldos: moneyString(metrics.total_sueldos),
        total_bonificaciones: moneyString(metrics.total_bonificaciones),
        resultado_operativo: moneyString(metrics.resultado_operativo)
      }
    },
    viajes: cierre.viajes.map((viaje) => ({
      id: String(viaje.id),
      fecha_salida: dateOnlyString(viaje.fecha_salida),
      fecha_llegada: viaje.fecha_llegada ? dateOnlyString(viaje.fecha_llegada) : null,
      fecha_semana: dateOnlyString(viajeFechaEntrega(viaje)),
      cliente: viaje.cliente.nombre,
      ruta: `${viaje.ruta.origen} - ${viaje.ruta.destino}`,
      precio_flete: moneyString(viaje.precio_flete),
      precio_real_flete: moneyString(viaje.precio_real_flete),
      viaticos: moneyString(viaje.viaticos),
      costo_real_gastos: moneyString(viaje.costo_real_gastos),
      utilidad: moneyString(viaje.utilidad),
      retorno: viaje.retorno,
      estado: viaje.estado
    })),
    mantenimientos: cierre.mantenimientos.map((mantenimiento) => ({
      id: String(mantenimiento.id),
      fecha_mantenimiento: dateOnlyString(mantenimiento.fecha_mantenimiento),
      tipo_mantenimiento: mantenimiento.tipo_mantenimiento.nombre,
      costo_total: moneyString(mantenimiento.costo_total),
      estado: mantenimiento.estado
    })),
    gastos_semanales: cierre.vehiculos.flatMap((grupo) =>
      grupo.gastos_semanales.map((gasto) => ({
        id: String(gasto.id),
        tipo: gasto.tipo,
        conductor_id: gasto.conductor_id ? String(gasto.conductor_id) : null,
        monto: moneyString(gasto.monto),
        es_generado: gasto.es_generado
      }))
    ),
    conductores: cierre.conductores.map((item) => ({
      id: String(item.conductor.id),
      nombre: item.conductor.nombre,
      sueldo_semanal: moneyString(item.sueldo_semanal),
      bonificacion_sugerida: moneyString(item.bonificacion_sugerida)
    }))
  } satisfies Prisma.InputJsonObject;
};

const saveCierreSemanalSnapshot = async (
  propietarioId: bigint,
  cierre: CierreData,
  cerradoPorUsuarioIdInput?: unknown
) => {
  const metrics = buildCierreMetrics(cierre);
  const snapshot = buildCierreSnapshot(cierre);
  const cerradoPorUsuarioId =
    cerradoPorUsuarioIdInput === undefined
      ? undefined
      : parseBigIntId(cerradoPorUsuarioIdInput, 'usuario_id');
  const data = {
    fecha_inicio: cierre.semana.fecha_inicio,
    fecha_fin: cierre.semana.fecha_fin,
    cantidad_viajes: metrics.cantidad_viajes,
    cantidad_mantenimientos: metrics.cantidad_mantenimientos,
    cantidad_gastos_semanales: metrics.cantidad_gastos_semanales,
    total_precio_flete: metrics.total_precio_flete,
    total_precio_real_flete: metrics.total_precio_real_flete,
    total_utilidad: metrics.total_utilidad,
    total_mantenimientos: metrics.total_mantenimientos,
    total_gastos_semanales: metrics.total_gastos_semanales,
    total_sueldos: metrics.total_sueldos,
    total_bonificaciones: metrics.total_bonificaciones,
    resultado_operativo: metrics.resultado_operativo,
    cerrado_por_usuario_id: cerradoPorUsuarioId,
    snapshot
  };

  return prisma.cierreSemanal.upsert({
    where: {
      propietario_id_vehiculo_id_anio_numero_semana: {
        propietario_id: propietarioId,
        vehiculo_id: parseBigIntId(cierre.vehiculo.id, 'vehiculo_id'),
        anio: cierre.semana.anio,
        numero_semana: cierre.semana.numero_semana
      }
    },
    create: {
      propietario_id: propietarioId,
      vehiculo_id: parseBigIntId(cierre.vehiculo.id, 'vehiculo_id'),
      anio: cierre.semana.anio,
      numero_semana: cierre.semana.numero_semana,
      ...data
    },
    update: {
      ...data,
      cerrado_en: new Date()
    }
  });
};

const countComparisons = [
  { key: 'cantidad_viajes', label: 'Viajes' },
  { key: 'cantidad_mantenimientos', label: 'Mantenimientos' },
  { key: 'cantidad_gastos_semanales', label: 'Gastos semanales' }
] as const;

const moneyComparisons = [
  { key: 'total_precio_flete', label: 'Total viajes' },
  { key: 'total_precio_real_flete', label: 'Valor a facturar' },
  { key: 'total_utilidad', label: 'Utilidad viajes' },
  { key: 'total_mantenimientos', label: 'Mantenimientos' },
  { key: 'total_gastos_semanales', label: 'Gastos semanales' },
  { key: 'total_sueldos', label: 'Sueldo semanal' },
  { key: 'total_bonificaciones', label: 'Bono' },
  { key: 'resultado_operativo', label: 'Ganancia semanal' }
] as const;

const buildCierreDiferencias = (
  cierre: Prisma.CierreSemanalGetPayload<{ include: { vehiculo: true } }>,
  currentMetrics: ReturnType<typeof buildCierreMetrics>
) => {
  const diferencias: {
    campo: string;
    label: string;
    valor_cierre: string | number;
    valor_actual: string | number;
    diferencia?: string;
  }[] = [];

  for (const item of countComparisons) {
    const stored = cierre[item.key];
    const current = currentMetrics[item.key];

    if (stored !== current) {
      diferencias.push({
        campo: item.key,
        label: item.label,
        valor_cierre: stored,
        valor_actual: current
      });
    }
  }

  for (const item of moneyComparisons) {
    const stored = toMoney(cierre[item.key]);
    const current = currentMetrics[item.key];

    if (!stored.equals(current)) {
      diferencias.push({
        campo: item.key,
        label: item.label,
        valor_cierre: moneyString(stored),
        valor_actual: moneyString(current),
        diferencia: moneyString(current.minus(stored))
      });
    }
  }

  return diferencias;
};

const latestDate = (values: (Date | null | undefined)[]) => {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps));
};

const getGeneratedClosureReference = async (
  propietarioId: bigint,
  vehiculoId: bigint,
  anio: number,
  numeroSemana: number
) => {
  const gastos = await prisma.gastoSemanalVehiculo.findMany({
    where: {
      propietario_id: propietarioId,
      vehiculo_id: vehiculoId,
      anio,
      numero_semana: numeroSemana,
      es_generado: true
    },
    select: {
      created_at: true,
      updated_at: true
    }
  });

  return latestDate(gastos.flatMap((gasto) => [gasto.created_at, gasto.updated_at]));
};

const shouldCheckLegacyPostClosureChanges = (
  cierre: Prisma.CierreSemanalGetPayload<{ include: { vehiculo: true } }>,
  generatedReference: Date | null
) => {
  if (!generatedReference) return false;
  return cierre.cerrado_en.getTime() - generatedReference.getTime() > 60_000;
};

const buildPostClosureDiferencias = async (
  propietarioId: bigint,
  vehiculoId: bigint,
  fechaInicio: Date,
  fechaFin: Date,
  referenceDate: Date
) => {
  const [viajes, mantenimientos] = await Promise.all([
    prisma.viaje.findMany({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        estado: { not: EstadoViaje.CANCELADO },
        AND: [
          buildViajeSemanaWhere(fechaInicio, fechaFin),
          {
            OR: [{ created_at: { gt: referenceDate } }, { updated_at: { gt: referenceDate } }]
          }
        ]
      },
      select: {
        id: true,
        created_at: true,
        updated_at: true
      }
    }),
    prisma.mantenimiento.findMany({
      where: {
        propietario_id: propietarioId,
        vehiculo_id: vehiculoId,
        estado: EstadoMantenimiento.REALIZADO,
        fecha_mantenimiento: {
          gte: fechaInicio,
          lte: fechaFin
        },
        OR: [{ created_at: { gt: referenceDate } }, { updated_at: { gt: referenceDate } }]
      },
      select: {
        id: true,
        created_at: true,
        updated_at: true
      }
    })
  ]);

  const countCreated = (items: { created_at: Date }[]) =>
    items.filter((item) => item.created_at > referenceDate).length;
  const countUpdated = (items: { created_at: Date; updated_at: Date }[]) =>
    items.filter((item) => item.created_at <= referenceDate && item.updated_at > referenceDate)
      .length;
  const diferencias: {
    campo: string;
    label: string;
    valor_cierre: string | number;
    valor_actual: string | number;
  }[] = [];

  if (viajes.length) {
    diferencias.push({
      campo: 'viajes_post_cierre',
      label: 'Viajes posteriores al cierre',
      valor_cierre: 'Sin cambios',
      valor_actual: `${countCreated(viajes)} nuevo(s), ${countUpdated(viajes)} modificado(s)`
    });
  }

  if (mantenimientos.length) {
    diferencias.push({
      campo: 'mantenimientos_post_cierre',
      label: 'Mantenimientos posteriores al cierre',
      valor_cierre: 'Sin cambios',
      valor_actual: `${countCreated(mantenimientos)} nuevo(s), ${countUpdated(mantenimientos)} modificado(s)`
    });
  }

  return diferencias;
};

const buildCierreRevision = async (
  propietarioId: bigint,
  cierreData: CierreData,
  cierreGuardado?: Prisma.CierreSemanalGetPayload<{ include: { vehiculo: true } }> | null
) => {
  const vehiculoId = parseBigIntId(cierreData.vehiculo.id, 'vehiculo_id');
  const cierre =
    cierreGuardado ??
    (await prisma.cierreSemanal.findUnique({
      where: {
        propietario_id_vehiculo_id_anio_numero_semana: {
          propietario_id: propietarioId,
          vehiculo_id: vehiculoId,
          anio: cierreData.semana.anio,
          numero_semana: cierreData.semana.numero_semana
        }
      },
      include: {
        vehiculo: true
      }
    }));

  if (!cierre) {
    return {
      cerrado: false,
      requiere_revision: false,
      diferencias: [],
      total_diferencias: 0
    };
  }

  const currentMetrics = buildCierreMetrics(cierreData);
  const generatedReference = await getGeneratedClosureReference(
    propietarioId,
    vehiculoId,
    cierreData.semana.anio,
    cierreData.semana.numero_semana
  );
  const postClosureDiferencias = shouldCheckLegacyPostClosureChanges(
    cierre,
    generatedReference
  )
    ? await buildPostClosureDiferencias(
        propietarioId,
        vehiculoId,
        cierreData.semana.fecha_inicio,
        cierreData.semana.fecha_fin,
        generatedReference!
      )
    : [];
  const diferencias = [
    ...buildCierreDiferencias(cierre, currentMetrics),
    ...postClosureDiferencias
  ];

  return {
    cerrado: true,
    cierre_id: cierre.id,
    cerrado_en: cierre.cerrado_en,
    referencia_cierre: generatedReference,
    requiere_revision: diferencias.length > 0,
    diferencias,
    total_diferencias: diferencias.length
  };
};

export const __testing = {
  addViajeToTotales,
  buildCierreDiferencias,
  buildViajeSemanaWhere,
  createTotalesViajes,
  formatViajeCierre,
  isRetornoGastoViaje,
  viajeFechaEntrega
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
  const cierre = await buildCierreData(
    propietarioId,
    parsed.anio,
    parsed.numero_semana,
    parsed.vehiculo_id
  );
  const revisionCierre = await buildCierreRevision(propietarioId, cierre);

  const { conductores_operativos: _internal, ...response } = cierre;
  return {
    ...response,
    revision_cierre: revisionCierre
  };
};

export const snapshotCierreSemanalActual = async (
  propietarioIdInput: unknown,
  input: unknown,
  usuarioIdInput?: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const parsed = cierreSemanalSemanaSchema.parse(input);
  const cierre = await buildCierreData(
    propietarioId,
    parsed.anio,
    parsed.numero_semana,
    parsed.vehiculo_id
  );

  return saveCierreSemanalSnapshot(propietarioId, cierre, usuarioIdInput);
};

export const generarGastosCierreSemanal = async (
  propietarioIdInput: unknown,
  input: CierreSemanalGenerarGastosInput,
  usuarioIdInput?: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const cierre = await buildCierreData(
    propietarioId,
    input.anio,
    input.numero_semana,
    input.vehiculo_id
  );

  assertSemanaTerminada(cierre.semana.fecha_fin);

  const revisionAntesDeGenerar =
    cierre.resumen.cantidad_gastos_generados > 0
      ? await buildCierreRevision(propietarioId, cierre)
      : null;

  if (
    cierre.resumen.cantidad_gastos_generados > 0 &&
    !revisionAntesDeGenerar?.requiere_revision
  ) {
    throw new AppError('Los gastos de esta semana ya fueron generados', 409);
  }

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

  const cierreActualizado = await buildCierreData(
    propietarioId,
    input.anio,
    input.numero_semana,
    input.vehiculo_id
  );
  const cierreGuardado = await saveCierreSemanalSnapshot(
    propietarioId,
    cierreActualizado,
    usuarioIdInput
  );
  const { conductores_operativos: _internal, ...response } = cierreActualizado;

  return {
    gastos_generados: formatGastosSemanales(gastos),
    cierre_guardado: cierreGuardado,
    cierre: {
      ...response,
      revision_cierre: {
        cerrado: true,
        cierre_id: cierreGuardado.id,
        cerrado_en: cierreGuardado.cerrado_en,
        requiere_revision: false,
        diferencias: [],
        total_diferencias: 0
      }
    }
  };
};

export const listAnomaliasCierresSemanales = async (propietarioIdInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const cierres = await prisma.cierreSemanal.findMany({
    where: {
      propietario_id: propietarioId
    },
    include: {
      vehiculo: true
    },
    orderBy: [{ cerrado_en: 'desc' }, { anio: 'desc' }, { numero_semana: 'desc' }],
    take: 50
  });
  const items = [];

  for (const cierre of cierres) {
    const current = await buildCierreData(
      propietarioId,
      cierre.anio,
      cierre.numero_semana,
      cierre.vehiculo_id
    );
    const revision = await buildCierreRevision(propietarioId, current, cierre);
    const diferencias = revision.diferencias;

    if (!diferencias.length) continue;

    items.push({
      tipo_alerta: 'cierre_semanal',
      estado_alerta: 'requiere_revision',
      cierre_id: cierre.id,
      cerrado_en: cierre.cerrado_en,
      semana: {
        anio: cierre.anio,
        numero_semana: cierre.numero_semana,
        fecha_inicio: cierre.fecha_inicio,
        fecha_fin: cierre.fecha_fin
      },
      vehiculo: buildVehiculoMini(cierre.vehiculo),
      diferencias,
      total_diferencias: diferencias.length
    });
  }

  return {
    total: items.length,
    cierres_revisados: cierres.length,
    items
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
