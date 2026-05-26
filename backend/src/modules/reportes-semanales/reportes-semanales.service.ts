import {
  EstadoConductor,
  EstadoMantenimiento,
  EstadoVehiculo,
  EstadoViaje,
  Prisma,
  TipoGastoSemanalVehiculo
} from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { ReportExportTable } from '../../utils/report-export.js';
import {
  calculateBonificacion,
  getBonusConfig,
  getIsoWeekRange
} from '../cierres-semanales/cierres-semanales.service.js';
import {
  formatGastoSemanal,
  prismaToApiTipoGastoSemanal
} from '../cierres-semanales/cierres-semanales.mapper.js';
import {
  reporteIngresosEgresosFiltersSchema,
  reporteViajesConductorFiltersSchema,
  reporteViajesVehiculoFiltersSchema
} from './reportes-semanales.schema.js';

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
  tipo_mantenimiento: true
} satisfies Prisma.MantenimientoInclude;

const gastoSemanalInclude = {
  vehiculo: true,
  conductor: true
} satisfies Prisma.GastoSemanalVehiculoInclude;

type ViajeReporte = Prisma.ViajeGetPayload<{ include: typeof viajeInclude }>;
type MantenimientoReporte = Prisma.MantenimientoGetPayload<{
  include: typeof mantenimientoInclude;
}>;
type GastoSemanalReporte = Prisma.GastoSemanalVehiculoGetPayload<{
  include: typeof gastoSemanalInclude;
}>;

type VehiculoMini = ReturnType<typeof buildVehiculoMini>;
type ConductorMini = ReturnType<typeof buildConductorMini>;

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

function buildVehiculoMini(vehiculo: {
  id: bigint;
  placa: string;
  marca: string;
  modelo: string | null;
  estado: EstadoVehiculo;
}) {
  return {
    id: vehiculo.id,
    placa: vehiculo.placa,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    estado: prismaToApiEstadoVehiculo[vehiculo.estado]
  };
}

function buildConductorMini(conductor: {
  id: bigint;
  nombre: string;
  cedula: string;
  sueldo_semanal: Prisma.Decimal;
  estado: EstadoConductor;
}) {
  return {
    id: conductor.id,
    nombre: conductor.nombre,
    cedula: conductor.cedula,
    sueldo_semanal: conductor.sueldo_semanal,
    estado: prismaToApiEstadoConductor[conductor.estado]
  };
}

const buildClienteMini = (cliente: { id: bigint; nombre: string; ruc_cedula: string }) => ({
  id: cliente.id,
  nombre: cliente.nombre,
  ruc_cedula: cliente.ruc_cedula
});

const buildRutaMini = (viaje: ViajeReporte) => ({
  id: viaje.tarifa_ruta.ruta.id,
  origen: viaje.tarifa_ruta.ruta.origen,
  destino: viaje.tarifa_ruta.ruta.destino
});

const buildSemana = (anio: number, numeroSemana: number) => {
  const { fechaInicio, fechaFin } = getIsoWeekRange(anio, numeroSemana);

  return {
    anio,
    numero_semana: numeroSemana,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin
  };
};

const buildViajeWhere = (
  propietarioId: bigint,
  semana: ReturnType<typeof buildSemana>,
  filters: {
    conductor_id?: string;
    vehiculo_id?: string;
    cliente_id?: string;
    ruta_id?: string;
  }
) => {
  const where: Prisma.ViajeWhereInput = {
    propietario_id: propietarioId,
    estado: { not: EstadoViaje.CANCELADO },
    fecha_salida: {
      gte: semana.fecha_inicio,
      lte: semana.fecha_fin
    }
  };

  if (filters.conductor_id) {
    where.conductor_id = parseBigIntId(filters.conductor_id, 'conductor_id');
  }

  if (filters.vehiculo_id) {
    where.vehiculo_id = parseBigIntId(filters.vehiculo_id, 'vehiculo_id');
  }

  if (filters.cliente_id) {
    where.cliente_id = parseBigIntId(filters.cliente_id, 'cliente_id');
  }

  if (filters.ruta_id) {
    where.tarifa_ruta = {
      ruta_id: parseBigIntId(filters.ruta_id, 'ruta_id')
    };
  }

  return where;
};

