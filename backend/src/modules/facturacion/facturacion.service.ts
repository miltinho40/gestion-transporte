import { EstadoViaje, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditEvent, type AuditContext } from '../../utils/audit.js';
import { rutaDeTarifa } from '../tarifas-ruta/ruta-tarifa.js';
import { calcularFacturacion } from './facturacion.calculo.js';
import {
  facturaSchema,
  type FacturaInput,
  type CrearFacturaInput,
  type ConfiguracionFacturaInput,
  type CerrarFacturaInput,
  type ListadoFacturasInput,
  type AbonoFacturaInput
} from './facturacion.schema.js';
import { semanaFacturacion, type ViajesFacturacionFilters } from './facturacion.filters.js';

export interface FacturacionAccess {
  own: boolean;
  external: boolean;
}

const include = {
  destinatario: true,
  detalles: true,
  abonos: { orderBy: { fecha: 'asc' as const } }
};
const sum = (values: Prisma.Decimal[]) => values.reduce((a, b) => a.add(b), new Prisma.Decimal(0));
const checkClients = async (owner: bigint, ids: bigint[]) => {
  const unique = [...new Set(ids)];
  if (
    (await prisma.cliente.count({
      where: { propietario_id: owner, id: { in: unique }, activo: true }
    })) !== unique.length
  )
    throw new AppError('Cliente no disponible para este propietario', 400);
};

const prepare = async (
  tx: Prisma.TransactionClient,
  owner: bigint,
  input: FacturaInput,
  access: FacturacionAccess,
  draftId?: bigint
) => {
  const destinatario = await tx.cliente.findFirst({
    where: { id: BigInt(input.destinatario_id), propietario_id: owner, activo: true }
  });
  if (!destinatario) throw new AppError('Destinatario no disponible', 400);
  const detalles = [];
  for (const item of input.detalles) {
    if (item.tipo === 'propio' ? !access.own : !access.external)
      throw new AppError('No tienes acceso a estos viajes', 403);
    const where = { id: BigInt(item.id), propietario_id: owner };
    const related = {
      cliente: true,
      tarifa_ruta: { include: { ruta: true } },
      detalle_factura: true
    };
    const v =
      item.tipo === 'propio'
        ? await tx.viaje.findFirst({ where, include: related })
        : await tx.viajeProveedor.findFirst({ where, include: related });
    if (
      !v ||
      v.cobrado ||
      v.estado === EstadoViaje.CANCELADO ||
      (v.detalle_factura && v.detalle_factura.factura_id !== draftId)
    )
      throw new AppError(
        'Un viaje ya está reservado, facturado, cobrado, cancelado o no pertenece al propietario. Actualiza la selección.',
        409
      );
    const directo = v.cliente_id === destinatario.id;
    const calculo = calcularFacturacion(
      'precio_flete' in v ? v.precio_flete : v.precio_viaje,
      item.comision_cliente,
      item.ir_cliente,
      input.comision_empresa,
      input.ir_empresa,
      directo,
      input.modalidad_comision
    );
    if (calculo.neto.lt(0)) throw new AppError('Los descuentos superan el precio del viaje', 400);
    detalles.push({
      viaje_id: item.tipo === 'propio' ? v.id : null,
      viaje_proveedor_id: item.tipo === 'proveedor' ? v.id : null,
      cliente_nombre: v.cliente.nombre,
      ruta: `${rutaDeTarifa(v.tarifa_ruta).origen} - ${rutaDeTarifa(v.tarifa_ruta).destino}`,
      comision_cliente: directo ? 0 : item.comision_cliente,
      ir_cliente: !directo && item.ir_cliente,
      ...calculo
    });
  }
  return {
    detalles,
    total_facturar: sum(detalles.map((d) => d.a_facturar)),
    total_comision: sum(detalles.map((d) => d.comision_empresa)),
    total_ir: sum(detalles.map((d) => d.ir_empresa)),
    neto: sum(detalles.map((d) => d.neto))
  };
};

