import type { CierreSemanal } from './weekly-closure.models';
import {
  dateSortValue,
  fechaSemanaViaje,
  dateOnly,
  vehiculoLabel,
  transportistaLabel,
  money,
  totalSueldoSemanal,
  totalBonos,
  cantidadRetornos,
  totalGastoRetornoRetornos,
  cantidadDomingos,
  totalGastoRetornoDomingos,
  totalSemanaReporte,
  totalPrecioViajes,
} from './weekly-closure.helpers';
import {
  getCanvasContext,
  wrapCanvasText,
  viajeDetalleReporte,
  drawRoundedRect,
  drawTableCell,
  tipoViajeReporte,
  drawWrappedCanvasText,
  canvasToPngBlob,
} from './weekly-closure-image';

export function createWeeklyReportImage(cierre: CierreSemanal) {
  const width = 1080;
  const scale = 2;
  const padding = 44;
  const tableWidth = width - padding * 2;
  const colFecha = 126;
  const colTipo = 150;
  const colPrecio = 168;
  const colDetalle = tableWidth - colFecha - colTipo - colPrecio;
  const tableColumns = [
    { label: 'Fecha', width: colFecha },
    { label: 'Tipo', width: colTipo },
    { label: 'Detalle', width: colDetalle },
    { label: 'Precio de viaje', width: colPrecio },
  ];

  const viajes = [...(cierre.viajes ?? [])].sort(
    (left, right) => dateSortValue(fechaSemanaViaje(left)) - dateSortValue(fechaSemanaViaje(right)),
  );
  const measureCanvas = document.createElement('canvas');
  const measureContext = getCanvasContext(measureCanvas);
  measureContext.font = '24px Inter, Arial, sans-serif';

  const rows = viajes.map((viaje) => {
    const detailLines = wrapCanvasText(measureContext, viajeDetalleReporte(viaje), colDetalle - 24);

    return {
      viaje,
      detailLines,
      height: Math.max(48, detailLines.length * 24 + 22),
    };
  });

  const headerHeight = 104;
  const summaryHeight = 200;
  const sectionTitleHeight = 42;
  const tableHeaderHeight = 44;
  const emptyHeight = viajes.length ? 0 : 58;
  const totalHeight = 56;
  const tableRowsHeight = rows.reduce((total, row) => total + row.height, 0) + emptyHeight;
  const height =
    padding * 2 +
    headerHeight +
    28 +
    summaryHeight +
    34 +
    sectionTitleHeight +
    tableHeaderHeight +
    tableRowsHeight +
    totalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = getCanvasContext(canvas);
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  drawRoundedRect(context, 16, 16, width - 32, height - 32, 18, '#ffffff', '#d9e0e8');
  drawRoundedRect(context, padding, padding, tableWidth, headerHeight, 12, '#17324d');

  context.fillStyle = '#ffffff';
  context.textBaseline = 'alphabetic';
  context.font = '700 30px Inter, Arial, sans-serif';
  context.fillText(
    `Cierre semanal - Semana ${cierre.semana.numero_semana}`,
    padding + 24,
    padding + 42,
  );
  context.font = '500 17px Inter, Arial, sans-serif';
  context.fillText(
    `${dateOnly(cierre.semana.fecha_inicio)} - ${dateOnly(cierre.semana.fecha_fin)}`,
    padding + 24,
    padding + 72,
  );
  context.textAlign = 'right';
  context.fillText(vehiculoLabel(cierre.vehiculo), padding + tableWidth - 24, padding + 42);
  context.fillText(transportistaLabel(cierre), padding + tableWidth - 24, padding + 72);
  context.textAlign = 'left';

  let y = padding + headerHeight + 28;
  drawRoundedRect(context, padding, y, tableWidth, summaryHeight, 10, '#f8fafc', '#d9e0e8');
  const summaryRows = [
    ['Sueldo semanal:', `$ ${money(totalSueldoSemanal(cierre))}`],
    ['Bono:', `$ ${money(totalBonos(cierre))}`],
    [
      'Retornos:',
      `${cantidadRetornos(cierre)} viajes ($ ${money(totalGastoRetornoRetornos(cierre))})`,
    ],
    [
      'Viajes domingo:',
      `${cantidadDomingos(cierre)} viajes ($ ${money(totalGastoRetornoDomingos(cierre))})`,
    ],
    ['Total semana:', `$ ${money(totalSemanaReporte(cierre))}`],
  ];

  const summaryX = padding + 24;
  const summaryValueX = padding + tableWidth - 24;
  const summaryRowHeight = 34;
  let summaryY = y + 38;
  summaryRows.forEach(([label, value], index) => {
    const isTotal = index === summaryRows.length - 1;

    if (isTotal) {
      drawRoundedRect(
        context,
        padding + 14,
        summaryY - 25,
        tableWidth - 28,
        summaryRowHeight + 14,
        8,
        '#e7f6ec',
        '#b7dfc4',
      );
    }

    context.fillStyle = isTotal ? '#0f5132' : '#344054';
    context.font = `${isTotal ? '700' : '600'} 22px Inter, Arial, sans-serif`;
    context.fillText(label, summaryX, summaryY);
    context.textAlign = 'right';
    context.fillText(value, summaryValueX, summaryY);
    context.textAlign = 'left';
    summaryY += summaryRowHeight;
  });

  y += summaryHeight + 34;
  context.fillStyle = '#182230';
  context.font = '700 24px Inter, Arial, sans-serif';
  context.fillText('Viajes semanales', padding, y + 28);
  y += sectionTitleHeight;

  let x = padding;
  context.font = '700 15px Inter, Arial, sans-serif';
  tableColumns.forEach((column) => {
    drawTableCell(context, x, y, column.width, tableHeaderHeight, '#eef4ff', '#cbd5e1');
    context.fillStyle = '#344054';
    context.fillText(column.label, x + 12, y + 28);
    x += column.width;
  });
  y += tableHeaderHeight;

  if (!rows.length) {
    drawTableCell(context, padding, y, tableWidth, emptyHeight, '#ffffff', '#d9e0e8');
    context.fillStyle = '#667085';
    context.font = '500 18px Inter, Arial, sans-serif';
    context.fillText('Sin viajes registrados en esta semana.', padding + 18, y + 36);
    y += emptyHeight;
  }

  rows.forEach((row, index) => {
    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    let cellX = padding;

    drawTableCell(context, cellX, y, colFecha, row.height, rowBg, '#d9e0e8');
    context.fillStyle = '#182230';
    context.font = '500 17px Inter, Arial, sans-serif';
    context.fillText(dateOnly(fechaSemanaViaje(row.viaje)), cellX + 12, y + 30);
    cellX += colFecha;

    drawTableCell(context, cellX, y, colTipo, row.height, rowBg, '#d9e0e8');
    context.fillStyle = '#0f766e';
    context.font = '700 16px Inter, Arial, sans-serif';
    context.fillText(tipoViajeReporte(row.viaje), cellX + 12, y + 30);
    cellX += colTipo;

    drawTableCell(context, cellX, y, colDetalle, row.height, rowBg, '#d9e0e8');
    context.fillStyle = '#182230';
    context.font = '500 17px Inter, Arial, sans-serif';
    drawWrappedCanvasText(context, row.detailLines, cellX + 12, y + 28, 24, colDetalle - 24);
    cellX += colDetalle;

    drawTableCell(context, cellX, y, colPrecio, row.height, rowBg, '#d9e0e8');
    context.fillStyle = '#182230';
    context.font = '700 17px Inter, Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(`$ ${money(row.viaje.precio_flete)}`, cellX + colPrecio - 12, y + 30);
    context.textAlign = 'left';

    y += row.height;
  });

  drawRoundedRect(context, padding, y, tableWidth, totalHeight, 0, '#e7f6ec', '#b7dfc4');
  context.fillStyle = '#0f5132';
  context.font = '700 21px Inter, Arial, sans-serif';
  context.fillText('Total viajes', padding + 18, y + 35);
  context.textAlign = 'right';
  context.fillText(`$ ${money(totalPrecioViajes(cierre))}`, padding + tableWidth - 18, y + 35);
  context.textAlign = 'left';

  return canvasToPngBlob(canvas);
}
