import { Component, input, output } from '@angular/core';
import { LucideCheck, LucidePencil, LucideSparkles } from '@lucide/angular';
import type { AsistenteCierre, AsistenteCierreAlerta } from './weekly-closure.models';
import { assistantRiskLabel, assistantSeverityLabel } from './weekly-closure.helpers';

@Component({
  selector: 'app-weekly-closure-assistant',
  imports: [LucideCheck, LucidePencil, LucideSparkles],
  templateUrl: './weekly-closure-assistant.component.html',
})
export class WeeklyClosureAssistantComponent {
  readonly asistente = input.required<AsistenteCierre>();
  readonly revisar = output<AsistenteCierreAlerta>();
  readonly assistantRiskLabel = assistantRiskLabel;
  readonly assistantSeverityLabel = assistantSeverityLabel;
  assistantRiskClass(riesgo: AsistenteCierre['riesgo']) {
    const classes: Record<AsistenteCierre['riesgo'], string> = {
      bajo: 'weekly-assistant-risk-low',
      medio: 'weekly-assistant-risk-medium',
      alto: 'weekly-assistant-risk-high',
    };

    return classes[riesgo] ?? classes.bajo;
  }
  assistantSeverityClass(severidad: AsistenteCierreAlerta['severidad']) {
    const classes: Record<AsistenteCierreAlerta['severidad'], string> = {
      info: 'text-bg-light',
      advertencia: 'badge-soft-warning',
      critica: 'text-bg-danger',
    };

    return classes[severidad] ?? classes.info;
  }
}