export const getConfiguracionFacturacion = async (owner: bigint) => {
  const clientes = await prisma.cliente.findMany({
    where: { propietario_id: owner, activo: true },
    include: { configuracion_facturacion: true },
    orderBy: { nombre: 'asc' }
  });
  return clientes.map((c) => ({
    ...c,
    configuracion_facturacion: {
      ...(c.configuracion_facturacion ?? {
        destinatario_id: null,
        ir_cliente: false,
        ir_empresa: true,
        modalidad_comision: /TRANSPALFRA/i.test(c.nombre) ? 'EN_FACTURA' : 'AL_PAGAR'
      }),
      comision_cliente: c.porcentaje_comision,
      comision_empresa: c.porcentaje_comision
    }
  }));
};

export const updateConfiguracionFacturacion = async (
  owner: bigint,
  p: ConfiguracionFacturaInput,
  audit?: AuditContext
) => {
  await checkClients(owner, [
    BigInt(p.cliente_id),
    ...(p.destinatario_id ? [BigInt(p.destinatario_id)] : [])
  ]);
  const { porcentaje_comision, ...config } = p;
  const data = {
    ...config,
    propietario_id: owner,
    cliente_id: BigInt(p.cliente_id),
    destinatario_id: p.destinatario_id ? BigInt(p.destinatario_id) : null
  };
  const saved = await prisma.$transaction(async (tx) => {
    await tx.cliente.update({
      where: { id: data.cliente_id, propietario_id: owner },
      data: { porcentaje_comision }
    });
    return tx.configuracionFacturacion.upsert({
      where: { cliente_id: data.cliente_id },
      create: data,
      update: data
    });
  });
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: saved.id,
    accion: 'configurar',
    despues: saved
  });
  return { ...saved, comision_cliente: porcentaje_comision, comision_empresa: porcentaje_comision };
};

export const listViajesFacturacion = async (
  owner: bigint,
  filters: ViajesFacturacionFilters,
  access: FacturacionAccess
) => {
  const common = {
    propietario_id: owner,
    cobrado: false,
    estado: { not: EstadoViaje.CANCELADO },
    detalle_factura: null,
    ...(filters.cliente_ids.length ? { cliente_id: { in: filters.cliente_ids.map(BigInt) } } : {}),
    ...(filters.desde || filters.hasta
      ? {
          fecha_salida: {
            gte: filters.desde ? new Date(filters.desde) : undefined,
            lte: filters.hasta ? new Date(filters.hasta) : undefined
          }
        }
      : {})
  };
  const related = {
    cliente: { include: { configuracion_facturacion: true } },
    tarifa_ruta: { include: { ruta: true } }
  };
  const [own, external] = await Promise.all([
    access.own
      ? prisma.viaje.findMany({
          where: {
            ...common,
            ...(filters.vehiculo_ids.length
              ? { vehiculo_id: { in: filters.vehiculo_ids.map(BigInt) } }
              : {})
          },
          include: { ...related, vehiculo: { select: { placa: true } } }
        })
      : [],
    !filters.vehiculo_ids.length && filters.solo_propios !== 'true' && access.external
      ? prisma.viajeProveedor.findMany({
          where: common,
          include: { ...related, proveedor: { select: { id: true, nombre: true } } }
        })
      : []
  ]);
  const rows = [
    ...own.map((v) => ({
      ...v,
      tipo: 'propio',
      precio: v.precio_flete,
      placa: v.vehiculo.placa,
      proveedor_id: null,
      proveedor_nombre: null
    })),
    ...external.map((v) => ({
      ...v,
      tipo: 'proveedor',
      precio: v.precio_viaje,
      placa: null,
      proveedor_nombre: v.proveedor.nombre
    }))
  ]
    .map((v) => ({
      id: v.id,
      tipo: v.tipo,
      cliente_id: v.cliente_id,
      cliente: v.cliente.nombre,
      fecha: v.fecha_salida,
      placa: v.placa,
      guias: v.numeros_guia_remision,
      ruta: `${rutaDeTarifa(v.tarifa_ruta).origen} - ${rutaDeTarifa(v.tarifa_ruta).destino}`,
      precio: v.precio,
      destino: rutaDeTarifa(v.tarifa_ruta).destino,
      proveedor_id: v.proveedor_id,
      proveedor: v.proveedor_nombre,
      destinatario_id:
        v.facturar_a_id ?? v.cliente.configuracion_facturacion?.destinatario_id ?? v.cliente_id,
      comision_cliente: v.cliente.porcentaje_comision,
      ir_cliente: v.cliente.configuracion_facturacion?.ir_cliente ?? false,
      anterior: true
    }))
    .filter(
      (v) => !filters.destinatario_id || String(v.destinatario_id) === filters.destinatario_id
    )
    .filter((v) => !filters.semanas.length || filters.semanas.includes(semanaFacturacion(v.fecha)))
    .filter(
      (v) =>
        !filters.search ||
        `${v.cliente} ${v.ruta} ${v.placa ?? ''} ${v.guias.join(' ')}`
          .toLocaleLowerCase()
          .includes(filters.search.toLocaleLowerCase())
    )
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || Number(b.id - a.id));
  return {
    items: rows.slice((filters.page - 1) * filters.limit, filters.page * filters.limit),
    total: rows.length,
    page: filters.page,
    limit: filters.limit
  };
};

