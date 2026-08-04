import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { AssistantExtractedParameters } from './asistente.interpreter.js';
import type { AssistantToolName } from './asistente.tools.js';
import { selectAssistantTool } from './asistente.tools.js';

export interface ApprovedAssistantExample {
  mensaje: string;
  correccion: string;
  herramienta: AssistantToolName;
  parametros: AssistantExtractedParameters;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const anonymizeText = (value: string, parameters: Record<string, unknown>) => {
  let result = value;
  const replacements = Object.entries(parameters)
    .map(([key, item]) => ({ key, value: String(item ?? '').trim() }))
    .filter((item) => item.value.length >= 3)
    .sort((left, right) => right.value.length - left.value.length);

  for (const replacement of replacements) {
    result = result.replace(
      new RegExp(escapeRegExp(replacement.value), 'gi'),
      `[${replacement.key.toUpperCase()}]`
    );
  }

  return result
    .replace(/\b[A-Z]{3}[- ]?\d{3,4}\b/gi, '[VEHICULO]')
    .replace(/\b\d{10,13}\b/g, '[IDENTIFICADOR]')
    .trim();
};

const consolidatedTool = (tool: AssistantToolName): AssistantToolName => {
  const legacy = tool as string;
  if (['consultar_viajes_pendientes', 'consultar_viajes_proveedor'].includes(legacy)) {
    return 'consultar_viajes';
  }
  if (legacy === 'consultar_cierre_semanal') return 'analizar_operacion';
  return tool;
};

const expectedToolFromCorrection = (message: string, correction: string) =>
  consolidatedTool(
    selectAssistantTool({
      mensaje: `${correction}. Solicitud original: ${message}`,
      canal: 'web'
    }).name
  );

export const buildApprovedExample = (evaluation: {
  mensaje_usuario: string | null;
  correccion: string | null;
  parametros: unknown;
}) => {
  if (!evaluation.mensaje_usuario?.trim() || !evaluation.correccion?.trim()) return null;
  const parameters = asRecord(evaluation.parametros);
  const tool = expectedToolFromCorrection(
    evaluation.mensaje_usuario,
    evaluation.correccion
  );

  return {
    mensaje_usuario: anonymizeText(evaluation.mensaje_usuario, parameters),
    correccion: anonymizeText(evaluation.correccion, parameters),
    herramienta_esperada: tool,
    parametros_esperados: parameters as Prisma.InputJsonValue
  };
};

export const loadApprovedAssistantExamples = async (
  user: JwtPayload,
  limit = 8
): Promise<ApprovedAssistantExample[]> => {
  const propietarioId = parseBigIntId(user.propietario_id, 'propietario_id');
  const pendingBackfill = await prisma.evaluacionAsistente.findMany({
    where: {
      propietario_id: propietarioId,
      calificacion: 'incorrecta',
      estado_revision: 'revisada',
      correccion: { not: null },
      ejemplo: null
    },
    select: {
      id: true,
      propietario_id: true,
      mensaje_usuario: true,
      correccion: true,
      parametros: true
    },
    orderBy: { updated_at: 'desc' },
    take: 20
  });
  for (const evaluation of pendingBackfill) {
    const example = buildApprovedExample(evaluation);
    if (!example) continue;
    await prisma.ejemploAsistente.upsert({
      where: { evaluacion_id: evaluation.id },
      create: {
        evaluacion_id: evaluation.id,
        propietario_id: evaluation.propietario_id,
        ...example,
        activo: true
      },
      update: { ...example, activo: true }
    });
  }

  const rows = await prisma.ejemploAsistente.findMany({
    where: {
      propietario_id: propietarioId,
      activo: true
    },
    orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(limit, 1), 12)
  });

  return rows.map((row) => ({
    mensaje: row.mensaje_usuario,
    correccion: row.correccion,
    herramienta: consolidatedTool(row.herramienta_esperada as AssistantToolName),
    parametros: asRecord(row.parametros_esperados) as AssistantExtractedParameters
  }));
};

export const summarizeDynamicEvaluationCases = (
  examples: Array<{ mensaje_usuario: string; herramienta_esperada: string }>
) => {
  const correct = examples.filter((example) => {
    const current = selectAssistantTool({
      mensaje: example.mensaje_usuario,
      canal: 'web'
    }).name;
    return consolidatedTool(current) === consolidatedTool(example.herramienta_esperada as AssistantToolName);
  }).length;

  return {
    total: examples.length,
    correctos: correct,
    porcentaje_correctos: examples.length
      ? Number(((correct / examples.length) * 100).toFixed(1))
      : 0
  };
};

export const __testing = {
  anonymizeText,
  buildApprovedExample,
  consolidatedTool,
  expectedToolFromCorrection
};
