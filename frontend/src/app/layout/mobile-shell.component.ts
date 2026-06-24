import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendarDays,
  LucideClipboardList,
  LucideDollarSign,
  LucideLogOut,
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
    LucideLogOut,
    LucideTruck,
    LucideWrench
  ],
  templateUrl: './mobile-shell.component.html',
  styleUrl: './mobile-shell.component.scss'
})
export class MobileShellComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
