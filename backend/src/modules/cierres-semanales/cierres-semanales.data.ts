import { EstadoMantenimiento, EstadoViaje, Prisma, TipoGastoSemanalVehiculo } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { formatGastoSemanal } from './cierres-semanales.mapper.js';
import {
  viajeInclude,
  mantenimientoInclude,
  gastoSemanalInclude,
  type GastoSemanalCierre
} from './cierres-semanales.types.js';
import {
  toMoney,
  zeroMoney,
  addMoney,
  buildViajeSemanaWhere,
  getIsoWeekRange,
  calculateBonificacion,
  buildVehiculoMini,
  buildConductorMini,
  createTotalesViajes,
  createVehiculoGrupo,
  createConductorGrupo,
  formatViajeCierre,
  formatMantenimientoCierre,
  addViajeToTotales,
  selectVehiculoAsignado
} from './cierres-semanales.calculo.js';
import { getBonusConfig } from './cierres-semanales.pagos.js';

export const getGastoSemanalById = async (propietarioId: bigint, id: bigint) => {
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

export const ensureVehiculo = async (propietarioId: bigint, vehiculoId: bigint) => {
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

export const ensureConductor = async (propietarioId: bigint, conductorId: bigint) => {
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

export const assertConductorForGeneratedType = (
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

export const buildCierreData = async (
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
    vehiculoAsignacion.total_fletes = addMoney(vehiculoAsignacion.total_fletes, viaje.precio_flete);
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

export type CierreData = Awaited<ReturnType<typeof buildCierreData>>;