const formatViajeConductor = (viaje: ViajeReporte) => ({
  id: viaje.id,
  fecha_salida: viaje.fecha_salida,
  cliente: buildClienteMini(viaje.cliente),
  origen: viaje.tarifa_ruta.ruta.origen,
  destino: viaje.tarifa_ruta.ruta.destino,
  precio_flete: viaje.precio_flete,
  vehiculo: buildVehiculoMini(viaje.vehiculo),
  descripcion_carga: viaje.descripcion_carga,
  numeros_guia_remision: viaje.numeros_guia_remision,
  estado: prismaToApiEstadoViaje[viaje.estado]
});

const formatViajeVehiculo = (viaje: ViajeReporte, numeroSemana: number) => {
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
    cliente: buildClienteMini(viaje.cliente),
    ruta: buildRutaMini(viaje),
    conductor: buildConductorMini(viaje.conductor),
    descripcion_carga: viaje.descripcion_carga,
    numeros_guia_remision: viaje.numeros_guia_remision,
    precio_flete: viaje.precio_flete,
    precio_real_flete: viaje.precio_real_flete,
    costo_estimado_gastos: viaje.costo_estimado_gastos,
    costo_real_gastos: viaje.costo_real_gastos,
    utilidad,
    estado: prismaToApiEstadoViaje[viaje.estado],
    leyenda_facturacion: `1 viaje a ${destino}-${descripcionCarga} en sem#${numeroSemana}, guia #${guias}`
  };
};

const createTotalesViajesVehiculo = () => ({
  precio_flete: zeroMoney(),
  precio_real_flete: zeroMoney(),
  costo_estimado_gastos: zeroMoney(),
  costo_real_gastos: zeroMoney(),
  utilidad: zeroMoney()
});

const addViajeVehiculoTotales = (
  totales: ReturnType<typeof createTotalesViajesVehiculo>,
  viaje: ViajeReporte
) => {
  const costoRealGastos = toMoney(viaje.costo_real_gastos);
  const utilidad = toMoney(viaje.precio_real_flete).minus(costoRealGastos).toDecimalPlaces(2);

  totales.precio_flete = addMoney(totales.precio_flete, viaje.precio_flete);
  totales.precio_real_flete = addMoney(totales.precio_real_flete, viaje.precio_real_flete);
  totales.costo_estimado_gastos = addMoney(
    totales.costo_estimado_gastos,
    viaje.costo_estimado_gastos
  );
  totales.costo_real_gastos = addMoney(totales.costo_real_gastos, costoRealGastos);
  totales.utilidad = addMoney(totales.utilidad, utilidad);
};

type VehiculoAsignacion = {
  vehiculo: VehiculoMini;
  cantidad_viajes: number;
  total_fletes: Prisma.Decimal;
};

