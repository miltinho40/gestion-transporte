import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { parseReportExportFormat, sendReportExport } from '../../utils/report-export.js';
import { serializeResponse } from '../../utils/response.js';
import {
  buildReporteMantenimientosExportTable,
  buildReporteUtilidadExportTable,
  buildReporteViajesExportTable,
  getReporteMantenimientos,
  getReporteUtilidad,
  getReporteViajes
} from './reportes.service.js';

export const reporteViajesController = asyncHandler(async (req: Request, res: Response) => {
  const reporte = await getReporteViajes(req.user!.propietario_id, req.query);
  res.json(serializeResponse(reporte));
});

export const exportReporteViajesController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteViajes(req.user!.propietario_id, req.query);
    await sendReportExport(res, formato, buildReporteViajesExportTable(reporte));
  }
);

export const reporteUtilidadController = asyncHandler(async (req: Request, res: Response) => {
  const reporte = await getReporteUtilidad(req.user!.propietario_id, req.query);
  res.json(serializeResponse(reporte));
});

export const exportReporteUtilidadController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteUtilidad(req.user!.propietario_id, req.query);
    await sendReportExport(res, formato, buildReporteUtilidadExportTable(reporte));
  }
);

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
