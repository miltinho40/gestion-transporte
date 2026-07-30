import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendarDays,
  LucideClipboardList,
  LucideDollarSign,
  LucideHandshake,
  LucideLogOut,
  LucideSparkles,
  LucideTruck,
  LucideWrench
} from '@lucide/angular';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-mobile-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideCalendarDays,
    LucideClipboardList,
    LucideDollarSign,
    LucideHandshake,
    LucideLogOut,
    LucideSparkles,
    LucideTruck,
    LucideWrench
  ],
  templateUrl: './mobile-shell.component.html',
  styleUrl: './mobile-shell.component.scss'
})
export class MobileShellComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly isPropietario = computed(() => this.auth.hasOwnFleet());
  readonly isIntermediario = computed(() => this.auth.isIntermediary());

  canOwnFleet(permission: string) {
    return this.isPropietario() && this.auth.hasMenuPermission(permission);
  }

  canIntermediario(permission: string) {
    return this.isIntermediario() && this.auth.hasMenuPermission(permission);
  }

  hasPermission(permission: string) {
    return this.auth.hasMenuPermission(permission);
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