const selectVehiculoAsignado = (vehiculos: Map<string, VehiculoAsignacion>) => {
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

const findGeneratedGasto = (
  gastos: GastoSemanalReporte[],
  conductorId: bigint,
  tipo: TipoGastoSemanalVehiculo
) => {
  return gastos.find((gasto) => gasto.conductor_id === conductorId && gasto.tipo === tipo);
};

export const getReporteViajesConductorSemanal = async (
  propietarioIdInput: unknown,
  input: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteViajesConductorFiltersSchema.parse(input);
  const semana = buildSemana(filters.anio, filters.numero_semana);
  const [config, viajes, gastosGenerados] = await Promise.all([
    getBonusConfig(propietarioId),
    prisma.viaje.findMany({
      where: buildViajeWhere(propietarioId, semana, filters),
      include: viajeInclude,
      orderBy: [{ conductor_id: 'asc' }, { fecha_salida: 'asc' }, { id: 'asc' }]
    }),
    prisma.gastoSemanalVehiculo.findMany({
      where: {
        propietario_id: propietarioId,
        anio: filters.anio,
        numero_semana: filters.numero_semana,
        tipo: {
          in: [
            TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR,
            TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR
          ]
        }
      },
      include: gastoSemanalInclude
    })
  ]);

  const grupos = new Map<
    string,
    {
      conductor: ConductorMini;
      viajes: ReturnType<typeof formatViajeConductor>[];
      vehiculos: Map<string, VehiculoAsignacion>;
      totales: { precio_flete: Prisma.Decimal };
    }
  >();

  for (const viaje of viajes) {
    const key = viaje.conductor_id.toString();
    const conductor = buildConductorMini(viaje.conductor);
    let grupo = grupos.get(key);

    if (!grupo) {
      grupo = {
        conductor,
        viajes: [],
        vehiculos: new Map<string, VehiculoAsignacion>(),
        totales: { precio_flete: zeroMoney() }
      };
      grupos.set(key, grupo);
    }

    grupo.viajes.push(formatViajeConductor(viaje));
    grupo.totales.precio_flete = addMoney(grupo.totales.precio_flete, viaje.precio_flete);

    const vehiculoKey = viaje.vehiculo_id.toString();
    const vehiculoActual = grupo.vehiculos.get(vehiculoKey) ?? {
      vehiculo: buildVehiculoMini(viaje.vehiculo),
      cantidad_viajes: 0,
      total_fletes: zeroMoney()
    };
    vehiculoActual.cantidad_viajes += 1;
    vehiculoActual.total_fletes = addMoney(vehiculoActual.total_fletes, viaje.precio_flete);
    grupo.vehiculos.set(vehiculoKey, vehiculoActual);
  }

  const conductores = [...grupos.values()]
    .map((grupo) => {
      const bonificacionSugerida = calculateBonificacion(grupo.totales.precio_flete, config);
      const vehiculoAsignado = selectVehiculoAsignado(grupo.vehiculos);
      const gastoSueldo = findGeneratedGasto(
        gastosGenerados,
        grupo.conductor.id,
        TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR
      );
      const gastoBonificacion = findGeneratedGasto(
        gastosGenerados,
        grupo.conductor.id,
        TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR
      );

      return {
        conductor: grupo.conductor,
        cantidad_viajes: grupo.viajes.length,
        viajes: grupo.viajes,
        vehiculos_trabajados: [...grupo.vehiculos.values()],
        totales: grupo.totales,
        sueldo_semanal: grupo.conductor.sueldo_semanal,
        bonificacion_sugerida: bonificacionSugerida,
        vehiculo_asignado_gasto: vehiculoAsignado?.vehiculo ?? null,
        gasto_sueldo_generado: gastoSueldo ? formatGastoSemanal(gastoSueldo) : null,
        gasto_bonificacion_generado: gastoBonificacion
          ? formatGastoSemanal(gastoBonificacion)
          : null
      };
    })
    .sort((a, b) => a.conductor.nombre.localeCompare(b.conductor.nombre));

  return {
    semana,
    filtros: {
      conductor_id: filters.conductor_id ?? null,
      cliente_id: filters.cliente_id ?? null,
      ruta_id: filters.ruta_id ?? null
    },
    configuracion_bonificacion: config,
    resumen: {
      cantidad_conductores: conductores.length,
      cantidad_viajes: viajes.length,
      total_precio_flete: conductores.reduce(
        (total, conductor) => addMoney(total, conductor.totales.precio_flete),
        zeroMoney()
      ),
      total_bonificacion_sugerida: conductores.reduce(
        (total, conductor) => addMoney(total, conductor.bonificacion_sugerida),
        zeroMoney()
      )
    },
    conductores
  };
};

export const getReporteViajesVehiculoSemanal = async (
  propietarioIdInput: unknown,
  input: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteViajesVehiculoFiltersSchema.parse(input);
  const semana = buildSemana(filters.anio, filters.numero_semana);
  const viajes = await prisma.viaje.findMany({
    where: buildViajeWhere(propietarioId, semana, filters),
    include: viajeInclude,
    orderBy: [{ vehiculo_id: 'asc' }, { fecha_salida: 'asc' }, { id: 'asc' }]
  });

  const grupos = new Map<
    string,
    {
      vehiculo: VehiculoMini;
      viajes: ReturnType<typeof formatViajeVehiculo>[];
      totales: ReturnType<typeof createTotalesViajesVehiculo>;
    }
  >();
  const resumenTotales = createTotalesViajesVehiculo();

  for (const viaje of viajes) {
    const key = viaje.vehiculo_id.toString();
    let grupo = grupos.get(key);

    if (!grupo) {
      grupo = {
        vehiculo: buildVehiculoMini(viaje.vehiculo),
        viajes: [],
        totales: createTotalesViajesVehiculo()
      };
      grupos.set(key, grupo);
    }

    grupo.viajes.push(formatViajeVehiculo(viaje, filters.numero_semana));
    addViajeVehiculoTotales(grupo.totales, viaje);
    addViajeVehiculoTotales(resumenTotales, viaje);
  }

  const vehiculos = [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      cantidad_viajes: grupo.viajes.length
    }))
    .sort((a, b) => a.vehiculo.placa.localeCompare(b.vehiculo.placa));

  return {
    semana,
    filtros: {
      vehiculo_id: filters.vehiculo_id ?? null,
      cliente_id: filters.cliente_id ?? null,
      ruta_id: filters.ruta_id ?? null
    },
    resumen: {
      cantidad_vehiculos: vehiculos.length,
      cantidad_viajes: viajes.length,
      totales: resumenTotales
    },
    vehiculos
  };
};

