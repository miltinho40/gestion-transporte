import { rutaDeTarifa } from '../tarifas-ruta/ruta-tarifa.js';
import {
  EstadoConductor,
  EstadoMantenimiento,
  EstadoVehiculo,
  EstadoViaje,
  Prisma
} from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import {
  type ViajeCierre,
  type MantenimientoCierre,
  type GastoSemanalFormat,
  type BonusConfig
} from './cierres-semanales.types.js';

export const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
};

export const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

export const prismaToApiEstadoConductor = {
  [EstadoConductor.ACTIVO]: 'activo',
  [EstadoConductor.INACTIVO]: 'inactivo',
  [EstadoConductor.LICENCIA_VENCIDA]: 'licencia_vencida'
};

export const prismaToApiEstadoMantenimiento = {
  [EstadoMantenimiento.PROGRAMADO]: 'programado',
  [EstadoMantenimiento.REALIZADO]: 'realizado',
  [EstadoMantenimiento.CANCELADO]: 'cancelado',
  [EstadoMantenimiento.VENCIDO]: 'vencido'
};

export const toMoney = (value: number | string | Prisma.Decimal | null | undefined) => {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);
};

export const zeroMoney = () => new Prisma.Decimal(0).toDecimalPlaces(2);

export const addMoney = (
  left: number | string | Prisma.Decimal | null | undefined,
  right: number | string | Prisma.Decimal | null | undefined
) => {
  return toMoney(left).plus(toMoney(right)).toDecimalPlaces(2);
};

export const normalizeText = (value: unknown) => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
};

export const isRetornoGastoViaje = (value: unknown) => normalizeText(value) === 'RETORNO';

export const viajeFechaEntrega = (viaje: { fecha_salida: Date; fecha_llegada: Date | null }) =>
  viaje.fecha_llegada ?? viaje.fecha_salida;

export const isSundayDate = (value: Date) => value.getUTCDay() === 0;

export const buildViajeSemanaWhere = (
  fechaInicio: Date,
  fechaFin: Date
): Prisma.ViajeWhereInput => ({
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

export const todayUtcDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

export const assertSemanaTerminada = (fechaFin: Date) => {
  if (todayUtcDateOnly() <= fechaFin) {
    throw new AppError('No se pueden generar gastos porque la semana aun no termina', 400);
  }
};

export const calculateBonificacion = (totalFletes: Prisma.Decimal, config: BonusConfig) => {
  if (totalFletes.lte(config.bonificacion_flete_monto_minimo)) {
    return zeroMoney();
  }

  const tramo = config.bonificacion_flete_monto_tramo.gt(0)
    ? config.bonificacion_flete_monto_tramo
    : toMoney(100);
  const tramos = Math.ceil(
    totalFletes.minus(config.bonificacion_flete_monto_minimo).div(tramo).toNumber()
  );
  let bonificacion = config.bonificacion_flete_valor_tramo.mul(tramos).toDecimalPlaces(2);

  if (config.bonificacion_flete_monto_maximo.gt(0)) {
    bonificacion = Prisma.Decimal.min(
      bonificacion,
      config.bonificacion_flete_monto_maximo
    ).toDecimalPlaces(2);
  }

  return bonificacion;
};

export const calculatePagoSemanalConductor = (values: {
  sueldo: Prisma.Decimal;
  bono: Prisma.Decimal;
  retornos: Prisma.Decimal;
  domingos: Prisma.Decimal;
}) =>
  values.sueldo.plus(values.bono).plus(values.retornos).plus(values.domingos).toDecimalPlaces(2);

export const buildVehiculoMini = (vehiculo: {
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

export const buildConductorMini = (conductor: {
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

export type VehiculoAsignacion = {
  vehiculo: ReturnType<typeof buildVehiculoMini>;
  cantidad_viajes: number;
  total_fletes: Prisma.Decimal;
};

export const createTotalesViajes = () => ({
  precio_flete: zeroMoney(),
  precio_real_flete: zeroMoney(),
  costo_estimado_gastos: zeroMoney(),
  costo_real_gastos: zeroMoney(),
  utilidad: zeroMoney()
});

export const createVehiculoGrupo = (vehiculo: ReturnType<typeof buildVehiculoMini>) => ({
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

export const createConductorGrupo = (conductor: ReturnType<typeof buildConductorMini>) => ({
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

export const formatViajeCierre = (viaje: ViajeCierre, numeroSemana?: number) => {
  const costoRealGastos = toMoney(viaje.costo_real_gastos);
  const utilidad = toMoney(
    viaje.detalle_factura?.factura?.estado === 'FACTURADA'
      ? viaje.detalle_factura.neto
      : viaje.precio_real_flete
  )
    .minus(costoRealGastos)
    .toDecimalPlaces(2);
  const gastosViajeTotal = viaje.gastos_viaje
    .reduce((total, gasto) => total.plus(toMoney(gasto.monto)), zeroMoney())
    .toDecimalPlaces(2);
  const retornoGastosViaje = viaje.gastos_viaje
    .filter((gasto) => isRetornoGastoViaje(gasto.tipo_gasto.nombre))
    .reduce((total, gasto) => total.plus(toMoney(gasto.monto)), zeroMoney())
    .toDecimalPlaces(2);
  const destino = rutaDeTarifa(viaje.tarifa_ruta).destino;
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
      id: rutaDeTarifa(viaje.tarifa_ruta).id,
      origen: rutaDeTarifa(viaje.tarifa_ruta).origen,
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
    gastos_viaje_total: gastosViajeTotal,
    utilidad,
    cobrado: viaje.cobrado,
    retorno: viaje.retorno,
    estado: prismaToApiEstadoViaje[viaje.estado],
    leyenda_facturacion: numeroSemana
      ? `1 viaje a ${destino}-${descripcionCarga} en sem#${numeroSemana}, guia #${guias}`
      : null
  };
};

export const formatMantenimientoCierre = (mantenimiento: MantenimientoCierre) => ({
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

export const addViajeToTotales = (
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
    toMoney(
      viaje.detalle_factura?.factura?.estado === 'FACTURADA'
        ? viaje.detalle_factura.neto
        : viaje.precio_real_flete
    ).minus(costoRealGastos)
  );
};

export const selectVehiculoAsignado = (
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
