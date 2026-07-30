import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { auditContextFromRequest } from '../../utils/audit.js';
import {
  obtenerConversacionAsistente,
  procesarMensajeAsistente
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