const createIngresosEgresosTotales = () => ({
  ingresos: zeroMoney(),
  egresos: zeroMoney(),
  utilidad_viajes: zeroMoney(),
  mantenimientos: zeroMoney(),
  gastos_semanales: zeroMoney(),
  sueldos: zeroMoney(),
  bonificaciones: zeroMoney(),
  resultado: zeroMoney()
});

const addIngreso = (
  totales: ReturnType<typeof createIngresosEgresosTotales>,
  amount: Prisma.Decimal
) => {
  totales.ingresos = addMoney(totales.ingresos, amount);
  totales.resultado = addMoney(totales.resultado, amount);
};

const addEgreso = (
  totales: ReturnType<typeof createIngresosEgresosTotales>,
  amount: Prisma.Decimal
) => {
  totales.egresos = addMoney(totales.egresos, amount);
  totales.resultado = toMoney(totales.resultado).minus(amount).toDecimalPlaces(2);
};

const formatMovimientoViaje = (viaje: ViajeReporte) => {
  const costoRealGastos = toMoney(viaje.costo_real_gastos);
  const utilidad = toMoney(viaje.precio_real_flete).minus(costoRealGastos).toDecimalPlaces(2);

  return {
    tipo: 'viaje',
    referencia_id: viaje.id,
    fecha: viaje.fecha_salida,
    descripcion: `${viaje.cliente.nombre}-${viaje.tarifa_ruta.ruta.destino}`,
    precio: utilidad,
    naturaleza: 'ingreso',
    detalle: {
      precio_real_flete: viaje.precio_real_flete,
      costo_real_gastos: viaje.costo_real_gastos,
      cliente: buildClienteMini(viaje.cliente),
      ruta: buildRutaMini(viaje),
      conductor: buildConductorMini(viaje.conductor)
    }
  };
};

const formatMovimientoMantenimiento = (mantenimiento: MantenimientoReporte) => ({
  tipo: 'mantenimiento',
  referencia_id: mantenimiento.id,
  fecha: mantenimiento.fecha_mantenimiento,
  descripcion: `${mantenimiento.tipo_mantenimiento.nombre}-${mantenimiento.descripcion ?? ''}`.trim(),
  precio: mantenimiento.costo_total,
  naturaleza: 'egreso',
  detalle: {
    tipo_mantenimiento: {
      id: mantenimiento.tipo_mantenimiento.id,
      nombre: mantenimiento.tipo_mantenimiento.nombre
    },
    estado: prismaToApiEstadoMantenimiento[mantenimiento.estado]
  }
});

