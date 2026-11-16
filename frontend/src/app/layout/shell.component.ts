import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ROLE_LABELS } from '../core/models';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <div class="brand">⚔ Helios</div>

      <nav class="tabs">
        @if (auth.hasRole('jugador', 'dungeon_master')) {
          <a routerLink="/mis-personajes" routerLinkActive="active">Mis Personajes</a>
        }
        @if (auth.hasRole('dungeon_master')) {
          <a routerLink="/personajes-usuarios" routerLinkActive="active">Personajes de los usuarios</a>
        }
        @if (auth.hasRole('jugador', 'dungeon_master')) {
          <a routerLink="/galeria" routerLinkActive="active">Galería de héroes</a>
          <a routerLink="/misiones" routerLinkActive="active">Misiones</a>
        }
        @if (auth.isAdmin()) {
          <a routerLink="/admin" routerLinkActive="active">Administración</a>
        }
      </nav>

      <div class="user-box">
        <div class="user-info">
          <span class="user-name">{{ auth.user()?.name }}</span>
          <span class="badges">
            <span class="badge role-{{ auth.user()?.role }}">{{ roleLabel() }}</span>
            @if (auth.isSuperAdmin()) { <span class="badge gold">Superadmin</span> }
            @else if (auth.isAdmin()) { <span class="badge gold">Admin</span> }
          </span>
        </div>
        <button class="btn ghost small" (click)="auth.logout()">Salir</button>
      </div>
    </header>

    <main class="container">
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return r ? ROLE_LABELS[r] : '';
  });
}
