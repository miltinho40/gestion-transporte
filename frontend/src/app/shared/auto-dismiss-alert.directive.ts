import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Renderer2
} from '@angular/core';

@Directive({
  selector: '.alert, [appAutoDismissAlert]',
  standalone: true
})
export class AutoDismissAlertDirective implements OnInit, OnChanges, OnDestroy {
  @Input('appAutoDismissAlert') trigger: unknown;
  @Input() appAutoDismissAlertDelay = 4500;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;

  constructor(
    private readonly element: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2
  ) {}

  ngOnInit() {
    this.observer = new MutationObserver(() => this.showAndSchedule());
    this.observer.observe(this.element.nativeElement, {
      characterData: true,
      childList: true,
      subtree: true
    });
    this.showAndSchedule();
  }

  ngOnChanges() {
    this.showAndSchedule();
  }

  ngOnDestroy() {
    this.clearTimer();
    this.observer?.disconnect();
  }

  @HostListener('click')
  dismiss() {
    this.hide();
  }

  @HostListener('keydown.enter')
  dismissOnEnter() {
    this.hide();
  }

  private showAndSchedule() {
    this.clearTimer();
    this.renderer.removeStyle(this.element.nativeElement, 'display');
    this.renderer.setStyle(this.element.nativeElement, 'cursor', 'pointer');
    this.renderer.setAttribute(this.element.nativeElement, 'role', 'button');
    this.renderer.setAttribute(this.element.nativeElement, 'tabindex', '0');

    this.timer = setTimeout(() => this.hide(), this.appAutoDismissAlertDelay);
  }

  private hide() {
    this.clearTimer();
    this.renderer.setStyle(this.element.nativeElement, 'display', 'none');
  }

  private clearTimer() {
    if (!this.timer) return;

    clearTimeout(this.timer);
    this.timer = null;
  }
}