const formatMovimientoGastoSemanal = (gasto: GastoSemanalReporte) => ({
  tipo: 'gasto_semanal',
  referencia_id: gasto.id,
  fecha: gasto.fecha_inicio,
  descripcion:
    gasto.tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR && gasto.conductor
      ? `sueldo-${gasto.conductor.nombre}`
      : gasto.tipo === TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR && gasto.conductor
        ? `bonificacion-${gasto.conductor.nombre}`
        : `${prismaToApiTipoGastoSemanal[gasto.tipo]}-${gasto.descripcion ?? ''}`.trim(),
  precio: gasto.monto,
  naturaleza: 'egreso',
  detalle: {
    tipo_gasto: prismaToApiTipoGastoSemanal[gasto.tipo],
    descripcion: gasto.descripcion,
    es_generado: gasto.es_generado,
    conductor: gasto.conductor ? buildConductorMini(gasto.conductor) : null
  }
});

const movimientoDateValue = (movimiento: { fecha: Date }) => movimiento.fecha.getTime();

export const getReporteIngresosEgresosSemanal = async (
  propietarioIdInput: unknown,
  input: unknown
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const filters = reporteIngresosEgresosFiltersSchema.parse(input);
  const semana = buildSemana(filters.anio, filters.numero_semana);
  const vehiculoId = filters.vehiculo_id
    ? parseBigIntId(filters.vehiculo_id, 'vehiculo_id')
    : null;

  const [viajes, mantenimientos, gastosSemanales] = await Promise.all([
    prisma.viaje.findMany({
      where: buildViajeWhere(propietarioId, semana, {
        vehiculo_id: filters.vehiculo_id
      }),
      include: viajeInclude,
      orderBy: [{ vehiculo_id: 'asc' }, { fecha_salida: 'asc' }, { id: 'asc' }]
    }),
    prisma.mantenimiento.findMany({
      where: {
        propietario_id: propietarioId,
        estado: { not: EstadoMantenimiento.CANCELADO },
        vehiculo_id: vehiculoId ?? undefined,
        fecha_mantenimiento: {
          gte: semana.fecha_inicio,
          lte: semana.fecha_fin
        }
      },
      include: mantenimientoInclude,
      orderBy: [{ vehiculo_id: 'asc' }, { fecha_mantenimiento: 'asc' }, { id: 'asc' }]
    }),
    prisma.gastoSemanalVehiculo.findMany({
      where: {
        propietario_id: propietarioId,
        anio: filters.anio,
        numero_semana: filters.numero_semana,
        vehiculo_id: vehiculoId ?? undefined
      },
      include: gastoSemanalInclude,
      orderBy: [{ vehiculo_id: 'asc' }, { tipo: 'asc' }, { id: 'asc' }]
    })
  ]);

  const grupos = new Map<
    string,
    {
      vehiculo: VehiculoMini;
      movimientos: (
        | ReturnType<typeof formatMovimientoViaje>
        | ReturnType<typeof formatMovimientoMantenimiento>
        | ReturnType<typeof formatMovimientoGastoSemanal>
      )[];
      sueldos_conductores: {
        conductor: ConductorMini;
        vehiculo_asignado_gasto: VehiculoMini;
        sueldo_semanal: Prisma.Decimal;
        gasto_sueldo_generado: ReturnType<typeof formatGastoSemanal<GastoSemanalReporte>> | null;
      }[];
      totales: ReturnType<typeof createIngresosEgresosTotales>;
    }
  >();
  const resumenTotales = createIngresosEgresosTotales();

  const getGrupo = (vehiculo: VehiculoMini) => {
    const key = vehiculo.id.toString();
    let grupo = grupos.get(key);

    if (!grupo) {
      grupo = {
        vehiculo,
        movimientos: [],
        sueldos_conductores: [],
        totales: createIngresosEgresosTotales()
      };
      grupos.set(key, grupo);
    }

    return grupo;
  };

  for (const viaje of viajes) {
    const movimiento = formatMovimientoViaje(viaje);
    const grupo = getGrupo(buildVehiculoMini(viaje.vehiculo));

    grupo.movimientos.push(movimiento);
    addIngreso(grupo.totales, movimiento.precio);
    addIngreso(resumenTotales, movimiento.precio);
    grupo.totales.utilidad_viajes = addMoney(
      grupo.totales.utilidad_viajes,
      movimiento.precio
    );
    resumenTotales.utilidad_viajes = addMoney(
      resumenTotales.utilidad_viajes,
      movimiento.precio
    );
  }

  for (const mantenimiento of mantenimientos) {
    const movimiento = formatMovimientoMantenimiento(mantenimiento);
    const grupo = getGrupo(buildVehiculoMini(mantenimiento.vehiculo));

    grupo.movimientos.push(movimiento);
    addEgreso(grupo.totales, mantenimiento.costo_total);
    addEgreso(resumenTotales, mantenimiento.costo_total);
    grupo.totales.mantenimientos = addMoney(
      grupo.totales.mantenimientos,
      mantenimiento.costo_total
    );
    resumenTotales.mantenimientos = addMoney(
      resumenTotales.mantenimientos,
      mantenimiento.costo_total
    );
  }

  for (const gasto of gastosSemanales) {
    const movimiento = formatMovimientoGastoSemanal(gasto);
    const grupo = getGrupo(buildVehiculoMini(gasto.vehiculo));

    grupo.movimientos.push(movimiento);
    addEgreso(grupo.totales, gasto.monto);
    addEgreso(resumenTotales, gasto.monto);
    grupo.totales.gastos_semanales = addMoney(grupo.totales.gastos_semanales, gasto.monto);
    resumenTotales.gastos_semanales = addMoney(resumenTotales.gastos_semanales, gasto.monto);

    if (gasto.tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR) {
      grupo.totales.sueldos = addMoney(grupo.totales.sueldos, gasto.monto);
      resumenTotales.sueldos = addMoney(resumenTotales.sueldos, gasto.monto);
    }

    if (gasto.tipo === TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR) {
      grupo.totales.bonificaciones = addMoney(grupo.totales.bonificaciones, gasto.monto);
      resumenTotales.bonificaciones = addMoney(resumenTotales.bonificaciones, gasto.monto);
    }
  }

  const sueldosPendientesPorConductor = new Map<
    string,
    {
      conductor: ConductorMini;
      vehiculos: Map<string, VehiculoAsignacion>;
      sueldo_semanal: Prisma.Decimal;
    }
  >();

  for (const viaje of viajes) {
    const conductorKey = viaje.conductor_id.toString();
    let item = sueldosPendientesPorConductor.get(conductorKey);

    if (!item) {
      item = {
        conductor: buildConductorMini(viaje.conductor),
        vehiculos: new Map<string, VehiculoAsignacion>(),
        sueldo_semanal: viaje.conductor.sueldo_semanal
      };
      sueldosPendientesPorConductor.set(conductorKey, item);
    }

    const vehiculoKey = viaje.vehiculo_id.toString();
    const vehiculoActual = item.vehiculos.get(vehiculoKey) ?? {
      vehiculo: buildVehiculoMini(viaje.vehiculo),
      cantidad_viajes: 0,
      total_fletes: zeroMoney()
    };
    vehiculoActual.cantidad_viajes += 1;
    vehiculoActual.total_fletes = addMoney(vehiculoActual.total_fletes, viaje.precio_flete);
    item.vehiculos.set(vehiculoKey, vehiculoActual);
  }

  for (const item of sueldosPendientesPorConductor.values()) {
    const vehiculoAsignado = selectVehiculoAsignado(item.vehiculos);
    if (!vehiculoAsignado) continue;

    const gastoSueldo = gastosSemanales.find(
      (gasto) =>
        gasto.conductor_id === item.conductor.id &&
        gasto.tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR
    );
    const grupo = getGrupo(vehiculoAsignado.vehiculo);

    grupo.sueldos_conductores.push({
      conductor: item.conductor,
      vehiculo_asignado_gasto: vehiculoAsignado.vehiculo,
      sueldo_semanal: item.sueldo_semanal,
      gasto_sueldo_generado: gastoSueldo ? formatGastoSemanal(gastoSueldo) : null
    });
  }

  const vehiculos = [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      movimientos: grupo.movimientos.sort(
        (a, b) => movimientoDateValue(a) - movimientoDateValue(b)
      ),
      cantidad_movimientos: grupo.movimientos.length
    }))
    .sort((a, b) => a.vehiculo.placa.localeCompare(b.vehiculo.placa));

  return {
    semana,
    filtros: {
      vehiculo_id: filters.vehiculo_id ?? null
    },
    resumen: {
      cantidad_vehiculos: vehiculos.length,
      cantidad_viajes: viajes.length,
      cantidad_mantenimientos: mantenimientos.length,
      cantidad_gastos_semanales: gastosSemanales.length,
      totales: resumenTotales
    },
    vehiculos
  };
};

