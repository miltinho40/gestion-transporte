import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import { buildPaginatedResult, parsePagination } from '../../utils/pagination.js';
import {
  asistenteEvaluacionSchema,
  asistenteRevisionSchema,
  type AsistenteEvaluacionInput,
  type AsistenteRevisionInput
} from './asistente.schema.js';
import {
  buildApprovedExample,
  summarizeDynamicEvaluationCases
} from './asistente.examples.js';

interface EvaluationFilters extends Record<string, unknown> {
  search?: unknown;
  calificacion?: unknown;
  estado?: unknown;
  desde?: unknown;
  hasta?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const numberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const textOrNull = (value: unknown, maxLength: number) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
};

const dateFilter = (value: unknown, endOfDay = false) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const feedbackWhere = (
  propietarioId: bigint | null,
  filters: EvaluationFilters
): Prisma.EvaluacionAsistenteWhereInput => {
  const where: Prisma.EvaluacionAsistenteWhereInput = propietarioId
    ? { propietario_id: propietarioId }
    : {};
  const rating = typeof filters.calificacion === 'string' ? filters.calificacion : '';
  const state = typeof filters.estado === 'string' ? filters.estado : '';
  const from = dateFilter(filters.desde);
  const to = dateFilter(filters.hasta, true);

  if (rating === 'correcta' || rating === 'incorrecta') where.calificacion = rating;
  if (['pendiente', 'revisada', 'descartada'].includes(state)) where.estado_revision = state;
  if (from || to) {
    where.created_at = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    };
  }

  if (typeof filters.search === 'string' && filters.search.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { mensaje_usuario: { contains: search, mode: 'insensitive' } },
      { respuesta_asistente: { contains: search, mode: 'insensitive' } },
      { correccion: { contains: search, mode: 'insensitive' } },
      { herramienta: { contains: search, mode: 'insensitive' } },
      { modelo: { contains: search, mode: 'insensitive' } },
      { propietario: { nombre: { contains: search, mode: 'insensitive' } } },
      { usuario: { nombre: { contains: search, mode: 'insensitive' } } }
    ];
  }

  return where;
};

