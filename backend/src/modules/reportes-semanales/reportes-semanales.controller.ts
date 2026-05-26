import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { parseReportExportFormat, sendReportExport } from '../../utils/report-export.js';
import { serializeResponse } from '../../utils/response.js';
import {
  buildReporteIngresosEgresosSemanalExportTable,
  buildReporteViajesConductorSemanalExportTable,
  buildReporteViajesVehiculoSemanalExportTable,
  getReporteIngresosEgresosSemanal,
  getReporteViajesConductorSemanal,
  getReporteViajesVehiculoSemanal
} from './reportes-semanales.service.js';

export const reporteViajesConductorSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const reporte = await getReporteViajesConductorSemanal(
      req.user!.propietario_id,
      req.query
    );
    res.json(serializeResponse(reporte));
  }
);

export const exportReporteViajesConductorSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteViajesConductorSemanal(
      req.user!.propietario_id,
      req.query
    );
    await sendReportExport(res, formato, buildReporteViajesConductorSemanalExportTable(reporte));
  }
);

export const reporteViajesVehiculoSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const reporte = await getReporteViajesVehiculoSemanal(
      req.user!.propietario_id,
      req.query
    );
    res.json(serializeResponse(reporte));
  }
);

export const exportReporteViajesVehiculoSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteViajesVehiculoSemanal(
      req.user!.propietario_id,
      req.query
    );
    await sendReportExport(res, formato, buildReporteViajesVehiculoSemanalExportTable(reporte));
  }
);

export const reporteIngresosEgresosSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const reporte = await getReporteIngresosEgresosSemanal(
      req.user!.propietario_id,
      req.query
    );
    res.json(serializeResponse(reporte));
  }
);

export const exportReporteIngresosEgresosSemanalController = asyncHandler(
  async (req: Request, res: Response) => {
    const formato = parseReportExportFormat(req.query.formato ?? req.query.format);
    const reporte = await getReporteIngresosEgresosSemanal(
      req.user!.propietario_id,
      req.query
    );
    await sendReportExport(res, formato, buildReporteIngresosEgresosSemanalExportTable(reporte));
  }
);