export const previsualizarFactura = async (
  owner: bigint,
  data: FacturaInput,
  access: FacturacionAccess,
  draftId?: bigint
) => {
  const preview = await prisma.$transaction(async (tx) => {
    if (
      draftId &&
      !(await tx.facturaTransporte.findFirst({
        where: {
          id: draftId,
          propietario_id: owner,
          destinatario_id: BigInt(data.destinatario_id),
          estado: 'PREPARACION'
        }
      }))
    )
      throw new AppError('Factura en preparación no disponible', 409);
    return prepare(tx, owner, data, access, draftId);
  });
  return preview;
};

export const crearFactura = async (
  owner: bigint,
  data: CrearFacturaInput,
  access: FacturacionAccess,
  audit?: AuditContext
) => {
  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${owner})::text`;
      const prepared = await prepare(tx, owner, data, access);
      if (
        !prepared.neto.eq(data.neto_confirmado) ||
        !prepared.total_facturar.eq(data.total_facturar_confirmado)
      )
        throw new AppError(
          'Los valores cambiaron. Revisa nuevamente el cálculo antes de confirmar.',
          409
        );
      if (prepared.neto.lte(0))
        throw new AppError('La factura debe tener un neto a recibir mayor que cero', 400);
      if (
        await tx.facturaTransporte.findUnique({
          where: { propietario_id_numero: { propietario_id: owner, numero: data.numero } }
        })
      )
        throw new AppError('Ya existe una factura con ese número', 409);
      const { detalles, ...totals } = prepared;
      const factura = await tx.facturaTransporte.create({
        data: {
          propietario_id: owner,
          destinatario_id: BigInt(data.destinatario_id),
          numero: data.numero,
          fecha: new Date(data.fecha),
          comision_empresa: data.comision_empresa,
          ir_empresa: data.ir_empresa,
          modalidad_comision: data.modalidad_comision,
          ...totals,
          detalles: { create: detalles }
        },
        include
      });
      for (const detalle of detalles) {
        if (detalle.viaje_id) {
          await tx.viaje.update({
            where: { id: detalle.viaje_id },
            data: { precio_real_flete: detalle.a_facturar }
          });
        } else if (detalle.viaje_proveedor_id) {
          const viaje = await tx.viajeProveedor.findUniqueOrThrow({
            where: { id: detalle.viaje_proveedor_id }
          });
          await tx.viajeProveedor.update({
            where: { id: viaje.id },
            data: {
              valor_a_facturar: detalle.a_facturar,
              utilidad: detalle.neto.minus(viaje.precio_pagar_proveedor).minus(viaje.viaticos)
            }
          });
        }
      }
      return factura;
    },
    { timeout: 20000 }
  );
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: saved.id,
    accion: 'crear',
    despues: saved
  });
  return saved;
};

export const listFacturas = async (owner: bigint, query: ListadoFacturasInput) => {
  const where = {
    propietario_id: owner,
    ...(query.search
      ? {
          OR: [
            { numero: { contains: query.search, mode: 'insensitive' as const } },
            { destinatario: { nombre: { contains: query.search, mode: 'insensitive' as const } } }
          ]
        }
      : {})
  };
  const [items, total] = await Promise.all([
    prisma.facturaTransporte.findMany({
      where,
      include,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * 25,
      take: 25
    }),
    prisma.facturaTransporte.count({ where })
  ]);
  return {
    items: items.map((f) => ({
      ...f,
      recibido: sum(f.abonos.map((a) => a.monto)),
      saldo: f.neto.minus(sum(f.abonos.map((a) => a.monto)))
    })),
    total,
    page: query.page
  };
};

export const listBorradoresFactura = async (owner: bigint, destinatario: bigint) => {
  const items = await prisma.facturaTransporte.findMany({
    where: { propietario_id: owner, destinatario_id: destinatario, estado: 'PREPARACION' },
    orderBy: { id: 'desc' },
    select: { id: true, numero: true, fecha: true, version: true }
  });
  return items;
};

export const getFactura = async (owner: bigint, id: bigint) => {
  const invoice = await prisma.facturaTransporte.findFirst({
    where: { id: id, propietario_id: owner },
    include
  });
  if (!invoice) throw new AppError('Factura no encontrada', 404);
  const viajes = [];
  for (const d of invoice.detalles) {
    const related = { cliente: true, tarifa_ruta: { include: { ruta: true } } };
    const v = d.viaje_id
      ? await prisma.viaje.findFirst({
          where: { id: d.viaje_id, propietario_id: invoice.propietario_id },
          include: { ...related, vehiculo: true }
        })
      : await prisma.viajeProveedor.findFirst({
          where: { id: d.viaje_proveedor_id!, propietario_id: invoice.propietario_id },
          include: { ...related, proveedor: true }
        });
    if (!v) throw new AppError('No se encontró un viaje reservado', 409);
    viajes.push({
      id: v.id,
      tipo: d.viaje_id ? 'propio' : 'proveedor',
      cliente_id: v.cliente_id,
      cliente: v.cliente.nombre,
      fecha: v.fecha_salida,
      placa: 'vehiculo' in v ? v.vehiculo.placa : null,
      ruta: d.ruta,
      destino: rutaDeTarifa(v.tarifa_ruta).destino,
      proveedor_id: 'proveedor' in v ? v.proveedor.id : null,
      proveedor: 'proveedor' in v ? v.proveedor.nombre : null,
      guias: v.numeros_guia_remision,
      precio: 'precio_flete' in v ? v.precio_flete : v.precio_viaje,
      comision_cliente: d.comision_cliente,
      ir_cliente: d.ir_cliente,
      destinatario_id: invoice.destinatario_id
    });
  }
  return {
    ...invoice,
    viajes,
    recibido: sum(invoice.abonos.map((a) => a.monto)),
    saldo: invoice.neto.minus(sum(invoice.abonos.map((a) => a.monto)))
  };
};

export const guardarBorradorFactura = async (
  owner: bigint,
  data: FacturaInput,
  draftNumber: string | null | undefined,
  access: FacturacionAccess,
  version: number,
  draftId?: bigint,
  audit?: AuditContext
) => {
  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${owner})::text`;
      if (draftId) {
        const current = await tx.facturaTransporte.findFirst({
          where: {
            id: draftId,
            propietario_id: owner,
            estado: 'PREPARACION',
            destinatario_id: BigInt(data.destinatario_id),
            version
          }
        });
        if (!current)
          throw new AppError('La factura cambió o ya fue cerrada. Vuelve a abrirla.', 409);
      }
      const prepared = await prepare(tx, owner, data, access, draftId);
      const numero = draftNumber || null;
      if (
        numero &&
        (await tx.facturaTransporte.findFirst({
          where: { propietario_id: owner, numero, ...(draftId ? { id: { not: draftId } } : {}) }
        }))
      )
        throw new AppError('Ya existe otra factura con ese número', 409);
      const { detalles, ...totals } = prepared;
      const values = {
        propietario_id: owner,
        destinatario_id: BigInt(data.destinatario_id),
        numero,
        fecha: new Date(data.fecha),
        comision_empresa: data.comision_empresa,
        ir_empresa: data.ir_empresa,
        modalidad_comision: data.modalidad_comision,
        ...totals,
        estado: 'PREPARACION'
      };
      if (draftId) {
        await tx.detalleFacturaTransporte.deleteMany({ where: { factura_id: draftId } });
        return tx.facturaTransporte.update({
          where: { id: draftId },
          data: { ...values, version: { increment: 1 }, detalles: { create: detalles } },
          include
        });
      }
      return tx.facturaTransporte.create({
        data: { ...values, detalles: { create: detalles } },
        include
      });
    },
    { timeout: 20000 }
  );
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: saved.id,
    accion: 'guardar_preparacion',
    despues: saved
  });
  return saved;
};

