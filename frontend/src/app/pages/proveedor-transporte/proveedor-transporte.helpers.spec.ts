import {
  guiaPreview,
  providerFinancials,
  tarifaLabel,
  weekNumber
} from './proveedor-transporte.helpers';
import { providerPaymentText, providerPaymentImage } from './proveedor-payment-export';
import { providerTripFixture } from './proveedor-transporte.testing';

describe('Proveedor: presentación y exportación', () => {
  it('conserva el cálculo de precio a pagar existente', () => {
    expect(providerFinancials(1000, 3, 10)).toEqual({
      valor_a_facturar: 970,
      precio_pagar_proveedor: 873
    });
    expect(providerFinancials('100.55', 0, 10)).toEqual({
      valor_a_facturar: 100.55,
      precio_pagar_proveedor: 90.5
    });
  });
  it('conserva capacidad, límites de guías y semana de salida', () => {
    const row = providerTripFixture({ numeros_guia_remision: ['123456789012345678901'] });
    expect(tarifaLabel(row.tarifa_ruta)).toContain('7000');
    expect(guiaPreview(row)).toBe('12345678901234567890...');
    expect(weekNumber('2026-11-05')).toBe(45);
    expect(weekNumber(null)).toBe('-');
  });
  it('la leyenda usa precio a pagar, detalle, subtotal y descuento actuales', () => {
    const text = providerPaymentText([providerTripFixture()]);
    expect(text).toContain('SEM | RUTA | DETALLE | GUIA | PRECIO A PAGAR');
    expect(text).toContain('Carga de prueba');
    expect(text).toContain('SUBTOTAL: $ 873.00');
    expect(text).toContain('porcentaje(10.00%): $ 87.30');
    expect(text).toContain('TOTAL: $ 785.70');
  });
  it('genera un PNG no vacío con la tabla', async () => {
    const blob = await providerPaymentImage([providerTripFixture()]);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(1000);
    const bitmap = await createImageBitmap(blob);
    expect(bitmap.width).toBe(1200);
    expect(bitmap.height).toBeGreaterThan(100);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonwhite = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) nonwhite++;
    expect(nonwhite).toBeGreaterThan(1000);
    bitmap.close();
  });
});
