import { Prisma } from '@prisma/client';
import type { JwtPayload } from '../../config/jwt.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { parseBigIntId } from '../../utils/ids.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';
import type { AssistantInterpretation } from './asistente.interpreter.js';
import type { AssistantToolDefinition } from './asistente.tools.js';

type AssistantEngineResponse = Record<string, unknown> & {
  tipo?: string;
  respuesta?: string;
  draft?: Record<string, unknown> & {
    tipo?: string;
    advertencias?: string[];
  };
  actions?: unknown[];
  contexto?: unknown;
};

const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_key, innerValue) =>
      typeof innerValue === 'bigint' ? innerValue.toString() : innerValue
    )
  ) as Prisma.InputJsonValue;

export const contextForNextMessage = (
  input: AsistenteMensajeInput,
  response: AssistantEngineResponse,
  previousContext: unknown
) => {
  if (String(input.mensaje).toLowerCase().includes('cancelar')) return Prisma.JsonNull;

  if (input.contexto?.confirmar) return Prisma.JsonNull;

  if (response.draft && Array.isArray(response.actions) && response.actions[0]) {
    return jsonValue({
      draft: response.draft,
      action: response.actions[0]
    });
  }

  if (response.contexto) {
    return jsonValue({ consulta: response.contexto });
  }

  return previousContext === null || previousContext === undefined
    ? Prisma.JsonNull
    : jsonValue(previousContext);
};

export const ensureAssistantConversation = async (
  user: JwtPayload,
  conversationIdInput?: unknown,
  channel = 'web',
  firstMessage?: string
) => {
  const propietarioId = parseBigIntId(user.propietario_id, 'propietario_id');
  const usuarioId = parseBigIntId(user.usuario_id, 'usuario_id');

  if (conversationIdInput) {
    const conversationId = parseBigIntId(conversationIdInput, 'conversacion_id');
    const conversation = await prisma.conversacionAsistente.findFirst({
      where: {
        id: conversationId,
        propietario_id: propietarioId,
        usuario_id: usuarioId,
        estado: 'activa'
      }
    });

    if (!conversation) {
      throw new AppError('Conversacion del asistente no encontrada', 404);
    }

    return conversation;
  }

  return prisma.conversacionAsistente.create({
    data: {
      propietario_id: propietarioId,
      usuario_id: usuarioId,
      canal: channel === 'movil' ? 'movil' : 'web',
      titulo: firstMessage?.trim().slice(0, 160) || 'Nueva conversacion'
    }
  });
};

export const assistantContextFromConversation = (conversation: { contexto: unknown }) => {
  if (!conversation.contexto || typeof conversation.contexto !== 'object') return undefined;
  return conversation.contexto as AsistenteMensajeInput['contexto'];
};