export const cerrarFactura = async (
  owner: bigint,
  id: bigint,
  input: CerrarFacturaInput,
  access: FacturacionAccess,
  audit?: AuditContext
) => {
  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${owner})::text`;
      const current = await tx.facturaTransporte.findFirst({
        where: { id, propietario_id: owner, estado: 'PREPARACION', version: input.version },
        include
      });
      if (!current)
        throw new AppError('La factura cambió o ya fue cerrada. Vuelve a abrirla.', 409);
      const data = facturaSchema.parse({
        destinatario_id: String(current.destinatario_id),
        numero: current.numero ?? '',
        fecha: current.fecha.toISOString().slice(0, 10),
        comision_empresa: Number(current.comision_empresa),
        ir_empresa: current.ir_empresa,
        modalidad_comision: current.modalidad_comision,
        detalles: current.detalles.map((d) => ({
          tipo: d.viaje_id ? 'propio' : 'proveedor',
          id: String(d.viaje_id ?? d.viaje_proveedor_id),
          comision_cliente: Number(d.comision_cliente),
          ir_cliente: d.ir_cliente
        }))
      });
      const prepared = await prepare(tx, owner, data, access, id);
      if (
        prepared.neto.lte(0) ||
        !prepared.neto.eq(input.neto_confirmado) ||
        !prepared.total_facturar.eq(input.total_facturar_confirmado)
      )
        throw new AppError('Revisa los importes antes de cerrar la factura.', 409);
      const { detalles, ...totals } = prepared;
      await tx.detalleFacturaTransporte.deleteMany({ where: { factura_id: id } });
      const invoice = await tx.facturaTransporte.update({
        where: { id },
        data: {
          ...totals,
          estado: 'FACTURADA',
          version: { increment: 1 },
          detalles: { create: detalles }
        },
        include
      });
      for (const d of detalles) {
        if (d.viaje_id)
          await tx.viaje.update({
            where: { id: d.viaje_id },
            data: { precio_real_flete: d.a_facturar }
          });
        else if (d.viaje_proveedor_id) {
          const v = await tx.viajeProveedor.findUniqueOrThrow({
            where: { id: d.viaje_proveedor_id }
          });
          await tx.viajeProveedor.update({
            where: { id: v.id },
            data: {
              valor_a_facturar: d.a_facturar,
              utilidad: d.neto.minus(v.precio_pagar_proveedor).minus(v.viaticos)
            }
          });
        }
      }
      return invoice;
    },
    { timeout: 20000 }
  );
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: id,
    accion: 'cerrar',
    despues: saved
  });
  return saved;
};

export const deshacerFactura = async (
  owner: bigint,
  id: bigint,
  version: number,
  audit?: AuditContext
) => {
  const invoice = await prisma.$transaction(
    async (tx) => {
      // Use the same owner lock as payments so an abono cannot race with reversal.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${owner})::text`;
      const current = await tx.facturaTransporte.findFirst({
        where: { id, propietario_id: owner },
        include
      });
      if (!current) throw new AppError('Factura no encontrada', 404);
      if (current.abonos.length)
        throw new AppError(
          'No se puede deshacer una factura que tiene abonos o pagos registrados.',
          409
        );
      if (current.estado === 'FACTURADA' && current.neto.lte(0))
        throw new AppError('No se puede deshacer una factura pagada o sin saldo pendiente.', 409);
      if (current.version !== version)
        throw new AppError('La factura cambió. Actualiza el listado antes de deshacerla.', 409);
      const ownIds = current.detalles.flatMap((d) => (d.viaje_id ? [d.viaje_id] : []));
      const externalIds = current.detalles.flatMap((d) =>
        d.viaje_proveedor_id ? [d.viaje_proveedor_id] : []
      );
      const [paidOwn, paidExternal] = await Promise.all([
        tx.viaje.count({ where: { propietario_id: owner, id: { in: ownIds }, cobrado: true } }),
        tx.viajeProveedor.count({
          where: { propietario_id: owner, id: { in: externalIds }, cobrado: true }
        })
      ]);
      if (paidOwn || paidExternal)
        throw new AppError(
          'No se puede deshacer la factura porque contiene viajes marcados como cobrados.',
          409
        );
      await tx.detalleFacturaTransporte.deleteMany({ where: { factura_id: id } });
      await tx.facturaTransporte.delete({ where: { id } });
      return current;
    },
    { timeout: 20000 }
  );
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: id,
    accion: 'deshacer',
    resumen: `Factura ${invoice.numero ?? '#' + id} deshecha; viajes liberados para facturar.`,
    antes: invoice,
    despues: { viajes_liberados: invoice.detalles.length }
  });
  return { id, viajes_liberados: invoice.detalles.length };
};

