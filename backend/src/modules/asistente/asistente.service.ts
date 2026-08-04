import type { JwtPayload } from '../../config/jwt.js';
import { AppError } from '../../utils/app-error.js';
import type { AuditContext } from '../../utils/audit.js';
import { asistenteMensajeSchema } from './asistente.schema.js';
import type { AsistenteMensajeInput } from './asistente.schema.js';
import { procesarMensajeAsistenteEngine, __testing } from './asistente.engine.js';
import { interpretAssistantMessage } from './asistente.interpreter.js';
import {
  assistantContextFromConversation,
  ensureAssistantConversation,
  getAssistantConversation,
  persistAssistantFailure,
  persistAssistantSuccess
} from './asistente.memory.js';
import {
  assertAssistantToolAllowed
} from './asistente.tools.js';
import {
  applyAssistantPreference,
  applyAssistantPreferencesToMessage,
  consultAssistantPreferences,
  listAssistantPreferences,
  prepareAssistantPreference
} from './asistente.preferences.js';
import { loadApprovedAssistantExamples } from './asistente.examples.js';
export {
  evaluateAssistantMessage,
  listAssistantEvaluations,
  reviewAssistantEvaluation
} from './asistente.feedback.js';

export { __testing };

export const procesarMensajeAsistente = async (
  user: JwtPayload,
  input: AsistenteMensajeInput,
  audit?: AuditContext
) => {
  const parsed = asistenteMensajeSchema.parse(input);
  const cancelling = parsed.mensaje.toLowerCase().includes('cancelar');
  const conversation = await ensureAssistantConversation(
    user,
    parsed.conversacion_id,
    parsed.canal,
    parsed.mensaje
  );
  const persistedContext = assistantContextFromConversation(conversation);
  if (parsed.contexto?.confirmar && !persistedContext?.action) {
    throw new AppError('No hay un borrador vigente para confirmar en esta conversacion', 400);
  }
  if (parsed.contexto?.confirmar) {
    const requestedAction = parsed.contexto.action;
    const persistedAction = persistedContext?.action;
    const sameAction =
      requestedAction &&
      persistedAction &&
      requestedAction.route === persistedAction.route &&
      JSON.stringify(requestedAction.query) === JSON.stringify(persistedAction.query) &&
      ['guardar', 'editar'].includes(requestedAction.operacion ?? '');
    if (!sameAction) {
      throw new AppError('La confirmacion no coincide con el borrador vigente', 400);
    }
  }

  const restoredContext = cancelling
    ? undefined
    : parsed.contexto?.confirmar
      ? {
          ...persistedContext,
          action: {
            ...persistedContext!.action!,
            label: parsed.contexto.action!.label,
            operacion: parsed.contexto.action!.operacion
          },
          confirmar: true
        }
      : persistedContext ?? parsed.contexto;
  const request = {
    ...parsed,
    contexto: restoredContext
  };
  const [preferences, approvedExamples] = await Promise.all([
    listAssistantPreferences(user),
    loadApprovedAssistantExamples(user)
  ]);
  const expanded = applyAssistantPreferencesToMessage(
    request.mensaje,
    preferences
  );
  const interpretation = await interpretAssistantMessage(
    user,
    {
      ...request,
      mensaje: expanded.message
    },
    approvedExamples
  );
  const tool = interpretation.tool;
  assertAssistantToolAllowed(tool, user, Boolean(request.contexto?.confirmar));
  const startedAt = Date.now();

  try {
    const engineRequest =
      {
        ...request,
        mensaje: interpretation.message,
        herramienta: interpretation.tool.name,
        entidades: interpretation.parameters,
        preferencias: preferences,
        capacidades: {
          super_admin: Boolean(user.es_super_admin),
          propietario: Boolean(user.es_super_admin || user.es_propietario),
          intermediario: Boolean(user.es_super_admin || user.es_intermediario)
        }
      };
    const executeRequest = async () => {
      if (cancelling) {
        return {
          tipo: 'accion' as const,
          respuesta: 'Listo, cancele el borrador y el contexto activos.',
          cards: [],
          detalle: '',
          sugerencias: ['Crear viaje', 'Crear mantenimiento', 'Consultar viajes']
        };
      }
      if (tool.name === 'consultar_preferencias') {
        return consultAssistantPreferences(user);
      }
      if (tool.name === 'preparar_preferencia') {
        return prepareAssistantPreference(user, request.mensaje);
      }
      if (tool.name === 'aplicar_preferencia') {
        return applyAssistantPreference(user, request, audit);
      }
      return procesarMensajeAsistenteEngine(
          user.propietario_id,
          engineRequest,
          audit
        );
    };
    const engineResponse = await executeRequest();
    const response = {
      ...engineResponse,
      interpretacion: {
        proveedor: interpretation.provider,
        modelo: interpretation.model,
        confianza: interpretation.confidence,
        respaldo: interpretation.fallbackReason,
        respuesta_id: interpretation.responseId,
        uso: interpretation.usage,
        preferencias_aplicadas: expanded.applied
      }
    };

    const persisted = await persistAssistantSuccess({
      conversationId: conversation.id,
      request,
      response,
      previousContext: conversation.contexto,
      tool,
      interpretation,
      durationMs: Date.now() - startedAt
    });

    return {
      ...response,
      conversacion_id: conversation.id,
      mensaje_id: persisted.assistantMessageId
    };
  } catch (error) {
    await persistAssistantFailure({
      conversationId: conversation.id,
      request,
      tool,
      interpretation,
      durationMs: Date.now() - startedAt,
      error
    });
    throw error;
  }
};

export const obtenerConversacionAsistente = (
  user: JwtPayload,
  conversationIdInput: unknown
) => getAssistantConversation(user, conversationIdInput);
