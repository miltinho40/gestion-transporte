import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFacturacion } from './facturacion.calculo.js';
import { facturaSchema } from './facturacion.schema.js';

test('Frutarica: el IR del cliente reduce la factura y la base de descuentos de la empresa',()=>{
  const r=calcularFacturacion(1000,0,true,2,true,false);
  assert.equal(r.a_facturar.toFixed(2),'990.00');
  assert.equal(r.comision_empresa.toFixed(2),'19.80');
  assert.equal(r.ir_empresa.toFixed(2),'9.90');
  assert.equal(r.neto.toFixed(2),'960.30');
});
test('comisiones cliente e IR se calculan sobre el precio original',()=>{
  const r=calcularFacturacion(1000,3,true,2,true,false);
  assert.equal(r.monto_comision_cliente.toFixed(2),'30.00');
  assert.equal(r.monto_ir_cliente.toFixed(2),'10.00');
  assert.equal(r.a_facturar.toFixed(2),'990.00');
  assert.equal(r.neto.toFixed(2),'930.30');
});
test('IR del cliente reduce lo facturado, IR de empresa solo reduce el neto',()=>{
  const sinIR=calcularFacturacion(1000,3,false,2,false,false);
  const conIR=calcularFacturacion(1000,3,true,2,true,false);
  assert.equal(sinIR.a_facturar.toFixed(2),'1000.00');
  assert.equal(conIR.a_facturar.toFixed(2),'990.00');
  assert.equal(sinIR.neto.minus(conIR.neto).toFixed(2),'19.70');
});
test('Jimmy: su comisión se descuenta del cobro, no de la factura ni de la base de Trasosa',()=>{
  const r=calcularFacturacion(1000,3,false,2,true,false);
  assert.equal(r.a_facturar.toFixed(2),'1000.00');
  assert.equal(r.monto_comision_cliente.toFixed(2),'30.00');
  assert.equal(r.comision_empresa.toFixed(2),'20.00');
  assert.equal(r.ir_empresa.toFixed(2),'10.00');
  assert.equal(r.neto.toFixed(2),'940.00');
});
test('carga directa evita duplicar descuentos y permite comisión 5%',()=>{
  const r=calcularFacturacion(1000,8,true,5,false,true);
  assert.equal(r.a_facturar.toFixed(2),'1000.00');
  assert.equal(r.neto.toFixed(2),'950.00');
});
test('IR independiente y redondeo monetario',()=>{
  const r=calcularFacturacion('100.55',0,false,2,true,false);
  assert.equal(r.comision_empresa.toFixed(2),'2.01');
  assert.equal(r.ir_empresa.toFixed(2),'1.01');
  assert.equal(r.neto.toFixed(2),'97.53');
});

test('TRASOSA factura el total y descuenta comisión e IR al pagar',()=>{
  const r=calcularFacturacion(1000,2,true,2,true,true,'AL_PAGAR');
  assert.equal(r.a_facturar.toFixed(2),'1000.00');
  assert.equal(r.monto_comision_cliente.toFixed(2),'0.00');
  assert.equal(r.comision_empresa.toFixed(2),'20.00');
  assert.equal(r.ir_empresa.toFixed(2),'10.00');
  assert.equal(r.neto.toFixed(2),'970.00');
});

test('TRANSPALFRA descuenta la comisión antes de facturar sin descontarla otra vez al pagar',()=>{
  const r=calcularFacturacion(1000,8,true,8,true,true,'EN_FACTURA');
  assert.equal(r.a_facturar.toFixed(2),'920.00');
  assert.equal(r.comision_empresa.toFixed(2),'80.00');
  assert.equal(r.ir_empresa.toFixed(2),'9.20');
  assert.equal(r.neto.toFixed(2),'910.80');
});

test('mantiene separados los descuentos del cliente y la comisión de la empresa',()=>{
  const r=calcularFacturacion(1000,3,true,8,true,false,'EN_FACTURA');
  assert.equal(r.monto_comision_cliente.toFixed(2),'30.00');
  assert.equal(r.monto_ir_cliente.toFixed(2),'10.00');
  assert.equal(r.comision_empresa.toFixed(2),'79.20');
  assert.equal(r.a_facturar.toFixed(2),'910.80');
  assert.equal(r.ir_empresa.toFixed(2),'9.11');
  assert.equal(r.neto.toFixed(2),'871.69');
});

test('permite modificar la comisión y desactivar IR por factura',()=>{
  const conIR=calcularFacturacion(1000,0,false,5,true,false,'EN_FACTURA');
  const sinIR=calcularFacturacion(1000,0,false,5,false,false,'EN_FACTURA');
  assert.equal(conIR.a_facturar.toFixed(2),'950.00');
  assert.equal(conIR.neto.toFixed(2),'940.50');
  assert.equal(sinIR.neto.toFixed(2),'950.00');
});

test('redondea importes de comisión en factura con precisión decimal',()=>{
  const r=calcularFacturacion('1.05',0,false,8,true,false,'EN_FACTURA');
  assert.equal(r.comision_empresa.toFixed(2),'0.08');
  assert.equal(r.a_facturar.toFixed(2),'0.97');
  assert.equal(r.ir_empresa.toFixed(2),'0.01');
  assert.equal(r.neto.toFixed(2),'0.96');
});
test('rechaza duplicados, fechas inválidas y porcentajes fuera de rango',()=>{
  const d={tipo:'propio',id:'1',comision_cliente:0,ir_cliente:false};
  const base={destinatario_id:'1',numero:'TEST',fecha:'2026-11-18',comision_empresa:2,ir_empresa:true,detalles:[d]};
  assert.equal(facturaSchema.safeParse(base).success,true);
  assert.equal(facturaSchema.safeParse({...base,detalles:[d,d]}).success,false);
  assert.equal(facturaSchema.safeParse({...base,fecha:'2026-02-30'}).success,false);
  assert.equal(facturaSchema.safeParse({...base,comision_empresa:101}).success,false);
  assert.equal(facturaSchema.parse(base).modalidad_comision,'AL_PAGAR');
  assert.equal(facturaSchema.safeParse({...base,modalidad_comision:'OTRA'}).success,false);
});