export const registrarAbonoFactura = async (
  owner: bigint,
  id: bigint,
  data: AbonoFacturaInput,
  audit?: AuditContext
) => {
  const saved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${owner})::text`;
    const factura = await tx.facturaTransporte.findFirst({
      where: { id, propietario_id: owner },
      include
    });
    if (!factura) throw new AppError('Factura no encontrada', 404);
    if (factura.estado !== 'FACTURADA')
      throw new AppError('Cierra la factura antes de registrar abonos', 409);
    if (new Date(data.fecha) < factura.fecha)
      throw new AppError('El abono no puede ser anterior a la factura', 400);
    const monto = new Prisma.Decimal(data.monto).toDecimalPlaces(2);
    const saldo = factura.neto.minus(sum(factura.abonos.map((a) => a.monto)));
    if (monto.gt(saldo)) throw new AppError('El abono supera el saldo pendiente', 400);
    const abono = await tx.abonoFacturaTransporte.create({
      data: { factura_id: id, fecha: new Date(data.fecha), monto, soporte: data.soporte }
    });
    if (monto.eq(saldo)) {
      await tx.viaje.updateMany({
        where: {
          propietario_id: owner,
          id: { in: factura.detalles.flatMap((d) => (d.viaje_id ? [d.viaje_id] : [])) }
        },
        data: {
          cobrado: true,
          fecha_cobro: new Date(data.fecha),
          soporte_cobro: factura.numero,
          sin_factura_cobro: false
        }
      });
      await tx.viajeProveedor.updateMany({
        where: {
          propietario_id: owner,
          id: {
            in: factura.detalles.flatMap((d) =>
              d.viaje_proveedor_id ? [d.viaje_proveedor_id] : []
            )
          }
        },
        data: {
          cobrado: true,
          fecha_cobro: new Date(data.fecha),
          soporte_cobro: factura.numero,
          sin_factura_cobro: false
        }
      });
    }
    return abono;
  });
  await recordAuditEvent({
    ...audit,
    entidad: 'facturacion',
    entidadId: id,
    accion: 'abonar',
    despues: saved
  });
  return saved;
};
