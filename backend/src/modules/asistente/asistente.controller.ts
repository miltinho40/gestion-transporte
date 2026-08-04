import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { auditContextFromRequest } from '../../utils/audit.js';
import {
  evaluateAssistantMessage,
  listAssistantEvaluations,
  obtenerConversacionAsistente,
  procesarMensajeAsistente,
  reviewAssistantEvaluation
} from './asistente.service.js';

export const procesarMensajeAsistenteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await procesarMensajeAsistente(
      req.user!,
      req.body,
      auditContextFromRequest(req)
    );
    res.json(serializeResponse(result));
  }
);

export const obtenerConversacionAsistenteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await obtenerConversacionAsistente(req.user!, req.params.id);
    res.json(serializeResponse(result));
  }
);

export const evaluarRespuestaAsistenteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await evaluateAssistantMessage(req.user!, req.params.id, req.body);
    res.json(serializeResponse(result));
  }
);

export const listarEvaluacionesAsistenteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAssistantEvaluations(req.user!, req.query);
    res.json(serializeResponse(result));
  }
);

export const revisarEvaluacionAsistenteController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await reviewAssistantEvaluation(req.user!, req.params.id, req.body);
    res.json(serializeResponse(result));
  }
);
