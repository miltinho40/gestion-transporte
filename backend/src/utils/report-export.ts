import type { Response } from 'express';
import { strToU8, zipSync } from 'fflate';
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

type ExcelValue = string | number;

const toExcelValue = (value: unknown): ExcelValue => {
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

const xmlDocument = (content: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${content}`;

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnName = (columnNumber: number) => {
  let value = Math.max(1, columnNumber);
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const cellXml = (reference: string, value: ExcelValue, style: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}" t="n"><v>${value}</v></c>`;
  }
  return (
    `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">` +
    `${xmlEscape(String(value))}</t></is></c>`
  );
};

const rowXml = (rowNumber: number, cells: string[], height?: number) =>
  `<row r="${rowNumber}"${height ? ` ht="${height}" customHeight="1"` : ''}>` +
  `${cells.join('')}</row>`;

const contentTypesXml = xmlDocument(
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`
);

const rootRelationshipsXml = xmlDocument(
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`
);

const workbookXml = xmlDocument(
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>`
);

const workbookRelationshipsXml = xmlDocument(
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`
);

const stylesXml = xmlDocument(
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="5">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="16"/><name val="Calibri"/></font>` +
    `<font><i/><color rgb="FF555555"/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FFE5E7EB"/></left>` +
    `<right style="thin"><color rgb="FFE5E7EB"/></right>` +
    `<top style="thin"><color rgb="FFE5E7EB"/></top>` +
    `<bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="6">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
    `<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
);

export const createReportXlsxBuffer = async (table: ReportExportTable) => {
  const columnCount = Math.max(table.columns.length, 1);
  const rows: string[] = [];
  const mergeCells: string[] = [`A1:${columnName(columnCount)}1`];
  rows.push(rowXml(1, [cellXml('A1', table.title, 1)]));
  if (table.subtitle) {
    rows.push(rowXml(2, [cellXml('A2', table.subtitle, 2)]));
    mergeCells.push(`A2:${columnName(columnCount)}2`);
  }
  let rowNumber = table.subtitle ? 4 : 3;

  if (table.summary?.length) {
    for (const item of table.summary) {
      rows.push(
        rowXml(rowNumber, [
          cellXml(`A${rowNumber}`, item.label, 3),
          cellXml(`B${rowNumber}`, toExcelValue(item.value), 5)
        ])
      );
      rowNumber += 1;
    }
    rowNumber += 1;
  }

  const headerRowNumber = rowNumber;
  rows.push(
    rowXml(
      rowNumber,
      table.columns.map((column, index) =>
        cellXml(`${columnName(index + 1)}${rowNumber}`, column.header, 4)
      ),
      20
    )
  );
  rowNumber += 1;

  for (const row of table.rows) {
    rows.push(
      rowXml(
        rowNumber,
        table.columns.map((column, index) =>
          cellXml(
            `${columnName(index + 1)}${rowNumber}`,
            toExcelValue(row[column.key]),
            5
          )
        )
      )
    );
    rowNumber += 1;
  }

  const columns = table.columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`
    )
    .join('');
  const merges = mergeCells.length
    ? `<mergeCells count="${mergeCells.length}">${mergeCells
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join('')}</mergeCells>`
    : '';
  const sheetXml = xmlDocument(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRowNumber}" ` +
      `topLeftCell="A${headerRowNumber + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${columns}</cols><sheetData>${rows.join('')}</sheetData>${merges}</worksheet>`
  );
  const createdAt = new Date().toISOString();
  const archive = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypesXml),
      '_rels/.rels': strToU8(rootRelationshipsXml),
      'docProps/core.xml': strToU8(
        xmlDocument(
          `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
            `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
            `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
            `<dc:creator>gestion-transporte</dc:creator>` +
            `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>` +
            `</cp:coreProperties>`
        )
      ),
      'xl/workbook.xml': strToU8(workbookXml),
      'xl/_rels/workbook.xml.rels': strToU8(workbookRelationshipsXml),
      'xl/styles.xml': strToU8(stylesXml),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml)
    },
    { level: 6 }
  );
  return Buffer.from(archive);
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
