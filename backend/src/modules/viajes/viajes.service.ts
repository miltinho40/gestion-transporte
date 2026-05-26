import { EstadoConductor, EstadoVehiculo, EstadoViaje, Prisma, SentidoPeaje } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { toPrismaEstadoViaje } from './viajes.mapper.js';
import type {
  ViajeCobroInput,
  ViajeCreateInput,
  ViajeEstadoInput,
  ViajeUpdateInput
} from './viajes.schema.js';

interface ListViajesFilters {
  cliente_id?: unknown;
  vehiculo_id?: unknown;
  conductor_id?: unknown;
  tarifa_ruta_id?: unknown;
  ruta_id?: unknown;
  estado?: unknown;
  cobrado?: unknown;
  fecha_desde?: unknown;
  fecha_hasta?: unknown;
}

const includeRelations = {
  cliente: true,
  vehiculo: {
    include: {
      categoria_peaje: true
    }
  },
  conductor: true,
  tarifa_ruta: {
    include: {
      ruta: true,
      tipo_carga: true
    }
  }
} satisfies Prisma.ViajeInclude;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const parseDateFilter = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    throw new AppError(`${field} debe tener formato YYYY-MM-DD`, 400);
  }

  return toDateOnly(value)!;
};

const toDecimal = (value: number | string | Prisma.Decimal) => {
  return new Prisma.Decimal(value);
};

const toMoney = (value: number | string | Prisma.Decimal) => {
  return toDecimal(value).toDecimalPlaces(2);
};

const calculateFinancials = (
  precioFleteInput: number | string | Prisma.Decimal,
  porcentajeComisionInput: number | string | Prisma.Decimal
) => {
  const precioFlete = toMoney(precioFleteInput);
  const porcentajeComision = toDecimal(porcentajeComisionInput).toDecimalPlaces(2);
  const valorComision = precioFlete.mul(porcentajeComision).div(100).toDecimalPlaces(2);
  const precioRealFlete = precioFlete.minus(valorComision).toDecimalPlaces(2);

  return {
    precioFlete,
    porcentajeComision,
    valorComision,
    precioRealFlete
  };
};

const getNumericConfig = async (propietarioId: bigint, clave: string, fallback: number) => {
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave,
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });
  const own = configs.find((item) => item.propietario_id === propietarioId);
  const global = configs.find((item) => item.propietario_id === null);
  const parsed = Number((own ?? global)?.valor);

  const isValid = fallback > 0 ? parsed > 0 : parsed >= 0;

  return Number.isFinite(parsed) && isValid ? parsed : fallback;
};

const pickTarifaPeajeVigente = <
  T extends {
    propietario_id: bigint | null;
    vigente_desde: Date;
    valor: Prisma.Decimal;
  }
>(
  tarifas: T[],
  propietarioId: bigint
) => {
  const sorted = [...tarifas].sort(
    (left, right) => right.vigente_desde.getTime() - left.vigente_desde.getTime()
  );

  return (
    sorted.find((item) => item.propietario_id === propietarioId) ??
    sorted.find((item) => item.propietario_id === null) ??
    null
  );
};

const calculateCostoEstimadoGastos = (
  costoEstimadoInput: number | undefined,
  costoDiesel: number | string | Prisma.Decimal,
  costoPeajes: number | string | Prisma.Decimal
) => {
  if (costoEstimadoInput !== undefined) {
    return toMoney(costoEstimadoInput);
  }

  return toMoney(costoDiesel).plus(toMoney(costoPeajes)).toDecimalPlaces(2);
};

const calculateCostoEstimadoWithGastos = async (
  viajeId: bigint,
  costoDiesel: number | string | Prisma.Decimal,
  costoPeajes: number | string | Prisma.Decimal
) => {
  const estimados = await prisma.gastoViaje.aggregate({
    where: {
      viaje_id: viajeId,
      es_estimado: true
    },
    _sum: {
      monto: true
    }
  });

  return toMoney(costoDiesel)
    .plus(toMoney(costoPeajes))
    .plus(toMoney(estimados._sum.monto ?? 0))
    .toDecimalPlaces(2);
};

const assertFechaLlegadaValida = (fechaSalida: Date, fechaLlegada: Date | null) => {
  if (fechaLlegada && fechaLlegada < fechaSalida) {
    throw new AppError('fecha_llegada debe ser mayor o igual a fecha_salida', 400);
  }
};

