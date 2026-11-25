import { TestBed } from '@angular/core/testing';
import { WeeklyClosureActivityComponent } from './weekly-closure-activity.component';
import { WeeklyClosureAssistantComponent } from './weekly-closure-assistant.component';
import { weeklyClosureFixture } from './weekly-closure.testing';
import type { ActividadSemanalItem, AsistenteCierreAlerta } from './weekly-closure.models';

describe('Paneles del cierre semanal', () => {
  it('emite editar, copiar y cobrar con el registro correcto', () => {
    const fixture = TestBed.createComponent(WeeklyClosureActivityComponent);
    fixture.componentRef.setInput('cierre', weeklyClosureFixture());
    const events: { action: string; id: string }[] = [];
    for (const [name, output] of Object.entries({
      editar: fixture.componentInstance.editar,
      copiar: fixture.componentInstance.copiar,
      cobrar: fixture.componentInstance.cobrar,
    })) {
      output.subscribe((item: ActividadSemanalItem) =>
        events.push({ action: name, id: item.sourceId }),
      );
    }
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Modificar"]')!.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Copiar"]')!.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Marcar cobrado"]')!.click();
    expect(events).toEqual([
      { action: 'editar', id: '10' },
      { action: 'copiar', id: '10' },
      { action: 'cobrar', id: '10' },
    ]);
    expect(element.querySelectorAll('button[aria-label="Marcar cobrado"]').length).toBe(1);
    fixture.componentRef.setInput('markingCobroId', '10');
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLButtonElement>('button[aria-label="Marcar cobrado"]')!.disabled,
    ).toBeTrue();
  });

  it('permite revisar alertas de registros sin modificar sus datos', () => {
    const fixture = TestBed.createComponent(WeeklyClosureAssistantComponent);
    const alert: AsistenteCierreAlerta = {
      id: 'alert-1',
      tipo: 'mantenimiento',
      severidad: 'advertencia',
      titulo: 'Revisar mantenimiento',
      mensaje: 'Cambió el costo',
      accion_sugerida: 'Verifica el valor',
      source_type: 'mantenimiento',
      source_id: '20',
    };
    fixture.componentRef.setInput('asistente', {
      disponible: true,
      riesgo: 'medio',
      puntaje: 1,
      total_alertas: 1,
      resumen: 'Revisar',
      alertas: [alert],
    });
    let received: AsistenteCierreAlerta | undefined;
    fixture.componentInstance.revisar.subscribe((value) => (received = value));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Revisar registro"]').click();
    expect(received).toBe(alert);
    expect(fixture.nativeElement.textContent).toContain('Riesgo Medio');
  });
});
