import type { Request } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { serializeResponse } from '../../utils/response.js';
import { auditContextFromRequest } from '../../utils/audit.js';
import {
  abonoFacturaSchema,
  cerrarFacturaSchema,
  configuracionFacturaSchema,
  crearFacturaSchema,
  facturaSchema,
  idFactura,
  listadoFacturasSchema,
  numeroBorradorSchema,
  versionFacturaSchema
} from './facturacion.schema.js';
import { viajesFacturacionFiltersSchema } from './facturacion.filters.js';
import {
  cerrarFactura,
  crearFactura,
  deshacerFactura,
  getConfiguracionFacturacion,
  getFactura,
  guardarBorradorFactura,
  listBorradoresFactura,
  listFacturas,
  listViajesFacturacion,
  previsualizarFactura,
  registrarAbonoFactura,
  updateConfiguracionFacturacion
} from './facturacion.service.js';

const ownerFor = (req: Request) => BigInt(req.user!.propietario_id!);
const accessFor = (req: Request) => ({
  own: Boolean(req.user?.es_super_admin || req.user?.es_propietario),
  external: Boolean(req.user?.es_super_admin || req.user?.es_intermediario)
});

export const getConfiguracionFacturacionController = asyncHandler(async (req, res) => {
  const result = await getConfiguracionFacturacion(ownerFor(req));
  res.json(serializeResponse(result));
});

export const updateConfiguracionFacturacionController = asyncHandler(async (req, res) => {
  const input = configuracionFacturaSchema.parse(req.body);
  const result = await updateConfiguracionFacturacion(
    ownerFor(req),
    input,
    auditContextFromRequest(req)
  );
  res.json(serializeResponse(result));
});

export const listViajesFacturacionController = asyncHandler(async (req, res) => {
  const filters = viajesFacturacionFiltersSchema.parse(req.query);
  const result = await listViajesFacturacion(ownerFor(req), filters, accessFor(req));
  res.json(serializeResponse(result));
});

export const previsualizarFacturaController = asyncHandler(async (req, res) => {
  const input = facturaSchema.parse({ ...req.body, numero: req.body.numero || 'VISTA PREVIA' });
  const draftId = req.body.factura_id ? BigInt(idFactura.parse(req.body.factura_id)) : undefined;
  const result = await previsualizarFactura(ownerFor(req), input, accessFor(req), draftId);
  res.json(serializeResponse(result));
});

export const crearFacturaController = asyncHandler(async (req, res) => {
  const input = crearFacturaSchema.parse(req.body);
  const result = await crearFactura(
    ownerFor(req),
    input,
    accessFor(req),
    auditContextFromRequest(req)
  );
  res.status(201).json(serializeResponse(result));
});

export const listFacturasController = asyncHandler(async (req, res) => {
  const filters = listadoFacturasSchema.parse(req.query);
  const result = await listFacturas(ownerFor(req), filters);
  res.json(serializeResponse(result));
});

export const listBorradoresFacturaController = asyncHandler(async (req, res) => {
  const recipient = BigInt(idFactura.parse(req.query.destinatario_id));
  const result = await listBorradoresFactura(ownerFor(req), recipient);
  res.json(serializeResponse(result));
});

export const getFacturaController = asyncHandler(async (req, res) => {
  const id = BigInt(idFactura.parse(req.params.id));
  const result = await getFactura(ownerFor(req), id);
  res.json(serializeResponse(result));
});

export const guardarBorradorFacturaController = asyncHandler(async (req, res) => {
  const number = numeroBorradorSchema.parse(req.body.numero);
  const input = facturaSchema.parse({ ...req.body, numero: number || 'BORRADOR' });
  const id = req.params.id ? BigInt(idFactura.parse(req.params.id)) : undefined;
  const { version } = versionFacturaSchema.parse({ version: req.body.version ?? 0 });
  const result = await guardarBorradorFactura(
    ownerFor(req),
    input,
    number,
    accessFor(req),
    version,
    id,
    auditContextFromRequest(req)
  );
  res.status(id ? 200 : 201).json(serializeResponse(result));
});

export const cerrarFacturaController = asyncHandler(async (req, res) => {
  const id = BigInt(idFactura.parse(req.params.id));
  const input = cerrarFacturaSchema.parse(req.body);
  const result = await cerrarFactura(
    ownerFor(req),
    id,
    input,
    accessFor(req),
    auditContextFromRequest(req)
  );
  res.json(serializeResponse(result));
});

export const deshacerFacturaController = asyncHandler(async (req, res) => {
  const id = BigInt(idFactura.parse(req.params.id));
  const { version } = versionFacturaSchema.parse(req.body);
  const result = await deshacerFactura(ownerFor(req), id, version, auditContextFromRequest(req));
  res.json(serializeResponse(result));
});

export const registrarAbonoFacturaController = asyncHandler(async (req, res) => {
  const id = BigInt(idFactura.parse(req.params.id));
  const input = abonoFacturaSchema.parse(req.body);
  const result = await registrarAbonoFactura(
    ownerFor(req),
    id,
    input,
    auditContextFromRequest(req)
  );
  res.status(201).json(serializeResponse(result));
});