const assertTarifaVigente = (
  tarifa: { vigente_desde: Date; vigente_hasta: Date | null },
  fechaSalida: Date
) => {
  if (fechaSalida < tarifa.vigente_desde) {
    throw new AppError('La fecha de salida es anterior a la vigencia de la tarifa', 400);
  }

  if (tarifa.vigente_hasta && fechaSalida > tarifa.vigente_hasta) {
    throw new AppError('La fecha de salida es posterior a la vigencia de la tarifa', 400);
  }
};

const buildWhere = (
  propietarioId: bigint,
  filters: ListViajesFilters
): Prisma.ViajeWhereInput => {
  const where: Prisma.ViajeWhereInput = {
    propietario_id: propietarioId
  };

  if (filters.cliente_id) where.cliente_id = parseBigIntId(filters.cliente_id, 'cliente_id');
  if (filters.vehiculo_id) where.vehiculo_id = parseBigIntId(filters.vehiculo_id, 'vehiculo_id');
  if (filters.conductor_id) {
    where.conductor_id = parseBigIntId(filters.conductor_id, 'conductor_id');
  }
  if (filters.tarifa_ruta_id) {
    where.tarifa_ruta_id = parseBigIntId(filters.tarifa_ruta_id, 'tarifa_ruta_id');
  }
  if (filters.ruta_id) {
    where.tarifa_ruta = {
      ruta_id: parseBigIntId(filters.ruta_id, 'ruta_id')
    };
  }

  if (
    filters.estado === 'programado' ||
    filters.estado === 'en_curso' ||
    filters.estado === 'completado' ||
    filters.estado === 'cancelado'
  ) {
    where.estado = toPrismaEstadoViaje(filters.estado);
  }

  if (filters.cobrado === 'true') where.cobrado = true;
  if (filters.cobrado === 'false') where.cobrado = false;

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_salida = {};

    if (filters.fecha_desde) {
      where.fecha_salida.gte = parseDateFilter(filters.fecha_desde, 'fecha_desde');
    }

    if (filters.fecha_hasta) {
      where.fecha_salida.lte = parseDateFilter(filters.fecha_hasta, 'fecha_hasta');
    }
  }

  return where;
};

const getClienteForWrite = async (propietarioId: bigint, clienteId: bigint) => {
  const cliente = await prisma.cliente.findFirst({
    where: {
      id: clienteId,
      propietario_id: propietarioId,
      activo: true
    }
  });

  if (!cliente) {
    throw new AppError('Cliente no encontrado o no disponible', 404);
  }

  return cliente;
};

const getVehiculoForWrite = async (propietarioId: bigint, vehiculoId: bigint) => {
  const vehiculo = await prisma.vehiculo.findFirst({
    where: {
      id: vehiculoId,
      propietario_id: propietarioId,
      estado: {
        not: EstadoVehiculo.INACTIVO
      }
    }
  });

  if (!vehiculo) {
    throw new AppError('Vehiculo no encontrado o no disponible', 404);
  }

  return vehiculo;
};

const getConductorForWrite = async (propietarioId: bigint, conductorId: bigint) => {
  const conductor = await prisma.conductor.findFirst({
    where: {
      id: conductorId,
      propietario_id: propietarioId,
      estado: EstadoConductor.ACTIVO
    }
  });

  if (!conductor) {
    throw new AppError('Conductor no encontrado o no disponible', 404);
  }

  return conductor;
};

const getTarifaRutaForWrite = async (
  propietarioId: bigint,
  tarifaRutaId: bigint,
  fechaSalida: Date
) => {
  const tarifa = await prisma.tarifaRuta.findFirst({
    where: {
      id: tarifaRutaId,
      propietario_id: propietarioId,
      activa: true
    },
    include: {
      ruta: true,
      tipo_carga: true
    }
  });

  if (!tarifa) {
    throw new AppError('Tarifa de ruta no encontrada o no disponible', 404);
  }

  if (!tarifa.ruta.activa || !tarifa.tipo_carga.activo) {
    throw new AppError('La ruta o el tipo de carga de la tarifa no estan disponibles', 404);
  }

  assertTarifaVigente(tarifa, fechaSalida);

  return tarifa;
};

const resolveCobro = (
  cobrado: boolean,
  fechaCobroInput?: string | null,
  currentFechaCobro?: Date | null
) => {
  if (!cobrado) {
    return null;
  }

  return toDateOnly(fechaCobroInput) ?? currentFechaCobro ?? todayDateOnly();
};

export const listViajes = async (
  propietarioIdInput: unknown,
  filters: ListViajesFilters
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');

  return prisma.viaje.findMany({
    where: buildWhere(propietarioId, filters),
    include: includeRelations,
    orderBy: [{ fecha_salida: 'desc' }, { id: 'desc' }]
  });
};

