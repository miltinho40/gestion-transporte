import type { CierreSemanal, ViajeCierre } from './weekly-closure.models';
import { vehiculoLabel, viajeEntregaDomingo } from './weekly-closure.helpers';

export function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('No se pudo crear el contexto de imagen.');
  }

  return context;
}

export function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

export function drawTableCell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
) {
  context.fillStyle = fill;
  context.fillRect(x, y, width, height);
  context.strokeStyle = stroke;
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);
}

export function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ['-'];
}

export function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  maxWidth: number,
) {
  lines.forEach((line, index) => {
    context.fillText(truncateCanvasText(context, line, maxWidth), x, y + index * lineHeight);
  });
}

export function truncateCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;

  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];

  if (!base64) {
    throw new Error('No se pudo generar la imagen.');
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: 'image/png' });
}

export async function copyImageToClipboard(blob: Blob) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      return false;
    }

    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function shareImage(blob: Blob, fileName: string, cierre: CierreSemanal) {
  if (!navigator.share || !navigator.canShare) {
    return false;
  }

  const file = new File([blob], fileName, { type: 'image/png' });
  const shareData = {
    files: [file],
    title: `Cierre semanal ${cierre.semana.numero_semana}`,
    text: `Cierre semanal ${cierre.semana.numero_semana} - ${vehiculoLabel(cierre.vehiculo)}`,
  };

  if (!navigator.canShare(shareData)) {
    return false;
  }

  await navigator.share(shareData);
  return true;
}

export function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function weeklyReportFileName(cierre: CierreSemanal) {
  const placa = cierre.vehiculo.placa.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `cierre-semana-${cierre.semana.anio}-${cierre.semana.numero_semana}-${placa || 'vehiculo'}.png`;
}

export function tipoViajeReporte(viaje: ViajeCierre) {
  const domingo = viajeEntregaDomingo(viaje);

  if (viaje.retorno && domingo) return 'Retorno / Domingo';
  if (viaje.retorno) return 'Retorno';
  if (domingo) return 'Domingo';

  return 'Viaje';
}

export function viajeDetalleReporte(viaje: ViajeCierre) {
  return `${viaje.ruta.origen} - ${viaje.ruta.destino}`;
}
