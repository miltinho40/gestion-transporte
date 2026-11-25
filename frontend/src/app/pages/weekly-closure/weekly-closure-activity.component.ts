import { Component, input, output } from '@angular/core';
import { LucideCheck, LucideCopy, LucidePencil } from '@lucide/angular';
import type { CierreSemanal, ActividadSemanalItem } from './weekly-closure.models';
import { actividadSemanal, moneyOrDash } from './weekly-closure.helpers';

@Component({
  selector: 'app-weekly-closure-activity',
  imports: [LucideCheck, LucideCopy, LucidePencil],
  templateUrl: './weekly-closure-activity.component.html',
})
export class WeeklyClosureActivityComponent {
  readonly cierre = input.required<CierreSemanal>();
  readonly markingCobroId = input<string | null>(null);
  readonly editar = output<ActividadSemanalItem>();
  readonly copiar = output<ActividadSemanalItem>();
  readonly cobrar = output<ActividadSemanalItem>();
  readonly actividadSemanal = actividadSemanal;
  readonly moneyOrDash = moneyOrDash;
}