const semanaSubtitle = (semana: { anio: number; numero_semana: number; fecha_inicio: Date; fecha_fin: Date }) =>
  `Anio ${semana.anio} | Semana ${semana.numero_semana} | ${semana.fecha_inicio.toISOString().slice(0, 10)} a ${semana.fecha_fin.toISOString().slice(0, 10)}`;

export const buildReporteViajesConductorSemanalExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteViajesConductorSemanal>>
): ReportExportTable => ({
  title: 'Reporte semanal de viajes por conductor',
  subtitle: semanaSubtitle(reporte.semana),
  filenameBase: `reporte-viajes-conductor-${reporte.semana.anio}-sem-${reporte.semana.numero_semana}`,
  summary: [
    { label: 'Conductores', value: reporte.resumen.cantidad_conductores },
    { label: 'Viajes', value: reporte.resumen.cantidad_viajes },
    { label: 'Total precio flete', value: reporte.resumen.total_precio_flete },
    { label: 'Total bonificacion sugerida', value: reporte.resumen.total_bonificacion_sugerida }
  ],
  columns: [
    { key: 'conductor', header: 'Conductor', width: 22 },
    { key: 'cedula', header: 'Cedula', width: 14 },
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'cliente', header: 'Cliente', width: 24 },
    { key: 'origen', header: 'Origen', width: 16 },
    { key: 'destino', header: 'Destino', width: 16 },
    { key: 'vehiculo', header: 'Vehiculo', width: 14 },
    { key: 'precio_flete', header: 'Precio flete', width: 14 },
    { key: 'total_conductor', header: 'Total conductor', width: 16 },
    { key: 'sueldo_semanal', header: 'Sueldo semanal', width: 16 },
    { key: 'bonificacion_sugerida', header: 'Bono sugerido', width: 16 },
    { key: 'vehiculo_bono', header: 'Vehiculo bono', width: 16 }
  ],
  rows: reporte.conductores.flatMap((conductor) =>
    conductor.viajes.map((viaje) => ({
      conductor: conductor.conductor.nombre,
      cedula: conductor.conductor.cedula,
      fecha: viaje.fecha_salida,
      cliente: viaje.cliente.nombre,
      origen: viaje.origen,
      destino: viaje.destino,
      vehiculo: viaje.vehiculo.placa,
      precio_flete: viaje.precio_flete,
      total_conductor: conductor.totales.precio_flete,
      sueldo_semanal: conductor.sueldo_semanal,
      bonificacion_sugerida: conductor.bonificacion_sugerida,
      vehiculo_bono: conductor.vehiculo_asignado_gasto?.placa ?? ''
    }))
  )
});

export const buildReporteViajesVehiculoSemanalExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteViajesVehiculoSemanal>>
): ReportExportTable => ({
  title: 'Reporte semanal de viajes por vehiculo',
  subtitle: semanaSubtitle(reporte.semana),
  filenameBase: `reporte-viajes-vehiculo-${reporte.semana.anio}-sem-${reporte.semana.numero_semana}`,
  summary: [
    { label: 'Vehiculos', value: reporte.resumen.cantidad_vehiculos },
    { label: 'Viajes', value: reporte.resumen.cantidad_viajes },
    { label: 'Precio flete', value: reporte.resumen.totales.precio_flete },
    { label: 'Precio real flete', value: reporte.resumen.totales.precio_real_flete },
    { label: 'Costo estimado gastos', value: reporte.resumen.totales.costo_estimado_gastos },
    { label: 'Costo real gastos', value: reporte.resumen.totales.costo_real_gastos },
    { label: 'Utilidad', value: reporte.resumen.totales.utilidad }
  ],
  columns: [
    { key: 'placa', header: 'Placa', width: 12 },
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'cliente', header: 'Cliente', width: 24 },
    { key: 'origen', header: 'Origen', width: 16 },
    { key: 'destino', header: 'Destino', width: 16 },
    { key: 'conductor', header: 'Conductor', width: 22 },
    { key: 'descripcion_carga', header: 'Carga', width: 24 },
    { key: 'guias', header: 'Guias', width: 20 },
    { key: 'precio_flete', header: 'Precio flete', width: 14 },
    { key: 'precio_real_flete', header: 'Precio real', width: 14 },
    { key: 'costo_estimado_gastos', header: 'Gasto estimado', width: 14 },
    { key: 'costo_real_gastos', header: 'Gasto real', width: 14 },
    { key: 'utilidad', header: 'Utilidad', width: 14 },
    { key: 'leyenda_facturacion', header: 'Leyenda facturacion', width: 42 }
  ],
  rows: reporte.vehiculos.flatMap((vehiculo) =>
    vehiculo.viajes.map((viaje) => ({
      placa: vehiculo.vehiculo.placa,
      fecha: viaje.fecha_salida,
      cliente: viaje.cliente.nombre,
      origen: viaje.ruta.origen,
      destino: viaje.ruta.destino,
      conductor: viaje.conductor.nombre,
      descripcion_carga: viaje.descripcion_carga,
      guias: viaje.numeros_guia_remision,
      precio_flete: viaje.precio_flete,
      precio_real_flete: viaje.precio_real_flete,
      costo_estimado_gastos: viaje.costo_estimado_gastos,
      costo_real_gastos: viaje.costo_real_gastos,
      utilidad: viaje.utilidad,
      leyenda_facturacion: viaje.leyenda_facturacion
    }))
  )
});