export const getViajeById = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  const viaje = await prisma.viaje.findFirst({
    where: {
      id,
      propietario_id: propietarioId
    },
    include: includeRelations
  });

  if (!viaje) {
    throw new AppError('Viaje no encontrado', 404);
  }

  return viaje;
};

export const calculateViajeValores = async (
  propietarioIdInput: unknown,
  query: {
    cliente_id?: unknown;
    vehiculo_id?: unknown;
    tarifa_ruta_id?: unknown;
    fecha_salida?: unknown;
    precio_flete?: unknown;
  }
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const clienteId = parseBigIntId(query.cliente_id, 'cliente_id');
  const vehiculoId = parseBigIntId(query.vehiculo_id, 'vehiculo_id');
  const tarifaRutaId = parseBigIntId(query.tarifa_ruta_id, 'tarifa_ruta_id');
  const fechaSalida =
    typeof query.fecha_salida === 'string' && dateOnlyPattern.test(query.fecha_salida)
      ? toDateOnly(query.fecha_salida)!
      : todayDateOnly();

  const [cliente, vehiculo, tarifaRuta, precioGalonDiesel] = await Promise.all([
    getClienteForWrite(propietarioId, clienteId),
    getVehiculoForWrite(propietarioId, vehiculoId),
    getTarifaRutaForWrite(propietarioId, tarifaRutaId, fechaSalida),
    getNumericConfig(propietarioId, 'precio_galon_diesel', 2)
  ]);

  const precioFleteInput =
    query.precio_flete !== undefined && query.precio_flete !== ''
      ? Number(query.precio_flete)
      : tarifaRuta.precio;
  const financials = calculateFinancials(precioFleteInput, cliente.porcentaje_comision);
  const distanciaKm = toDecimal(tarifaRuta.ruta.distancia_km);
  const rendimientoKmGalon = toDecimal(vehiculo.rendimiento_km_galon);
  const galonesDiesel = rendimientoKmGalon.gt(0)
    ? distanciaKm.div(rendimientoKmGalon).toDecimalPlaces(2)
    : toMoney(0);
  const costoDiesel = galonesDiesel.mul(precioGalonDiesel).toDecimalPlaces(2);

  const rutasPeajes = await prisma.rutaPeaje.findMany({
    where: {
      ruta_id: tarifaRuta.ruta_id,
      peaje: {
        activo: true,
        OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
      }
    },
    include: {
      peaje: {
        include: {
          tarifas_peaje: {
            where: {
              categoria_peaje_id: vehiculo.categoria_peaje_id,
              activa: true,
              vigente_desde: { lte: fechaSalida },
              AND: [
                { OR: [{ propietario_id: null }, { propietario_id: propietarioId }] },
                { OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: fechaSalida } }] }
              ]
            },
            orderBy: [{ vigente_desde: 'desc' }, { id: 'desc' }]
          }
        }
      }
    },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }]
  });

  let costoPeajes = toMoney(0);
  const peajes = rutasPeajes.map((rutaPeaje) => {
    const tarifa = pickTarifaPeajeVigente(rutaPeaje.peaje.tarifas_peaje, propietarioId);
    const valor = toMoney(tarifa?.valor ?? 0);
    const multiplicador = rutaPeaje.sentido === SentidoPeaje.AMBOS ? 2 : 1;
    const valorTotal = valor.mul(multiplicador).toDecimalPlaces(2);
    costoPeajes = costoPeajes.plus(valorTotal).toDecimalPlaces(2);

    return {
      id: rutaPeaje.peaje.id,
      nombre: rutaPeaje.peaje.nombre,
      ubicacion: rutaPeaje.peaje.ubicacion,
      orden: rutaPeaje.orden,
      sentido: rutaPeaje.sentido,
      valor: valorTotal,
      valor_unitario: valor,
      multiplicador
    };
  });
  const costoEstimadoGastos = costoDiesel.plus(costoPeajes).toDecimalPlaces(2);

  return {
    tarifa_ruta_id: tarifaRuta.id,
    ruta_id: tarifaRuta.ruta_id,
    distancia_km: distanciaKm,
    precio_flete: financials.precioFlete,
    porcentaje_comision: financials.porcentajeComision,
    valor_comision: financials.valorComision,
    precio_real_flete: financials.precioRealFlete,
    precio_galon_diesel: toMoney(precioGalonDiesel),
    galones_diesel: galonesDiesel,
    costo_diesel: costoDiesel,
    costo_peajes: costoPeajes,
    costo_estimado_gastos: costoEstimadoGastos,
    peajes
  };
};

