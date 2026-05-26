import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { parseReportExportFormat, sendReportExport } from '../../utils/report-export.js';
import { serializeResponse } from '../../utils/response.js';
import {
  buildReporteMantenimientosExportTable,
  getReporteMantenimientos
} from './reportes.service.js';

export const reporteMantenimientosController = asyncHandler(
  async (req: Request, res: Response) => {
    const reporte = await getReporteMantenimientos(req.user!.propietario_id, req.query);
    res.json(serializeResponse(reporte));
  }
);

export const exportReporteMantenimientosController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteMantenimientos(req.user!.propietario_id, req.query);
    await sendReportExport(res, formato, buildReporteMantenimientosExportTable(reporte));
  }
);
