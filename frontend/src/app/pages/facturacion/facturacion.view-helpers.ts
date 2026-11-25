import type {
  BillingGroup,
  Invoice,
  InvoiceGroup,
  ModalidadComision,
  Preview,
  Trip
} from './facturacion.models';

export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
export const money = (value: unknown) => Number(value ?? 0).toFixed(2);
export const key = (trip: Trip) => `${trip.tipo}:${trip.id}`;
export const guides = (trip: Trip) => trip.guias.join(', ');
export const shortGuides = (trip: Trip, limit = 10) => {
  const text = guides(trip);
  return text.length > limit ? text.slice(0, limit) + '...' : text || '-';
};
export const groupName = (trip: Trip) =>
  trip.tipo === 'propio'
    ? `Placa ${trip.placa ?? 'sin identificar'}`
    : `Proveedor: ${trip.proveedor ?? 'sin identificar'}`;
const groupKey = (trip: Trip) =>
  trip.tipo === 'propio'
    ? `placa:${trip.placa}`
    : `proveedor:${trip.proveedor_id ?? trip.proveedor}`;
export const modalidadName = (value: ModalidadComision) =>
  value === 'EN_FACTURA' ? 'Descontar en factura' : 'Descontar al pagar';
export const week = (fecha: string) => {
  const date = new Date(fecha.slice(0, 10) + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return Math.ceil(((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
export const selectionState = (trips: Trip[], selected: ReadonlySet<string>) => {
  const count = trips.filter((trip) => selected.has(key(trip))).length;
  return { all: count > 0 && count === trips.length, partial: count > 0 && count < trips.length };
};
export const orderedBillingRows = (trips: Trip[]) =>
  trips
    .map((trip, index) => ({ trip, index }))
    .sort(
      (a, b) =>
        a.trip.tipo.localeCompare(b.trip.tipo) ||
        groupName(a.trip).localeCompare(groupName(b.trip), 'es') ||
        b.trip.fecha.localeCompare(a.trip.fecha) ||
        b.trip.id.localeCompare(a.trip.id, undefined, { numeric: true })
    );
export const preparationGroups = (trips: Trip[], preview: Preview | null): BillingGroup[] => {
  const groups = new Map<string, BillingGroup>();
  for (const row of orderedBillingRows(trips)) {
    const id = groupKey(row.trip);
    if (!groups.has(id))
      groups.set(id, { key: id, label: groupName(row.trip), rows: [], total: preview ? 0 : null });
    const group = groups.get(id)!;
    group.rows.push(row);
    if (preview) group.total! += Math.round(Number(preview.detalles[row.index].a_facturar) * 100);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    total: group.total === null ? null : group.total / 100
  }));
};
export const invoiceGroups = (invoice: Invoice | null): InvoiceGroup[] => {
  if (!invoice?.viajes) return [];
  const groups = new Map<string, InvoiceGroup>();
  invoice.viajes.forEach((trip, index) => {
    const id = groupKey(trip);
    if (!groups.has(id)) groups.set(id, { key: id, label: groupName(trip), rows: [], total: 0 });
    const group = groups.get(id)!,
      amounts = invoice.detalles[index];
    group.rows.push({ trip, amounts });
    group.total += Math.round(Number(amounts.a_facturar) * 100);
  });
  return [...groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .map((group) => ({ ...group, total: group.total / 100 }));
};
