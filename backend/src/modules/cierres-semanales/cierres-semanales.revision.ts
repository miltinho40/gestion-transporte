import { EstadoMantenimiento, EstadoViaje, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';
import { toMoney, viajeFechaEntrega, buildViajeSemanaWhere } from './cierres-semanales.calculo.js';
import { type CierreData } from './cierres-semanales.data.js';

export const moneyString = (value: number | string | Prisma.Decimal | null | undefined) =>
  toMoney(value).toFixed(2);

export const dateOnlyString = (value: Date) => value.toISOString().slice(0, 10);

export const buildCierreMetrics = (cierre: CierreData) => ({
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

export const buildCierreSnapshot = (cierre: CierreData) => {
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

export const saveCierreSemanalSnapshot = async (
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

export const countComparisons = [
  { key: 'cantidad_viajes', label: 'Viajes' },
  { key: 'cantidad_mantenimientos', label: 'Mantenimientos' },
  { key: 'cantidad_gastos_semanales', label: 'Gastos semanales' }
] as const;

export const moneyComparisons = [
  { key: 'total_precio_flete', label: 'Total viajes' },
  { key: 'total_precio_real_flete', label: 'Valor a facturar' },
  { key: 'total_utilidad', label: 'Utilidad viajes' },
  { key: 'total_mantenimientos', label: 'Mantenimientos' },
  { key: 'total_gastos_semanales', label: 'Gastos semanales' },
  { key: 'total_sueldos', label: 'Sueldo semanal' },
  { key: 'total_bonificaciones', label: 'Bono' },
  { key: 'resultado_operativo', label: 'Ganancia semanal' }
] as const;

export const buildCierreDiferencias = (
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

export const latestDate = (values: (Date | null | undefined)[]) => {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps));
};

export const getGeneratedClosureReference = async (
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

export const shouldCheckLegacyPostClosureChanges = (
  cierre: Prisma.CierreSemanalGetPayload<{ include: { vehiculo: true } }>,
  generatedReference: Date | null
) => {
  if (!generatedReference) return false;
  return cierre.cerrado_en.getTime() - generatedReference.getTime() > 60_000;
};

export const buildPostClosureDiferencias = async (
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

export const buildCierreRevision = async (
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
  const postClosureDiferencias = shouldCheckLegacyPostClosureChanges(cierre, generatedReference)
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

export type CierreRevision = Awaited<ReturnType<typeof buildCierreRevision>>;