export const createViaje = async (propietarioIdInput: unknown, input: ViajeCreateInput) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const clienteId = parseBigIntId(input.cliente_id, 'cliente_id');
  const vehiculoId = parseBigIntId(input.vehiculo_id, 'vehiculo_id');
  const conductorId = parseBigIntId(input.conductor_id, 'conductor_id');
  const tarifaRutaId = parseBigIntId(input.tarifa_ruta_id, 'tarifa_ruta_id');
  const fechaSalida = toDateOnly(input.fecha_salida) ?? todayDateOnly();
  const fechaLlegada = toDateOnly(input.fecha_llegada);

  assertFechaLlegadaValida(fechaSalida, fechaLlegada);

  const [cliente] = await Promise.all([
    getClienteForWrite(propietarioId, clienteId),
    getVehiculoForWrite(propietarioId, vehiculoId),
    getConductorForWrite(propietarioId, conductorId)
  ]);
  const tarifaRuta = await getTarifaRutaForWrite(propietarioId, tarifaRutaId, fechaSalida);

  const precioFleteBase = input.precio_flete ?? tarifaRuta.precio;
  const financials = calculateFinancials(precioFleteBase, cliente.porcentaje_comision);
  const costoDiesel = toMoney(input.costo_diesel ?? 0);
  const costoPeajes = toMoney(input.costo_peajes ?? 0);
  const costoEstimadoGastos = calculateCostoEstimadoGastos(
    input.costo_estimado_gastos,
    costoDiesel,
    costoPeajes
  );
  const cobrado = input.cobrado ?? false;

  return prisma.viaje.create({
    data: {
      propietario_id: propietarioId,
      cliente_id: clienteId,
      vehiculo_id: vehiculoId,
      conductor_id: conductorId,
      tarifa_ruta_id: tarifaRutaId,
      fecha_salida: fechaSalida,
      fecha_llegada: fechaLlegada,
      descripcion_carga: input.descripcion_carga,
      peso_carga_kg: input.peso_carga_kg ?? null,
      numeros_guia_remision: input.numeros_guia_remision,
      precio_flete: financials.precioFlete,
      porcentaje_comision_aplicado: financials.porcentajeComision,
      valor_comision: financials.valorComision,
      precio_real_flete:
        input.precio_real_flete === undefined
          ? financials.precioRealFlete
          : toMoney(input.precio_real_flete),
      galones_diesel: toMoney(input.galones_diesel ?? 0),
      costo_diesel: costoDiesel,
      costo_peajes: costoPeajes,
      costo_estimado_gastos: costoEstimadoGastos,
      costo_real_gastos:
        input.costo_real_gastos === null || input.costo_real_gastos === undefined
          ? null
          : toMoney(input.costo_real_gastos),
      cobrado,
      fecha_cobro: resolveCobro(cobrado, input.fecha_cobro),
      estado: toPrismaEstadoViaje(input.estado) ?? EstadoViaje.PROGRAMADO,
      observaciones: input.observaciones
    },
    include: includeRelations
  });
};

