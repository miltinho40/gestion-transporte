import { Prisma, TipoGastoSemanalVehiculo } from '@prisma/client';
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
  GastoSemanalUpdateInput
} from './cierres-semanales.schema.js';
import { gastoSemanalInclude, type GastoSemanalCierre } from './cierres-semanales.types.js';
import {
  toMoney,
  isRetornoGastoViaje,
  viajeFechaEntrega,
  buildViajeSemanaWhere,
  getIsoWeekRange,
  assertSemanaTerminada,
  buildVehiculoMini,
  createTotalesViajes,
  formatViajeCierre,
  addViajeToTotales
} from './cierres-semanales.calculo.js';
import {
  getGastoSemanalById,
  ensureVehiculo,
  ensureConductor,
  assertConductorForGeneratedType,
  buildCierreData
} from './cierres-semanales.data.js';
import {
  saveCierreSemanalSnapshot,
  buildCierreDiferencias,
  buildCierreRevision
} from './cierres-semanales.revision.js';
import { buildCierreAssistant } from './cierres-semanales.asistente.js';
export {
  getIsoWeekRange,
  calculateBonificacion,
  calculatePagoSemanalConductor
} from './cierres-semanales.calculo.js';
export { getBonusConfig, getPagosSemanalesConductores } from './cierres-semanales.pagos.js';

export const __testing = {
  addViajeToTotales,
  buildCierreAssistant,
  buildCierreDiferencias,
  buildViajeSemanaWhere,
  createTotalesViajes,
  formatViajeCierre,
  isRetornoGastoViaje,
  viajeFechaEntrega
};

export const upsertGeneratedGasto = async (
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
  const asistenteCierre = buildCierreAssistant(cierre, revisionCierre);

  const { conductores_operativos: _internal, ...response } = cierre;
  return {
    ...response,
    revision_cierre: revisionCierre,
    asistente_cierre: asistenteCierre
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

  if (cierre.resumen.cantidad_gastos_generados > 0 && !revisionAntesDeGenerar?.requiere_revision) {
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
  const revisionCierre = {
    cerrado: true,
    cierre_id: cierreGuardado.id,
    cerrado_en: cierreGuardado.cerrado_en,
    referencia_cierre: null,
    requiere_revision: false,
    diferencias: [],
    total_diferencias: 0
  };

  return {
    gastos_generados: formatGastosSemanales(gastos),
    cierre_guardado: cierreGuardado,
    cierre: {
      ...response,
      revision_cierre: revisionCierre,
      asistente_cierre: buildCierreAssistant(cierreActualizado, revisionCierre)
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
  const conductorId = input.conductor_id ? parseBigIntId(input.conductor_id, 'conductor_id') : null;
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
