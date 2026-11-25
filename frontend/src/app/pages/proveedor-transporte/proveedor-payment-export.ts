import type { ViajeProveedorRow } from './proveedor-transporte.models';
import {
  money,
  number,
  rutaLabel,
  todayInputDate,
  weekNumber
} from './proveedor-transporte.helpers';

export const providerPaymentText = (rows: ViajeProveedorRow[]) => {
  const first = rows[0]!;
  const subtotal = rows.reduce((total, row) => total + number(row.precio_pagar_proveedor), 0);
  const porcentaje = number(first.proveedor.porcentaje_utilidad);
  const porcentajeValor = subtotal * (porcentaje / 100);
  const total = subtotal - porcentajeValor;
  const fechaActual = todayInputDate();
  const detail = rows
    .map((row) =>
      [
        weekNumber(row.fecha_salida),
        rutaLabel(row),
        row.descripcion_carga || '-',
        row.numeros_guia_remision.join(', ') || '-',
        `$ ${money(row.precio_pagar_proveedor)}`
      ].join(' | ')
    )
    .join('\n');

  return [
    `${first.proveedor.nombre}     ${fechaActual}`,
    'SEM | RUTA | DETALLE | GUIA | PRECIO A PAGAR',
    detail,
    `SUBTOTAL: $ ${money(subtotal)}`,
    `porcentaje(${money(porcentaje)}%): $ ${money(porcentajeValor)}`,
    `TOTAL: $ ${money(total)}`
  ].join('\n');
};

export const providerPaymentImage = async (rows: ViajeProveedorRow[]) => {
  const first = rows[0]!;
  const subtotal = rows.reduce((total, row) => total + number(row.precio_pagar_proveedor), 0);
  const porcentaje = number(first.proveedor.porcentaje_utilidad);
  const porcentajeValor = subtotal * (porcentaje / 100);
  const total = subtotal - porcentajeValor;
  const fechaActual = todayInputDate();
  const width = 1200;
  const padding = 28;
  const lineHeight = 22;
  const columns = {
    sem: 58,
    ruta: 300,
    detalle: 270,
    guia: 320,
    precio: 160
  };
  const bodyFont = '16px Arial, sans-serif';
  const headerFont = '700 16px Arial, sans-serif';
  const titleFont = '800 26px Arial, sans-serif';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo generar la imagen.');

  const wrap = (text: string, maxWidth: number, font = bodyFont) => {
    ctx.font = font;
    const words = String(text || '-').split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !current) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines;
  };

  const preparedRows = rows.map((row) => {
    const rutaLines = wrap(rutaLabel(row), columns.ruta - 16);
    const detalleLines = wrap(row.descripcion_carga || '-', columns.detalle - 16);
    const guiaLines = wrap(row.numeros_guia_remision.join(', ') || '-', columns.guia - 16);
    return {
      sem: String(weekNumber(row.fecha_salida)),
      rutaLines,
      detalleLines,
      guiaLines,
      precio: `$ ${money(row.precio_pagar_proveedor)}`,
      height: Math.max(rutaLines.length, detalleLines.length, guiaLines.length, 1) * lineHeight + 18
    };
  });
  const tableHeight = 38 + preparedRows.reduce((height, row) => height + row.height, 0);
  const summaryHeight = 112;
  const height = padding * 2 + 42 + 18 + tableHeight + summaryHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.font = titleFont;
  ctx.fillText(first.proveedor.nombre.toUpperCase(), padding, padding + 26);
  ctx.font = headerFont;
  const dateText = fechaActual;
  ctx.fillText(dateText, width - padding - ctx.measureText(dateText).width, padding + 26);

  let y = padding + 62;
  const xSem = padding;
  const xRuta = xSem + columns.sem;
  const xDetalle = xRuta + columns.ruta;
  const xGuia = xDetalle + columns.detalle;
  const xPrecio = xGuia + columns.guia;

  ctx.fillStyle = '#e2f3fb';
  ctx.fillRect(padding - 10, y - 24, width - padding * 2 + 20, 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = headerFont;
  ctx.fillText('SEM', xSem, y);
  ctx.fillText('RUTA', xRuta, y);
  ctx.fillText('DETALLE', xDetalle, y);
  ctx.fillText('GUIA', xGuia, y);
  ctx.fillText('PRECIO A PAGAR', xPrecio, y);
  y += 24;

  ctx.font = bodyFont;
  for (const row of preparedRows) {
    ctx.strokeStyle = '#d9e2ec';
    ctx.beginPath();
    ctx.moveTo(padding - 10, y - 12);
    ctx.lineTo(width - padding + 10, y - 12);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillText(row.sem, xSem, y + 6);
    row.rutaLines.forEach((line, index) => ctx.fillText(line, xRuta, y + 6 + index * lineHeight));
    row.detalleLines.forEach((line, index) =>
      ctx.fillText(line, xDetalle, y + 6 + index * lineHeight)
    );
    row.guiaLines.forEach((line, index) => ctx.fillText(line, xGuia, y + 6 + index * lineHeight));
    ctx.fillText(row.precio, xPrecio, y + 6);
    y += row.height;
  }

  y += 18;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(padding - 10, y - 18, width - padding * 2 + 20, summaryHeight - 10);
  ctx.font = headerFont;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`SUBTOTAL: $ ${money(subtotal)}`, padding, y + 10);
  ctx.fillText(`porcentaje(${money(porcentaje)}%): $ ${money(porcentajeValor)}`, padding, y + 42);
  ctx.fillStyle = '#065f46';
  ctx.font = '800 22px Arial, sans-serif';
  ctx.fillText(`TOTAL: $ ${money(total)}`, padding, y + 78);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))),
      'image/png'
    );
  });
};

export const copyTextFallback = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};