export const evaluateAssistantMessage = async (
  user: JwtPayload,
  messageIdInput: unknown,
  input: AsistenteEvaluacionInput
) => {
  const messageId = parseBigIntId(messageIdInput, 'mensaje_id');
  const propietarioId = parseBigIntId(user.propietario_id, 'propietario_id');
  const usuarioId = parseBigIntId(user.usuario_id, 'usuario_id');
  const parsed = asistenteEvaluacionSchema.parse(input);

  const message = await prisma.mensajeAsistente.findFirst({
    where: {
      id: messageId,
      rol: 'asistente',
      conversacion: {
        propietario_id: propietarioId,
        usuario_id: usuarioId
      }
    },
    select: {
      id: true,
      conversacion_id: true,
      contenido: true,
      metadata: true,
      created_at: true
    }
  });

  if (!message) {
    throw new AppError('Respuesta del asistente no encontrada', 404);
  }

  const [execution, userMessage] = await Promise.all([
    prisma.ejecucionHerramientaAsistente.findFirst({
      where: {
        conversacion_id: message.conversacion_id,
        created_at: { gte: message.created_at }
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
    }),
    prisma.mensajeAsistente.findFirst({
      where: {
        conversacion_id: message.conversacion_id,
        rol: 'usuario',
        created_at: { lte: message.created_at }
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      select: { contenido: true }
    })
  ]);

  const metadata = asRecord(message.metadata);
  const interpretation = asRecord(metadata['interpretacion']);
  const usage = asRecord(interpretation['uso']);
  const executionParameters = asRecord(execution?.parametros);
  const executionInterpretation = asRecord(executionParameters['interpretacion']);
  const parameters = executionInterpretation['parametros_extraidos'];
  const correction = parsed.correccion?.trim() || null;
  const snapshot = {
    mensaje_usuario:
      textOrNull(executionParameters['mensaje'], 1200) ?? userMessage?.contenido.slice(0, 1200) ?? null,
    respuesta_asistente: message.contenido,
    herramienta: execution?.herramienta ?? null,
    parametros:
      parameters && typeof parameters === 'object'
        ? (JSON.parse(JSON.stringify(parameters)) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    proveedor: textOrNull(interpretation['proveedor'], 20),
    modelo: textOrNull(interpretation['modelo'], 100),
    confianza: numberOrNull(interpretation['confianza']),
    duracion_ms: execution?.duracion_ms ?? null,
    tokens_entrada: numberOrNull(usage['inputTokens']),
    tokens_salida: numberOrNull(usage['outputTokens']),
    tokens_total: numberOrNull(usage['totalTokens'])
  };

  const evaluation = await prisma.evaluacionAsistente.upsert({
    where: { mensaje_id: message.id },
    create: {
      mensaje_id: message.id,
      conversacion_id: message.conversacion_id,
      propietario_id: propietarioId,
      usuario_id: usuarioId,
      calificacion: parsed.calificacion,
      correccion: parsed.calificacion === 'incorrecta' ? correction : null,
      ...snapshot
    },
    update: {
      calificacion: parsed.calificacion,
      correccion: parsed.calificacion === 'incorrecta' ? correction : null,
      estado_revision: 'pendiente',
      revisado_por_id: null,
      revisado_at: null,
      ...snapshot
    },
    select: {
      id: true,
      mensaje_id: true,
      calificacion: true,
      correccion: true,
      updated_at: true
    }
  });
  await prisma.ejemploAsistente.updateMany({
    where: { evaluacion_id: evaluation.id },
    data: { activo: false }
  });
  return evaluation;
};

export const listAssistantEvaluations = async (
  user: JwtPayload,
  filters: EvaluationFilters
) => {
  const propietarioId = user.es_super_admin
    ? null
    : parseBigIntId(user.propietario_id, 'propietario_id');
  const where = feedbackWhere(propietarioId, filters);
  const pagination = parsePagination(filters, { defaultLimit: 25, maxLimit: 100 }) ?? {
    page: 1,
    limit: 25,
    skip: 0
  };

  const [data, total, correct, incorrect, pending, metrics, activeExamples] = await prisma.$transaction([
    prisma.evaluacionAsistente.findMany({
      where,
      include: {
        propietario: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
        revisado_por: { select: { id: true, nombre: true } },
        conversacion: { select: { canal: true } },
        ejemplo: { select: { id: true, activo: true, herramienta_esperada: true } }
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.evaluacionAsistente.count({ where }),
    prisma.evaluacionAsistente.count({ where: { ...where, calificacion: 'correcta' } }),
    prisma.evaluacionAsistente.count({ where: { ...where, calificacion: 'incorrecta' } }),
    prisma.evaluacionAsistente.count({ where: { ...where, estado_revision: 'pendiente' } }),
    prisma.evaluacionAsistente.aggregate({
      where,
      _avg: { duracion_ms: true },
      _sum: { tokens_entrada: true, tokens_salida: true, tokens_total: true }
    }),
    prisma.ejemploAsistente.findMany({
      where: {
        activo: true,
        ...(propietarioId ? { propietario_id: propietarioId } : {})
      },
      select: { mensaje_usuario: true, herramienta_esperada: true }
    })
  ]);
  const inputTokens = metrics._sum.tokens_entrada ?? 0;
  const outputTokens = metrics._sum.tokens_salida ?? 0;
  const costConfigured =
    env.OPENAI_INPUT_COST_PER_MILLION > 0 || env.OPENAI_OUTPUT_COST_PER_MILLION > 0;
  const estimatedCost = costConfigured
    ? Number(
        (
          (inputTokens / 1_000_000) * env.OPENAI_INPUT_COST_PER_MILLION +
          (outputTokens / 1_000_000) * env.OPENAI_OUTPUT_COST_PER_MILLION
        ).toFixed(6)
      )
    : null;
  const dynamicCases = summarizeDynamicEvaluationCases(activeExamples);

  return {
    ...buildPaginatedResult(data, total, pagination),
    resumen: {
      total,
      correctas: correct,
      incorrectas: incorrect,
      porcentaje_correctas: total ? Number(((correct / total) * 100).toFixed(1)) : 0,
      pendientes_revision: pending,
      duracion_promedio_ms: Math.round(metrics._avg.duracion_ms ?? 0),
      tokens_entrada: inputTokens,
      tokens_salida: outputTokens,
      tokens_total: metrics._sum.tokens_total ?? 0,
      costo_estimado_usd: estimatedCost,
      tarifa_costo_configurada: costConfigured,
      ejemplos_activos: dynamicCases.total,
      casos_dinamicos_correctos: dynamicCases.correctos,
      porcentaje_casos_dinamicos: dynamicCases.porcentaje_correctos
    }
  };
};

export const reviewAssistantEvaluation = async (
  user: JwtPayload,
  evaluationIdInput: unknown,
  input: AsistenteRevisionInput
) => {
  const evaluationId = parseBigIntId(evaluationIdInput, 'evaluacion_id');
  const propietarioId = user.es_super_admin
    ? null
    : parseBigIntId(user.propietario_id, 'propietario_id');
  const reviewerId = parseBigIntId(user.usuario_id, 'usuario_id');
  const parsed = asistenteRevisionSchema.parse(input);
  const current = await prisma.evaluacionAsistente.findFirst({
    where: {
      id: evaluationId,
      ...(propietarioId ? { propietario_id: propietarioId } : {})
    },
    select: {
      id: true,
      propietario_id: true,
      calificacion: true,
      mensaje_usuario: true,
      correccion: true,
      parametros: true
    }
  });

  if (!current) throw new AppError('Evaluacion del asistente no encontrada', 404);

  const approvedExample =
    parsed.estado === 'revisada' && current.calificacion === 'incorrecta'
      ? buildApprovedExample(current)
      : null;

  return prisma.$transaction(async (tx) => {
    await tx.evaluacionAsistente.update({
      where: { id: current.id },
      data: {
        estado_revision: parsed.estado,
        revisado_por_id: parsed.estado === 'pendiente' ? null : reviewerId,
        revisado_at: parsed.estado === 'pendiente' ? null : new Date()
      }
    });

    if (approvedExample) {
      await tx.ejemploAsistente.upsert({
        where: { evaluacion_id: current.id },
        create: {
          evaluacion_id: current.id,
          propietario_id: current.propietario_id,
          ...approvedExample,
          activo: true
        },
        update: {
          ...approvedExample,
          activo: true
        }
      });
    } else {
      await tx.ejemploAsistente.updateMany({
        where: { evaluacion_id: current.id },
        data: { activo: false }
      });
    }

    return tx.evaluacionAsistente.findUniqueOrThrow({
      where: { id: current.id },
      include: {
        revisado_por: { select: { id: true, nombre: true } },
        ejemplo: { select: { id: true, activo: true, herramienta_esperada: true } }
      }
    });
  });
};

export const __testing = {
  feedbackWhere,
  dateFilter
};