export const buildReporteIngresosEgresosSemanalExportTable = (
  reporte: Awaited<ReturnType<typeof getReporteIngresosEgresosSemanal>>
): ReportExportTable => ({
  title: 'Reporte semanal de ingresos y egresos',
  subtitle: semanaSubtitle(reporte.semana),
  filenameBase: `reporte-ingresos-egresos-${reporte.semana.anio}-sem-${reporte.semana.numero_semana}`,
  summary: [
    { label: 'Vehiculos', value: reporte.resumen.cantidad_vehiculos },
    { label: 'Viajes', value: reporte.resumen.cantidad_viajes },
    { label: 'Mantenimientos', value: reporte.resumen.cantidad_mantenimientos },
    { label: 'Gastos semanales', value: reporte.resumen.cantidad_gastos_semanales },
    { label: 'Ingresos', value: reporte.resumen.totales.ingresos },
    { label: 'Egresos', value: reporte.resumen.totales.egresos },
    { label: 'Sueldos', value: reporte.resumen.totales.sueldos },
    { label: 'Bonificaciones', value: reporte.resumen.totales.bonificaciones },
    { label: 'Resultado', value: reporte.resumen.totales.resultado }
  ],
  columns: [
    { key: 'placa', header: 'Placa', width: 12 },
    { key: 'fecha', header: 'Fecha', width: 12 },
    { key: 'tipo', header: 'Tipo', width: 16 },
    { key: 'descripcion', header: 'Descripcion', width: 34 },
    { key: 'naturaleza', header: 'Naturaleza', width: 14 },
    { key: 'precio', header: 'Precio', width: 14 },
    { key: 'resultado_vehiculo', header: 'Resultado vehiculo', width: 18 }
  ],
  rows: reporte.vehiculos.flatMap((vehiculo) =>
    vehiculo.movimientos.map((movimiento) => ({
      placa: vehiculo.vehiculo.placa,
      fecha: movimiento.fecha,
      tipo: movimiento.tipo,
      descripcion: movimiento.descripcion,
      naturaleza: movimiento.naturaleza,
      precio: movimiento.precio,
      resultado_vehiculo: vehiculo.totales.resultado
    }))
  )
});
