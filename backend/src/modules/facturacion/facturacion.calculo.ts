import { Prisma } from '@prisma/client';
import type { ModalidadComision } from './facturacion.schema.js';

const money = (v: Prisma.Decimal.Value) =>
  new Prisma.Decimal(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const calcularFacturacion = (
  precio: Prisma.Decimal.Value,
  comisionCliente: number,
  irCliente: boolean,
  comisionEmpresa: number,
  irEmpresa: boolean,
  directo: boolean,
  modalidad: ModalidadComision = 'AL_PAGAR'
) => {
  const base = money(precio);
  const monto_comision_cliente = directo ? money(0) : money(base.mul(comisionCliente).div(100));
  const monto_ir_cliente = directo || !irCliente ? money(0) : money(base.div(100));
  const base_empresa = base.minus(monto_ir_cliente);
  const comision_empresa = money(base_empresa.mul(comisionEmpresa).div(100));
  const a_facturar =
    modalidad === 'EN_FACTURA' ? base_empresa.minus(comision_empresa) : base_empresa;
  const ir_empresa = irEmpresa ? money(a_facturar.div(100)) : money(0);
  const neto = a_facturar
    .minus(monto_comision_cliente)
    .minus(modalidad === 'AL_PAGAR' ? comision_empresa : 0)
    .minus(ir_empresa);
  return {
    precio: base,
    monto_comision_cliente,
    monto_ir_cliente,
    a_facturar,
    comision_empresa,
    ir_empresa,
    neto
  };
};
