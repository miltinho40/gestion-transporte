import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/config/prisma.js';
import { signToken } from '../src/config/jwt.js';
import { semanaFacturacion } from '../src/modules/facturacion/facturacion.filters.js';

if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw Error('Solo local');
let ownId:bigint|undefined, externalId:bigint|undefined, sessionId:string|undefined;
const invoices:bigint[]=[];
const extraTrips:bigint[]=[];
const extraProviderTrips:bigint[]=[];
const marker=`TEST-${randomUUID()}`;
try {
  const source=await prisma.viaje.findFirstOrThrow({where:{estado:{not:'CANCELADO'}}});
  const user=await prisma.usuario.findFirstOrThrow({where:{es_super_admin:true,activo:true,requiere_password:false}});
  const session=await prisma.sesionUsuario.create({data:{usuario_id:user.id,propietario_id:source.propietario_id,refresh_token_hash:randomUUID(),expira_en:new Date(Date.now()+3600000)}});sessionId=session.id;
  const token=signToken({usuario_id:String(user.id),sesion_id:session.id,propietario_id:String(source.propietario_id),es_super_admin:true});
  const request=async(path:string,body?:unknown,method?:string)=>{const r=await fetch(`http://localhost:3000/api/facturacion${path}`,{method:method??(body?'POST':'GET'),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json() as any};};
  const own=await prisma.viaje.create({data:{...source,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,fecha_cobro:null,precio_flete:1000,numeros_guia_remision:[marker]}});ownId=own.id;
  const extSource=await prisma.viajeProveedor.findFirst({where:{propietario_id:source.propietario_id}});
  if(extSource){const ext=await prisma.viajeProveedor.create({data:{...extSource,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,precio_viaje:500,numeros_guia_remision:[marker]}});externalId=ext.id;}
  const filtered = await request(`/viajes?search=${marker}&vehiculo_ids=${source.vehiculo_id}&cliente_ids=${source.cliente_id}&semanas=${semanaFacturacion(source.fecha_salida)}`);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.data.total, 1);
  assert.equal(filtered.data.items[0].id, String(ownId));
  const emptyVehicles = await request(`/viajes?search=${marker}&vehiculo_ids=999999999`);
  assert.equal(emptyVehicles.data.total, 0);
  const otherWeek = semanaFacturacion(source.fecha_salida) === 1 ? 2 : 1;
  const emptyWeeks = await request(`/viajes?search=${marker}&vehiculo_ids=${source.vehiculo_id}&semanas=${otherWeek}`);
  assert.equal(emptyWeeks.data.total, 0);
  const multiple = await request(`/viajes?search=${marker}&cliente_ids=${source.cliente_id},${extSource?.cliente_id??source.cliente_id}&semanas=${semanaFacturacion(source.fecha_salida)},${semanaFacturacion(extSource?.fecha_salida??source.fecha_salida)}`);
  assert.equal(multiple.data.total, externalId ? 2 : 1);
  const dest=await prisma.cliente.findFirstOrThrow({where:{propietario_id:source.propietario_id,id:{not:source.cliente_id},activo:true}});
  const viajePayload={cliente_id:String(source.cliente_id),vehiculo_id:String(source.vehiculo_id),conductor_id:String(source.conductor_id),tarifa_ruta_id:String(source.tarifa_ruta_id),fecha_salida:source.fecha_salida.toISOString().slice(0,10),precio_flete:1000,viaticos:135,facturar_a_id:String(dest.id)};
  const newTripResponse=await fetch('http://localhost:3000/api/viajes',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(viajePayload)});
  const newTrip=await newTripResponse.json() as any;
  if(newTripResponse.status===201)extraTrips.push(BigInt(newTrip.id));
  assert.equal(newTripResponse.status,201,JSON.stringify(newTrip));assert.equal(newTrip.facturar_a_id,String(dest.id));
  const editResponse=await fetch(`http://localhost:3000/api/viajes/${newTrip.id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({observaciones:'Prueba de destinatario persistente'})});
  assert.equal(editResponse.status,200);assert.equal((await editResponse.json() as any).facturar_a_id,String(dest.id));
  const details=[{tipo:'propio',id:String(ownId),comision_cliente:0,ir_cliente:true},...(externalId?[{tipo:'proveedor',id:String(externalId),comision_cliente:0,ir_cliente:false}]:[])];
  const body={destinatario_id:String(dest.id),numero:marker,fecha:'2026-11-18',comision_empresa:2,ir_empresa:true,detalles:details};
  const vehicle=await prisma.vehiculo.findUniqueOrThrow({where:{id:source.vehiculo_id}});
  const byPlate=await request('/viajes?search='+encodeURIComponent(vehicle.placa));
  assert.equal(byPlate.status,200);
  assert.ok(byPlate.data.total>0);
  assert.ok(byPlate.data.items.every((t:any)=>t.placa===vehicle.placa));
  const ownOnly=await request('/viajes?solo_propios=true');
  assert.equal(ownOnly.status,200);
  assert.ok(ownOnly.data.items.every((t:any)=>t.tipo==='propio'));
  const preview=await request('/previsualizar',body);assert.equal(preview.status,200,JSON.stringify(preview.data));assert.equal(Number(preview.data.detalles[0].a_facturar),990);assert.equal(Number(preview.data.detalles[0].neto),960.3);
  const foreign=await prisma.cliente.findFirst({where:{propietario_id:{not:source.propietario_id},activo:true}});
  if(foreign){const forbidden=await request('/previsualizar',{...body,destinatario_id:String(foreign.id)});assert.equal(forbidden.status,400);}
  const invalid=await request('/previsualizar',{...body,detalles:[...details,details[0]]});assert.equal(invalid.status,400);
  const confirmation={...body,neto_confirmado:Number(preview.data.neto),total_facturar_confirmado:Number(preview.data.total_facturar)};
  const stale=await request('',{...confirmation,neto_confirmado:0});assert.equal(stale.status,409);
  const created=await request('',confirmation);assert.equal(created.status,201,JSON.stringify(created.data));const invoice=created.data;invoices.push(BigInt(invoice.id));
  const duplicate=await request('',{...confirmation,numero:marker+'-DUP'});assert.equal(duplicate.status,409);
  const tooMuch=await request(`/${invoice.id}/abonos`,{fecha:'2026-11-18',monto:Number(invoice.neto)+1,soporte:marker});assert.equal(tooMuch.status,400);
  const first=await request(`/${invoice.id}/abonos`,{fecha:'2026-11-18',monto:100,soporte:marker});assert.equal(first.status,201,JSON.stringify(first.data));
  const undoPartial=await request(`/${invoice.id}/deshacer`,{version:invoice.version});assert.equal(undoPartial.status,409);assert.match(undoPartial.data.message,/abonos|pagos/);
  assert.equal((await prisma.viaje.findUniqueOrThrow({where:{id:ownId}})).cobrado,false);
  const concurrent=await Promise.all([1,2].map(()=>request(`/${invoice.id}/abonos`,{fecha:'2026-11-18',monto:Number(invoice.neto)-100,soporte:marker})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,400]);
  const paid=await prisma.viaje.findUniqueOrThrow({where:{id:ownId}});assert.equal(paid.cobrado,true);assert.equal(Number(paid.precio_flete),1000);
  assert.equal(paid.fecha_cobro?.toISOString().slice(0,10),'2026-11-18');assert.equal(paid.soporte_cobro,invoice.numero);
  if(externalId&&extSource){const ext=await prisma.viajeProveedor.findUniqueOrThrow({where:{id:externalId}});assert.equal(ext.cobrado,true);assert.equal(ext.pagado_proveedor,extSource.pagado_proveedor);assert.equal(String(ext.precio_pagar_proveedor),String(extSource.precio_pagar_proveedor));}
  if(externalId){
    for(const [cobrado,pagado_proveedor] of [[false,false],[true,false],[false,true],[true,true]]){
      await prisma.viajeProveedor.update({where:{id:externalId},data:{cobrado,pagado_proveedor}});
      for(const show of [false,true]){
        const result=await fetch(`http://localhost:3000/api/viajes-proveedor?search=${marker}&page=1&limit=25&mostrar_finalizados=${show}`,{headers:{Authorization:`Bearer ${token}`}});
        assert.equal(result.status,200);
        const filtered=await result.json() as any;
        assert.equal(filtered.meta.total,show||!cobrado||!pagado_proveedor?1:0);
        assert.equal(filtered.data.length,filtered.meta.total);
      }
    }
    console.log('OK: filtro de finalizados en backend, cuatro combinaciones de cobro/pago y paginación correcta.');
  }
  const list=await request('');assert.equal(list.status,200);assert.equal(Number(list.data.items.find((f:any)=>f.id===invoice.id).saldo),0);
  const undoPaid=await request(`/${invoice.id}/deshacer`,{version:invoice.version});assert.equal(undoPaid.status,409);
  console.log('OK: mezcla de viajes, dos etapas, duplicados, sobrepago, abonos parciales, cobro total, precio original y pago proveedor independiente.');
  const draftTrip=await prisma.viaje.create({data:{...source,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,fecha_cobro:null,precio_flete:1000}});extraTrips.push(draftTrip.id);
  const addedTrip=await prisma.viaje.create({data:{...source,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,fecha_cobro:null,precio_flete:500}});extraTrips.push(addedTrip.id);
  const draftBody={...body,numero:'',detalles:[{...details[0],id:String(draftTrip.id)}]};
  const draft=await request('/borradores',draftBody);assert.equal(draft.status,201,JSON.stringify(draft.data));invoices.push(BigInt(draft.data.id));assert.equal(draft.data.estado,'PREPARACION');assert.equal(draft.data.numero,null);
  assert.equal(String((await prisma.viaje.findUniqueOrThrow({where:{id:draftTrip.id}})).precio_real_flete),String(source.precio_real_flete));
  const earlyPayment=await request(`/${draft.data.id}/abonos`,{fecha:'2026-11-18',monto:1,soporte:marker});assert.equal(earlyPayment.status,409);
  const reserved=await request('/previsualizar',draftBody);assert.equal(reserved.status,409);
  const appendedBody={...draftBody,numero:marker+'-PREP',version:0,detalles:[...draftBody.detalles,{...details[0],id:String(addedTrip.id)}]};
  const appended=await request(`/${draft.data.id}/borrador`,appendedBody,'PUT');assert.equal(appended.status,200,JSON.stringify(appended.data));assert.equal(appended.data.detalles.length,2);
  const staleDraft=await request(`/${draft.data.id}/borrador`,appendedBody,'PUT');assert.equal(staleDraft.status,409);
  const closeBody={version:appended.data.version,neto_confirmado:Number(appended.data.neto),total_facturar_confirmado:Number(appended.data.total_facturar)};
  const closed=await request(`/${draft.data.id}/cerrar`,closeBody);assert.equal(closed.status,200,JSON.stringify(closed.data));assert.equal(closed.data.estado,'FACTURADA');
  const frozen=await request(`/${draft.data.id}/borrador`,{...appendedBody,version:closed.data.version},'PUT');assert.equal(frozen.status,409);
  const afterClose=await request(`/${draft.data.id}/abonos`,{fecha:'2026-11-18',monto:1,soporte:marker});assert.equal(afterClose.status,201);
  console.log('OK: preparación sin número, reserva, anexar viajes, versión concurrente, cierre y abonos solo al facturar.');
  const undoTrip=await prisma.viaje.create({data:{...source,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,fecha_cobro:null,precio_flete:1000,numeros_guia_remision:[marker+'-UNDO']}});extraTrips.push(undoTrip.id);
  let undoProviderId:bigint|undefined;
  if(extSource){
    const v=await prisma.viajeProveedor.create({data:{...extSource,id:undefined,created_at:undefined,updated_at:undefined,cobrado:false,fecha_cobro:null,numeros_guia_remision:[marker+'-UNDO']}});
    undoProviderId=v.id;extraProviderTrips.push(v.id);
  }
  const undoBody={...body,numero:marker+'-UNDO',detalles:[{...details[0],id:String(undoTrip.id)},...(undoProviderId?[{tipo:'proveedor',id:String(undoProviderId),comision_cliente:0,ir_cliente:false}]:[])]};
  const undoPreview=await request('/previsualizar',undoBody);assert.equal(undoPreview.status,200);
  const undoConfirmed={...undoBody,neto_confirmado:Number(undoPreview.data.neto),total_facturar_confirmado:Number(undoPreview.data.total_facturar)};
  const undoCreated=await request('',undoConfirmed);assert.equal(undoCreated.status,201);invoices.push(BigInt(undoCreated.data.id));
  assert.equal((await request(`/${undoCreated.data.id}/deshacer`,{version:undoCreated.data.version+1})).status,409);
  await prisma.viaje.update({where:{id:undoTrip.id},data:{cobrado:true}});
  assert.equal((await request(`/${undoCreated.data.id}/deshacer`,{version:undoCreated.data.version})).status,409);
  await prisma.viaje.update({where:{id:undoTrip.id},data:{cobrado:false}});
  const undone=await request(`/${undoCreated.data.id}/deshacer`,{version:undoCreated.data.version});assert.equal(undone.status,200,JSON.stringify(undone.data));
  assert.equal(undone.data.viajes_liberados,undoProviderId?2:1);
  assert.equal(await prisma.facturaTransporte.count({where:{id:BigInt(undoCreated.data.id)}}),0);
  const available=await request('/viajes?search='+encodeURIComponent(marker+'-UNDO'));assert.equal(available.data.total,undoProviderId?2:1);
  if(undoProviderId&&extSource){const v=await prisma.viajeProveedor.findUniqueOrThrow({where:{id:undoProviderId}});assert.equal(v.pagado_proveedor,extSource.pagado_proveedor);assert.equal(String(v.precio_pagar_proveedor),String(extSource.precio_pagar_proveedor));}
  const recreated=await request('',undoConfirmed);assert.equal(recreated.status,201);invoices.push(BigInt(recreated.data.id));
  console.log('OK: deshacer libera viajes propios y de proveedores; rechaza abonos, pagos, viajes cobrados y versiones obsoletas.');
  const { chromium } = await import('../../frontend/node_modules/playwright/index.mjs');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/auth/refresh',route=>route.fulfill({json:{token,usuario:{id:String(user.id),nombre:'Prueba local',es_super_admin:true},contexto:{propietario_id:String(source.propietario_id),propietario_nombre:'Prueba local',rol:'admin',es_propietario:true,es_intermediario:true},propietarios:[]}}));
    await page.goto('http://localhost:4200/app/facturacion');
    await page.getByRole('heading',{name:'Facturación',exact:true}).waitFor();
    await page.getByRole('columnheader',{name:'Sem.',exact:true}).waitFor();
    await page.getByRole('columnheader',{name:'Placa',exact:true}).waitFor();
    await page.getByRole('checkbox',{name:'Mis viajes',exact:true}).check();
    await page.waitForResponse(r=>r.url().includes('/facturacion/viajes')&&r.url().includes('solo_propios=true'));
    await page.getByRole('checkbox',{name:'Mis viajes',exact:true}).uncheck();
    await page.locator('tbody tr').first().locator('td').nth(5).waitFor();
    assert.equal(await page.locator('#billing-recipient').count(),0);
    assert.equal(await page.getByRole('columnheader',{name:'Seleccionar',exact:true}).count(),0);
    const widthsBefore=await page.locator('.billing-trips-table th').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().width));
    const filtersLayout=await page.evaluate(`(() => {
      const controls=[document.getElementById('billing-search'),...document.querySelectorAll('.billing-filters .reports-combo-toggle')];
      return controls.map(e=>({y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height}));
    })()`);
    assert.ok(filtersLayout.every(r=>Math.abs(r.y-filtersLayout[0].y)<2),JSON.stringify(filtersLayout));
    assert.ok(filtersLayout.every(r=>Math.abs(r.height-filtersLayout[0].height)<2),JSON.stringify(filtersLayout));
    const clientName = (await page.locator('tbody tr').first().locator('td').nth(5).innerText()).trim();
    const plateName = (await page.locator('tbody tr').first().locator('td').nth(4).innerText()).trim();
    const weekNumber = Number((await page.locator('tbody tr').first().locator('td').nth(1).innerText()).trim());
    for (const filter of [
      { label: 'Clientes', option: clientName, param: 'cliente_ids' },
      { label: 'Vehículos', option: plateName, param: 'vehiculo_ids' },
      { label: 'Semanas', option: `Semana ${weekNumber}`, param: 'semanas' }
    ]) {
      const control = page.locator('app-multi-select-filter').filter({has:page.getByText(filter.label,{exact:true})});
      await control.locator('.reports-combo-toggle').click();
      const response = page.waitForResponse(r => r.url().includes('/facturacion/viajes') && new URL(r.url()).searchParams.has(filter.param));
      await control.getByRole('checkbox',{name:filter.option,exact:true}).check();
      assert.equal((await response).status(),200);
      await control.locator('.reports-combo-toggle').click();
    }
    await page.screenshot({path:process.env.TEMP+'/transporte-facturacion-filtros.png',fullPage:true});
    const widthsAfter=await page.locator('.billing-trips-table th').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().width));
    assert.ok(widthsAfter.every((width,index)=>Math.abs(width-widthsBefore[index])<1));
    assert.equal(await page.getByLabel('Número de factura',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Desde',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Vista previa del viaje',exact:true}).first().click();
    await page.locator('app-viaje-detail-panel, app-proveedor-viaje-detail-panel').waitFor({state:'attached'});
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:/Seleccionar viaje de/}).first().check();
    await page.getByRole('button',{name:'Editar viaje',exact:true}).first().click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).waitFor();
    await page.locator('#facturar-a').waitFor();
    await page.waitForFunction(() => Boolean((document.getElementById('facturar-a') as HTMLInputElement)?.value));
    assert.equal(await page.locator('#observaciones').count(), 0);
    for (const id of ['numeros_guia_remision', 'descripcion_carga']) {
      assert.equal(await page.locator('#' + id).evaluate(e => getComputedStyle(e).resize), 'none');
    }
    const recipientName = await page.locator('#facturar-a').inputValue();
    await page.locator('#facturar-a').fill('EMPRESA INEXISTENTE PRUEBA');
    await page.locator('#facturar-a-options').getByText('Sin coincidencias').waitFor();
    await page.locator('#facturar-a').fill(recipientName.slice(0, 4).toLowerCase());
    await page.locator('#facturar-a-options').getByRole('option', { name: recipientName, exact: true }).click();
    await page.waitForFunction(name => (document.getElementById('facturar-a') as HTMLInputElement).value === name, recipientName);
    assert.equal(await page.locator('#facturar-a').inputValue(), recipientName);
    await page.locator('#facturar-a').fill(recipientName);
    await page.locator('#facturar-a').press('ArrowDown');
    await page.locator('#facturar-a').press('Enter');
    await page.waitForFunction(() => document.getElementById('facturar-a')?.getAttribute('aria-expanded') === 'false');
    assert.equal(await page.locator('#facturar-a').getAttribute('aria-expanded'), 'false');
    const layout = await page.evaluate(`(() => {
      const box = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        operation: ['vehiculo_id', 'conductor_id', 'fecha_salida', 'fecha_llegada'].map(box),
        parties: ['cliente_id', 'facturar-a', 'retorno'].map(id => box(id)),
        route: box('tarifa_ruta_id'),
        values: ['precio_flete', 'viaticos', 'peso_carga_kg'].map(box),
        guides: box('numeros_guia_remision'), description: box('descripcion_carga'),
      };
    })()`);
    assert.ok(layout.operation.every(r => Math.abs(r.y - layout.operation[0].y) < 2));
    assert.ok(Math.abs(layout.operation[0].width - 162) < 1);
    assert.ok(Math.abs(layout.operation[1].right - layout.route.right) < 1);
    assert.ok(layout.operation.slice(2).every(r => Math.abs(r.width - 139.5) < 1));
    assert.ok(Math.abs(layout.parties[0].y - layout.parties[1].y) < 2);
    assert.ok(Math.abs(layout.parties[2].y - layout.parties[0].y) < 16);
    assert.ok(layout.values.every(r => r.y > layout.route.bottom));
    assert.ok(layout.values.every(r => Math.abs(r.y - layout.values[0].y) < 2));
    assert.ok(Math.abs(layout.guides.y - layout.route.y) <= 3, JSON.stringify(layout));
    assert.ok(Math.abs(layout.guides.height - layout.description.height) < 2);
    assert.ok(layout.guides.bottom >= layout.values[0].bottom - 2);
    await page.locator('summary').filter({hasText:'Diésel, peajes y estimación'}).click();
    const technicalRows = await page.locator('#costo_diesel, #costo_peajes, #costo_estimado_gastos').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().y));
    assert.ok(technicalRows.every(y => Math.abs(y - technicalRows[0]) <= 3), JSON.stringify(technicalRows));
    await page.locator('summary').filter({hasText:'Diésel, peajes y estimación'}).click();
    await page.screenshot({path:process.env.TEMP+'/transporte-viaje-form-desktop.png',fullPage:true});
    await page.locator('summary').filter({hasText:'Gastos adicionales'}).click();
    await page.getByRole('button',{name:'Agregar gasto',exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:process.env.TEMP+'/transporte-viaje-form-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.waitForURL('**/app/facturacion');
    await page.getByRole('heading',{name:'Facturación',exact:true}).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('app-multi-select-filter .reports-chip').length === 3);
    assert.equal(await page.locator('app-multi-select-filter .reports-chip').count(),3);
    await page.getByRole('checkbox',{name:/Seleccionar viaje de/}).first().waitFor();
    assert.equal(await page.getByRole('checkbox',{name:/Seleccionar viaje de/}).first().isChecked(),true);
    const providerRow=page.getByRole('row').filter({has:page.getByRole('cell',{name:'Proveedor',exact:true})}).first();
    if(await providerRow.count()){
      await providerRow.getByRole('button',{name:'Editar viaje',exact:true}).click();
      await page.getByRole('button',{name:'Cancelar',exact:true}).waitFor();
      await page.getByRole('button',{name:'Cancelar',exact:true}).click();
      await page.waitForURL('**/app/facturacion');
    }
    assert.equal(await page.getByRole('heading',{name:/Viajes seleccionados/}).count(),0);
    await page.getByRole('button',{name:/^Facturar \(/}).click();
    await page.getByRole('dialog',{name:'Facturar viajes',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Revisar cálculo',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Guardar en preparación',exact:true}).isDisabled(),true);
    await page.locator('#billing-recipient').fill(dest.nombre.slice(0, 4));
    await page.locator('#billing-recipient-options').getByRole('option', {name:dest.nombre,exact:true}).click();
    await page.waitForFunction(name => (document.getElementById('billing-recipient') as HTMLInputElement)?.value === name, dest.nombre);
    assert.equal(await page.getByLabel('Número de factura',{exact:true}).count(),0);
    const invoiceControls = await page.evaluate(`(() => ['billing-recipient','billing-existing','billing-date','billing-commission','billing-ir'].map(id=>{
      const r=document.getElementById(id).getBoundingClientRect();return {y:r.y,bottom:r.bottom};
    }))()`);
    assert.ok(Math.max(...invoiceControls.map(r=>r.y))-Math.min(...invoiceControls.map(r=>r.y))<16,JSON.stringify(invoiceControls));
    await page.getByLabel('Comisión %',{exact:true}).fill('2');
    await page.getByRole('button',{name:'Guardar en preparación',exact:true}).waitFor();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Guardar en preparación'))?.disabled);
    await page.screenshot({path:process.env.TEMP+'/transporte-facturar-modal-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:process.env.TEMP+'/transporte-facturar-modal-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Cerrar factura',exact:true}).click();
    await page.getByLabel('Número de factura',{exact:true}).waitFor();
    await page.locator('.swal2-confirm').click();
    await page.getByText('Ingresa el número de factura.',{exact:true}).waitFor();
    await page.getByLabel('Número de factura',{exact:true}).fill(marker+'-UI');
    await page.locator('.swal2-cancel').click();
    assert.equal(await prisma.facturaTransporte.count({where:{numero:marker+'-UI'}}),0);
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Valores predeterminados',exact:true}).click();
    await page.getByText('Comisión %',{exact:true}).waitFor();
    await page.screenshot({path:process.env.TEMP+'/transporte-facturacion-desktop.png',fullPage:true});
    await page.getByRole('button',{name:'Facturas y cobros',exact:true}).click();
    await page.getByText(marker,{exact:true}).waitFor();
    await page.getByRole('button',{name:'Ver factura y abonos'}).first().click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({path:process.env.TEMP+'/transporte-facturacion-detalle.png',fullPage:true});
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    const paidRow=page.getByRole('row').filter({has:page.getByRole('cell',{name:marker,exact:true})});
    assert.equal(await paidRow.getByRole('button',{name:'Deshacer factura',exact:true}).isDisabled(),true);
    const undoRow=page.getByRole('row').filter({has:page.getByRole('cell',{name:marker+'-UNDO',exact:true})});
    await undoRow.getByRole('button',{name:'Deshacer factura',exact:true}).click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(await prisma.facturaTransporte.count({where:{id:BigInt(recreated.data.id)}}),1);
    await undoRow.getByRole('button',{name:'Deshacer factura',exact:true}).click();
    const undoResponse=page.waitForResponse(r=>r.url().endsWith(`/facturacion/${recreated.data.id}/deshacer`)&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Sí, deshacer',exact:true}).click();
    assert.equal((await undoResponse).status(),200);
    await undoRow.waitFor({state:'detached'});
    assert.equal(await prisma.facturaTransporte.count({where:{id:BigInt(recreated.data.id)}}),0);
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Preparar factura',exact:true}).click();
    await page.screenshot({path:process.env.TEMP+'/transporte-facturacion-mobile.png',fullPage:true});
    await page.goto(`http://localhost:4200/movil/viajes/${source.id}/editar`);
    await page.locator('#mobile-facturar-a').waitFor();
    await page.waitForFunction(()=>Boolean((document.querySelector('input[list="mobile-clientes"]') as HTMLInputElement)?.value));
    await page.locator('summary').filter({hasText:'Gastos adicionales'}).click();
    await page.screenshot({path:process.env.TEMP+'/transporte-nuevo-form-movil.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('OK: página, configuración, factura y abonos en navegador; escritorio y móvil sin errores JavaScript.');
  } finally {await browser.close();}
} finally {
  await prisma.abonoFacturaTransporte.deleteMany({where:{factura_id:{in:invoices}}});
  await prisma.detalleFacturaTransporte.deleteMany({where:{factura_id:{in:invoices}}});
  await prisma.facturaTransporte.deleteMany({where:{id:{in:invoices}}});
  if(ownId)await prisma.viaje.delete({where:{id:ownId}});
  if(externalId)await prisma.viajeProveedor.delete({where:{id:externalId}});
  await prisma.viaje.deleteMany({where:{id:{in:extraTrips}}});
  await prisma.viajeProveedor.deleteMany({where:{id:{in:extraProviderTrips}}});
  if(sessionId)await prisma.sesionUsuario.delete({where:{id:sessionId}});
  await prisma.auditoriaEvento.deleteMany({where:{entidad:'facturacion',OR:[{entidad_id:{in:invoices.map(String)}},{despues:{path:['numero'],string_starts_with:'TEST-'}},{despues:{path:['soporte'],string_starts_with:'TEST-'}}]}});
  await prisma.$disconnect();
}

