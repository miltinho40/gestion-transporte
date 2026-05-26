import type { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { AppError } from './app-error.js';

export type ReportExportFormat = 'xlsx' | 'pdf';

export interface ReportExportColumn {
  key: string;
  header: string;
  width?: number;
}

export interface ReportExportTable {
  title: string;
  subtitle?: string;
  filenameBase: string;
  columns: ReportExportColumn[];
  rows: Record<string, unknown>[];
  summary?: { label: string; value: unknown }[];
}

const contentTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf'
} satisfies Record<ReportExportFormat, string>;

export const parseReportExportFormat = (value: unknown): ReportExportFormat => {
  if (value === undefined || value === null || value === '') return 'xlsx';
  if (value === 'xlsx' || value === 'pdf') return value;

  throw new AppError('formato debe ser xlsx o pdf', 400);
};

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

const isDecimalLike = (value: unknown): value is { toNumber: () => number; toString: () => string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
};

const toExcelValue = (value: unknown): ExcelJS.CellValue => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dateOnly(value);
  if (typeof value === 'bigint') return value.toString();
  if (isDecimalLike(value)) return value.toNumber();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'si' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' || typeof value === 'number') return value;

  return String(value);
};

const toTextValue = (value: unknown) => {
  const excelValue = toExcelValue(value);

  if (excelValue === null || excelValue === undefined) return '';
  return String(excelValue);
};

export const createReportXlsxBuffer = async (table: ReportExportTable) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'gestion-transporte';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Reporte', {
    views: [{ state: 'frozen', ySplit: table.summary?.length ? 5 : 3 }]
  });
  const columnCount = Math.max(table.columns.length, 1);

  worksheet.mergeCells(1, 1, 1, columnCount);
  worksheet.getCell(1, 1).value = table.title;
  worksheet.getCell(1, 1).font = { bold: true, size: 16 };

  if (table.subtitle) {
    worksheet.mergeCells(2, 1, 2, columnCount);
    worksheet.getCell(2, 1).value = table.subtitle;
    worksheet.getCell(2, 1).font = { italic: true, color: { argb: 'FF555555' } };
  }

  let rowNumber = table.subtitle ? 4 : 3;

  if (table.summary?.length) {
    for (const item of table.summary) {
      worksheet.getCell(rowNumber, 1).value = item.label;
      worksheet.getCell(rowNumber, 1).font = { bold: true };
      worksheet.getCell(rowNumber, 2).value = toExcelValue(item.value);
      rowNumber += 1;
    }

    rowNumber += 1;
  }

  const headerRow = worksheet.getRow(rowNumber);
  table.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' }
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  headerRow.height = 20;

  for (const row of table.rows) {
    const excelRow = worksheet.addRow(
      table.columns.map((column) => toExcelValue(row[column.key]))
    );
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  }

  table.columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width ?? 18;
  });

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const createReportPdfBuffer = async (table: ReportExportTable) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const chunks: Buffer[] = [];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const weights = table.columns.map((column) => column.width ?? 18);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const widths = weights.map((weight) => (weight / totalWeight) * pageWidth);
  const widthAt = (index: number) => widths[index] ?? 20;
  const startX = doc.page.margins.left;
  let y = doc.page.margins.top;

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const addPageIfNeeded = (height: number) => {
    if (y + height <= doc.page.height - doc.page.margins.bottom) return;

    doc.addPage();
    y = doc.page.margins.top;
    drawHeader();
  };

  const drawHeader = () => {
    doc.fontSize(8).font('Helvetica-Bold');
    let x = startX;
    const headerHeight = 22;

    for (const [index, column] of table.columns.entries()) {
      const columnWidth = widthAt(index);
      doc.rect(x, y, columnWidth, headerHeight).fillAndStroke('#1f2937', '#1f2937');
      doc
        .fillColor('#ffffff')
        .text(column.header, x + 3, y + 6, {
          width: columnWidth - 6,
          height: headerHeight - 8,
          ellipsis: true
        });
      x += columnWidth;
    }

    y += headerHeight;
    doc.fillColor('#111827').font('Helvetica');
  };

  doc.fontSize(15).font('Helvetica-Bold').text(table.title, startX, y);
  y += 20;

  if (table.subtitle) {
    doc.fontSize(9).font('Helvetica').fillColor('#4b5563').text(table.subtitle, startX, y);
    y += 16;
  }

  if (table.summary?.length) {
    doc.fontSize(8).fillColor('#111827');
    for (const item of table.summary) {
      doc.font('Helvetica-Bold').text(`${item.label}:`, startX, y, { continued: true });
      doc.font('Helvetica').text(` ${toTextValue(item.value)}`);
      y += 11;
    }
    y += 6;
  }

  drawHeader();

  doc.fontSize(7).font('Helvetica');

  for (const row of table.rows) {
    const values = table.columns.map((column) => toTextValue(row[column.key]));
    const rowHeight = Math.min(
      54,
      Math.max(
        18,
        ...values.map((value, index) =>
          doc.heightOfString(value, { width: widthAt(index) - 6 }) + 8
        )
      )
    );

    addPageIfNeeded(rowHeight);

    let x = startX;
    for (const [index, value] of values.entries()) {
      const columnWidth = widthAt(index);
      doc.rect(x, y, columnWidth, rowHeight).stroke('#d1d5db');
      doc.fillColor('#111827').text(value, x + 3, y + 4, {
        width: columnWidth - 6,
        height: rowHeight - 8,
        ellipsis: true
      });
      x += columnWidth;
    }

    y += rowHeight;
  }

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

export const sendReportExport = async (
  res: Response,
  format: ReportExportFormat,
  table: ReportExportTable
) => {
  const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
  const filename = `${table.filenameBase}.${extension}`;
  const buffer =
    format === 'xlsx' ? await createReportXlsxBuffer(table) : await createReportPdfBuffer(table);

  res.setHeader('Content-Type', contentTypes[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
};