export const updateViaje = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeUpdateInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeById(propietarioId, id);

  const clienteId = input.cliente_id
    ? parseBigIntId(input.cliente_id, 'cliente_id')
    : current.cliente_id;
  const vehiculoId = input.vehiculo_id
    ? parseBigIntId(input.vehiculo_id, 'vehiculo_id')
    : current.vehiculo_id;
  const conductorId = input.conductor_id
    ? parseBigIntId(input.conductor_id, 'conductor_id')
    : current.conductor_id;
  const tarifaRutaId = input.tarifa_ruta_id
    ? parseBigIntId(input.tarifa_ruta_id, 'tarifa_ruta_id')
    : current.tarifa_ruta_id;
  const fechaSalida = input.fecha_salida
    ? toDateOnly(input.fecha_salida)!
    : current.fecha_salida;
  const fechaLlegada = Object.hasOwn(input, 'fecha_llegada')
    ? toDateOnly(input.fecha_llegada)
    : current.fecha_llegada;

  assertFechaLlegadaValida(fechaSalida, fechaLlegada);

  const cliente = input.cliente_id
    ? await getClienteForWrite(propietarioId, clienteId)
    : current.cliente;
  if (input.vehiculo_id) await getVehiculoForWrite(propietarioId, vehiculoId);
  if (input.conductor_id) await getConductorForWrite(propietarioId, conductorId);

  const tarifaRuta = input.tarifa_ruta_id
    ? await getTarifaRutaForWrite(propietarioId, tarifaRutaId, fechaSalida)
    : current.tarifa_ruta;

  assertTarifaVigente(tarifaRuta, fechaSalida);

  const precioFleteBase = input.precio_flete ?? current.precio_flete;
  const porcentajeComision = input.cliente_id
    ? cliente.porcentaje_comision
    : current.porcentaje_comision_aplicado;
  const financials = calculateFinancials(precioFleteBase, porcentajeComision);
  const costoDiesel = input.costo_diesel !== undefined
    ? toMoney(input.costo_diesel)
    : current.costo_diesel;
  const costoPeajes = input.costo_peajes !== undefined
    ? toMoney(input.costo_peajes)
    : current.costo_peajes;
  const costoEstimadoGastos =
    input.costo_estimado_gastos !== undefined
      ? toMoney(input.costo_estimado_gastos)
      : input.costo_diesel !== undefined || input.costo_peajes !== undefined
        ? await calculateCostoEstimadoWithGastos(id, costoDiesel, costoPeajes)
        : current.costo_estimado_gastos;
  const cobrado = Object.hasOwn(input, 'cobrado') ? input.cobrado! : current.cobrado;

  return prisma.viaje.update({
    where: { id },
    data: {
      cliente_id: input.cliente_id ? clienteId : undefined,
      vehiculo_id: input.vehiculo_id ? vehiculoId : undefined,
      conductor_id: input.conductor_id ? conductorId : undefined,
      tarifa_ruta_id: input.tarifa_ruta_id ? tarifaRutaId : undefined,
      fecha_salida: input.fecha_salida ? fechaSalida : undefined,
      fecha_llegada: Object.hasOwn(input, 'fecha_llegada') ? fechaLlegada : undefined,
      descripcion_carga: Object.hasOwn(input, 'descripcion_carga')
        ? input.descripcion_carga
        : undefined,
      peso_carga_kg: Object.hasOwn(input, 'peso_carga_kg') ? input.peso_carga_kg : undefined,
      numeros_guia_remision: Object.hasOwn(input, 'numeros_guia_remision')
        ? input.numeros_guia_remision
        : undefined,
      precio_flete: financials.precioFlete,
      porcentaje_comision_aplicado: financials.porcentajeComision,
      valor_comision: financials.valorComision,
      precio_real_flete:
        input.precio_real_flete === undefined
          ? financials.precioRealFlete
          : toMoney(input.precio_real_flete),
      galones_diesel:
        input.galones_diesel !== undefined ? toMoney(input.galones_diesel) : undefined,
      costo_diesel: input.costo_diesel !== undefined ? costoDiesel : undefined,
      costo_peajes: input.costo_peajes !== undefined ? costoPeajes : undefined,
      costo_estimado_gastos:
        input.costo_estimado_gastos !== undefined ? costoEstimadoGastos : undefined,
      costo_real_gastos: Object.hasOwn(input, 'costo_real_gastos')
        ? input.costo_real_gastos === null || input.costo_real_gastos === undefined
          ? null
          : toMoney(input.costo_real_gastos)
        : undefined,
      cobrado: Object.hasOwn(input, 'cobrado') ? cobrado : undefined,
      fecha_cobro:
        Object.hasOwn(input, 'cobrado') || Object.hasOwn(input, 'fecha_cobro')
          ? resolveCobro(cobrado, input.fecha_cobro, current.fecha_cobro)
          : undefined,
      estado: toPrismaEstadoViaje(input.estado),
      observaciones: Object.hasOwn(input, 'observaciones') ? input.observaciones : undefined
    },
    include: includeRelations
  });
};

export const updateEstadoViaje = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeEstadoInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getViajeById(propietarioId, id);

  return prisma.viaje.update({
    where: { id },
    data: {
      estado: toPrismaEstadoViaje(input.estado)
    },
    include: includeRelations
  });
};

export const updateCobroViaje = async (
  propietarioIdInput: unknown,
  idInput: unknown,
  input: ViajeCobroInput
) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);
  const current = await getViajeById(propietarioId, id);

  return prisma.viaje.update({
    where: { id },
    data: {
      cobrado: input.cobrado,
      fecha_cobro: resolveCobro(input.cobrado, input.fecha_cobro, current.fecha_cobro)
    },
    include: includeRelations
  });
};

export const cancelViaje = async (propietarioIdInput: unknown, idInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const id = parseBigIntId(idInput);

  await getViajeById(propietarioId, id);

  return prisma.viaje.update({
    where: { id },
    data: {
      estado: EstadoViaje.CANCELADO
    },
    include: includeRelations
  });
};
