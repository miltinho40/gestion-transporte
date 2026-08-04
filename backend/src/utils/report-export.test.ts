import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { createReportXlsxBuffer } from './report-export.js';

describe('exportación XLSX', () => {
  it('genera un libro válido con encabezados, resumen y datos', async () => {
    const buffer = await createReportXlsxBuffer({
      title: 'Reporte de viajes',
      subtitle: 'Semana 26',
      filenameBase: 'viajes',
      columns: [
        { key: 'ruta', header: 'Ruta', width: 24 },
        { key: 'valor', header: 'Valor', width: 14 }
      ],
      rows: [
        { ruta: 'MACHALA & VINCES', valor: 125.5 },
        { ruta: 'MACHALA < DURÁN', valor: 90 }
      ],
      summary: [{ label: 'Total', value: 215.5 }]
    });

    assert.equal(buffer.subarray(0, 2).toString(), 'PK');
    const files = unzipSync(buffer);
    assert.ok(files['[Content_Types].xml']);
    assert.ok(files['xl/workbook.xml']);
    assert.ok(files['xl/styles.xml']);
    assert.ok(files['xl/worksheets/sheet1.xml']);

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    assert.match(sheet, /Reporte de viajes/);
    assert.match(sheet, /MACHALA &amp; VINCES/);
    assert.match(sheet, /MACHALA &lt; DURÁN/);
    assert.match(sheet, /<v>125\.5<\/v>/);
    assert.match(sheet, /state="frozen"/);
  });
});
