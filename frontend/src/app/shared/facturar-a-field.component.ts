import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

interface Empresa {id:string;nombre:string;configuracion_facturacion?:{destinatario_id:string|null}|null;}
@Component({selector:'app-facturar-a-field',imports:[FormsModule],template:`
  <label class="form-label" [for]="inputId">Facturar a <span class="text-danger">*</span></label>
  <div class="catalog-combobox">
    <input class="form-control" type="search" autocomplete="off" placeholder="Buscar empresa..."
      [id]="inputId" [ngModel]="query()" [ngModelOptions]="{standalone:true}" [disabled]="disabled"
      (ngModelChange)="search($event)" (focus)="openOptions()" (blur)="closeSoon()"
      (keydown)="onKeydown($event)" role="combobox" aria-autocomplete="list"
      [attr.aria-expanded]="opened()" [attr.aria-controls]="inputId + '-options'"
      [attr.aria-activedescendant]="opened() && options()[activeIndex()] ? inputId + '-option-' + activeIndex() : null" />
    @if(opened()) {
      <div class="catalog-options shadow-sm" role="listbox" [id]="inputId + '-options'">
        @for(e of options();track e.id;let index=$index) {
          <button type="button" class="catalog-option" role="option" [class.active]="index===activeIndex()"
            [id]="inputId + '-option-' + index" [attr.aria-selected]="e.id===value"
            (mousedown)="$event.preventDefault()" (click)="choose(e)">{{e.nombre}}</button>
        } @empty { <span class="catalog-empty">Sin coincidencias</span> }
      </div>
    }
  </div>
  @if(error()){<div class="text-danger small">{{error()}}</div>}
`})
export class FacturarAFieldComponent implements OnChanges, OnDestroy {
  @Input() clienteId=''; @Input() value=''; @Input() inputId='facturar-a';
  @Input() disabled=false;
  @Output() selected=new EventEmitter<string>();
  readonly empresas=signal<Empresa[]>([]); readonly error=signal('');
  readonly query=signal(''); readonly opened=signal(false); readonly activeIndex=signal(0);
  readonly options=computed(()=>this.empresas().filter(e=>this.normalize(e.nombre).includes(this.normalize(this.query()))));
  private readonly api=inject(ApiService);
  private closeTimer?:ReturnType<typeof setTimeout>;
  constructor(){this.api.get<Empresa[]>('/clientes',{solo_propios:true,activo:true}).subscribe({next:r=>{this.empresas.set(r);this.defaultValue();this.syncLabel();},error:()=>this.error.set('No se pudieron cargar las empresas.')});}
  ngOnChanges(changes:SimpleChanges){
    if(changes['clienteId'] && (!changes['value']||!this.value))this.defaultValue(true);
    if(changes['value'])this.syncLabel();
  }
  ngOnDestroy(){clearTimeout(this.closeTimer);}
  openOptions(){clearTimeout(this.closeTimer);this.activeIndex.set(0);this.opened.set(true);}
  search(text:string){
    this.query.set(text);this.openOptions();
    const exact=this.empresas().find(e=>this.normalize(e.nombre)===this.normalize(text));
    this.selected.emit(exact?.id??'');
  }
  choose(empresa:Empresa){
    clearTimeout(this.closeTimer);this.query.set(empresa.nombre);
    this.selected.emit(empresa.id);this.opened.set(false);
  }
  closeSoon(){this.closeTimer=setTimeout(()=>this.opened.set(false),150);}
  onKeydown(event:KeyboardEvent){
    if(event.key==='Escape'){
      if(this.opened()){event.preventDefault();event.stopPropagation();this.opened.set(false);}
      return;
    }
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();const wasOpen=this.opened();this.opened.set(true);
      const count=this.options().length;
      this.activeIndex.set(count?(wasOpen?(this.activeIndex()+(event.key==='ArrowDown'?1:-1)+count)%count:0):0);
    }else if(event.key==='Enter'&&this.opened()){
      event.preventDefault();const empresa=this.options()[this.activeIndex()];if(empresa)this.choose(empresa);
    }
  }
  private syncLabel(){
    const empresa=this.empresas().find(e=>e.id===this.value);
    if(empresa)this.query.set(empresa.nombre);
    else if(!this.value&&!this.opened())this.query.set('');
  }
  private normalize(value:string){
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
  }
  private defaultValue(force=false){
    if(!this.clienteId||(!force&&this.value))return;
    const client=this.empresas().find(e=>e.id===this.clienteId);
    if(client){
      const id=client.configuracion_facturacion?.destinatario_id??client.id;
      this.selected.emit(id);
      this.query.set(this.empresas().find(e=>e.id===id)?.nombre??'');
    }
  }
}
