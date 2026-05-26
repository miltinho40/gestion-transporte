import type { NextFunction, Request, Response } from 'express';

const uppercaseFields = new Set([
  'cedula',
  'color',
  'contacto_nombre',
  'descripcion',
  'descripcion_carga',
  'destino',
  'direccion',
  'marca',
  'modelo',
  'nombre',
  'nombre_repuesto',
  'numero_licencia',
  'numeros_guia_remision',
  'observaciones',
  'origen',
  'placa',
  'ruc_cedula',
  'ubicacion'
]);

const toUppercase = (value: string) => value.toLocaleUpperCase('es-EC');

const normalizeValue = (key: string, value: unknown): unknown => {
  if (typeof value === 'string') {
    return uppercaseFields.has(key) ? toUppercase(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string' && uppercaseFields.has(key)) {
        return toUppercase(item);
      }

      return normalizeValue(key, item);
    });
  }

  if (value && typeof value === 'object') {
    return normalizeBody(value as Record<string, unknown>);
  }

  return value;
};

const normalizeBody = (body: Record<string, unknown>) => {
  return Object.entries(body).reduce<Record<string, unknown>>((normalized, [key, value]) => {
    normalized[key] = normalizeValue(key, value);
    return normalized;
  }, {});
};

export const uppercaseInputMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = normalizeBody(req.body as Record<string, unknown>);
  }

  next();
};