export const persistAssistantSuccess = async (input: {
  conversationId: bigint;
  request: AsistenteMensajeInput;
  response: AssistantEngineResponse;
  previousContext: unknown;
  tool: AssistantToolDefinition;
  interpretation?: AssistantInterpretation;
  durationMs: number;
}) => {
  const nextContext = contextForNextMessage(input.request, input.response, input.previousContext);
  const confirmed = Boolean(input.request.contexto?.confirmar);

  await prisma.$transaction(async (tx) => {
    await tx.mensajeAsistente.create({
      data: {
        conversacion_id: input.conversationId,
        rol: 'usuario',
        contenido: input.request.mensaje,
        metadata: input.request.contexto ? jsonValue({ contexto: input.request.contexto }) : undefined
      }
    });

    await tx.mensajeAsistente.create({
      data: {
        conversacion_id: input.conversationId,
        rol: 'asistente',
        contenido: String(input.response.respuesta ?? ''),
        metadata: jsonValue(input.response)
      }
    });

    await tx.ejecucionHerramientaAsistente.create({
      data: {
        conversacion_id: input.conversationId,
        herramienta: input.tool.name,
        categoria: input.tool.category,
        estado: 'completada',
        parametros: jsonValue({
          mensaje: input.request.mensaje,
          contexto: input.request.contexto,
          interpretacion: input.interpretation
            ? {
                proveedor: input.interpretation.provider,
                modelo: input.interpretation.model,
                confianza: input.interpretation.confidence,
                respaldo: input.interpretation.fallbackReason,
                respuesta_id: input.interpretation.responseId,
                uso: input.interpretation.usage,
                parametros_extraidos: input.interpretation.parameters,
                mensaje_canonico:
                  input.interpretation.message === input.request.mensaje
                    ? undefined
                    : input.interpretation.message
              }
            : undefined
        }),
        resultado: jsonValue({
          tipo: input.response.tipo,
          respuesta: input.response.respuesta
        }),
        requiere_confirmacion: input.tool.requiresConfirmation,
        confirmada: confirmed,
        duracion_ms: input.durationMs
      }
    });

    if (input.response.draft) {
      const currentDraft = await tx.borradorAsistente.findFirst({
        where: {
          conversacion_id: input.conversationId,
          estado: 'pendiente'
        },
        orderBy: { updated_at: 'desc' }
      });
      const draftData = {
        tipo: input.response.draft.tipo ?? 'desconocido',
        datos: jsonValue({
          draft: input.response.draft,
          action: Array.isArray(input.response.actions) ? input.response.actions[0] : undefined
        }),
        advertencias: jsonValue(input.response.draft.advertencias ?? []),
        expira_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      if (currentDraft) {
        await tx.borradorAsistente.update({
          where: { id: currentDraft.id },
          data: draftData
        });
      } else {
        await tx.borradorAsistente.create({
          data: {
            conversacion_id: input.conversationId,
            ...draftData
          }
        });
      }
    } else if (confirmed) {
      await tx.borradorAsistente.updateMany({
        where: {
          conversacion_id: input.conversationId,
          estado: 'pendiente'
        },
        data: {
          estado: 'aplicado',
          aplicado_at: new Date()
        }
      });
    } else if (String(input.request.mensaje).toLowerCase().includes('cancelar')) {
      await tx.borradorAsistente.updateMany({
        where: {
          conversacion_id: input.conversationId,
          estado: 'pendiente'
        },
        data: {
          estado: 'cancelado'
        }
      });
    }

    await tx.conversacionAsistente.update({
      where: { id: input.conversationId },
      data: {
        contexto: nextContext,
        ultimo_mensaje_at: new Date()
      }
    });
  });
};

export const persistAssistantFailure = async (input: {
  conversationId: bigint;
  request: AsistenteMensajeInput;
  tool: AssistantToolDefinition;
  interpretation?: AssistantInterpretation;
  durationMs: number;
  error: unknown;
}) => {
  const message = input.error instanceof Error ? input.error.message : 'Error desconocido';

  await prisma.$transaction([
    prisma.mensajeAsistente.create({
      data: {
        conversacion_id: input.conversationId,
        rol: 'usuario',
        contenido: input.request.mensaje
      }
    }),
    prisma.ejecucionHerramientaAsistente.create({
      data: {
        conversacion_id: input.conversationId,
        herramienta: input.tool.name,
        categoria: input.tool.category,
        estado: 'error',
        parametros: jsonValue({
          mensaje: input.request.mensaje,
          interpretacion: input.interpretation
            ? {
                proveedor: input.interpretation.provider,
                modelo: input.interpretation.model,
                confianza: input.interpretation.confidence,
                respaldo: input.interpretation.fallbackReason,
                respuesta_id: input.interpretation.responseId,
                uso: input.interpretation.usage,
                parametros_extraidos: input.interpretation.parameters
              }
            : undefined
        }),
        requiere_confirmacion: input.tool.requiresConfirmation,
        confirmada: Boolean(input.request.contexto?.confirmar),
        error: message.slice(0, 500),
        duracion_ms: input.durationMs
      }
    }),
    prisma.conversacionAsistente.update({
      where: { id: input.conversationId },
      data: { ultimo_mensaje_at: new Date() }
    })
  ]);
};

export const getAssistantConversation = async (
  user: JwtPayload,
  conversationIdInput: unknown
) => {
  const conversationId = parseBigIntId(conversationIdInput, 'conversacion_id');
  const propietarioId = parseBigIntId(user.propietario_id, 'propietario_id');
  const usuarioId = parseBigIntId(user.usuario_id, 'usuario_id');

  const conversation = await prisma.conversacionAsistente.findFirst({
    where: {
      id: conversationId,
      propietario_id: propietarioId,
      usuario_id: usuarioId,
      estado: 'activa'
    },
    include: {
      mensajes: {
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        take: 100
      }
    }
  });

  if (!conversation) {
    throw new AppError('Conversacion del asistente no encontrada', 404);
  }

  return conversation;
};

export const __testing = {
  contextForNextMessage
};
