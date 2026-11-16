import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { ROLE_LABELS, Role, User } from '../core/models';

type Filter = 'fila' | 'todos' | 'baja';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe],
  template: `
    <div class="page-header">
      <h1 class="title">Administración</h1>
      <div class="segmented">
        <button [class.active]="filter() === 'fila'" (click)="filter.set('fila')">En fila ({{ queued().length }})</button>
        <button [class.active]="filter() === 'todos'" (click)="filter.set('todos')">Usuarios activos</button>
        @if (auth.isSuperAdmin()) {
          <button [class.active]="filter() === 'baja'" (click)="filter.set('baja')">Dados de baja</button>
        }
      </div>
    </div>

    @if (message()) { <div class="alert" [class.error]="isError()">{{ message() }}</div> }

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (visible().length === 0) { <div class="card empty">No hay usuarios en esta lista.</div> }
    @else {
      <div class="card table-wrap">
        <table>
          <thead>
            <tr><th>Usuario</th><th>Registrado</th><th>Rol</th><th>Permisos</th><th class="right">Acciones</th></tr>
          </thead>
          <tbody>
            @for (u of visible(); track u.id) {
              <tr>
                <td><strong>{{ u.name }}</strong><br /><span class="muted small">{{ u.email }}</span></td>
                <td class="muted small">{{ u.created_at | date: 'dd/MM/yyyy' }}</td>
                <td>
                  @if (editable(u)) {
                    <select [value]="u.role" (change)="changeRole(u, $any($event.target).value)">
                      @for (r of roles; track r) { <option [value]="r" [selected]="r === u.role">{{ roleLabels[r] }}</option> }
                    </select>
                  } @else {
                    <span class="badge role-{{ u.role }}">{{ roleLabels[u.role] }}</span>
                  }
                </td>
                <td>
                  @if (u.is_superadmin) { <span class="badge gold">Superadmin</span> }
                  @else if (u.is_admin) { <span class="badge gold">Admin</span> }
                  @else { <span class="muted small">—</span> }
                </td>
                <td class="right actions-cell">
                  @if (u.role === 'en_fila' && editable(u) && u.is_active) {
                    <button class="btn primary small" (click)="changeRole(u, 'jugador')">Aceptar como Jugador</button>
                    <button class="btn ghost small" (click)="changeRole(u, 'dungeon_master')">Aceptar como DM</button>
                  }
                  @if (auth.isSuperAdmin() && !u.is_superadmin && u.id !== auth.user()?.id) {
                    @if (u.is_active) {
                      <button class="btn ghost small" (click)="toggleAdmin(u)">{{ u.is_admin ? 'Quitar admin' : 'Hacer admin' }}</button>
                      <button class="btn danger small" (click)="toggleActive(u)">Dar de baja</button>
                    } @else {
                      <button class="btn primary small" (click)="toggleActive(u)">Reactivar</button>
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminUsersComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  roles = Object.keys(ROLE_LABELS) as Role[];
  roleLabels = ROLE_LABELS;

  users = signal<User[]>([]);
  loading = signal(true);
  filter = signal<Filter>('fila');
  message = signal('');
  isError = signal(false);

  queued = computed(() => this.users().filter((u) => u.is_active && u.role === 'en_fila'));
  visible = computed(() => {
    switch (this.filter()) {
      case 'fila': return this.queued();
      case 'baja': return this.users().filter((u) => !u.is_active);
      default: return this.users().filter((u) => u.is_active);
    }
  });

  ngOnInit() {
    this.api.users().subscribe({
      next: (us) => { this.users.set(us); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Igual que en el backend: nadie toca al superadmin ni a sí mismo; solo el superadmin toca a admins. */
  editable(u: User): boolean {
    if (u.is_superadmin || u.id === this.auth.user()?.id) return false;
    if (u.is_admin && !this.auth.isSuperAdmin()) return false;
    return u.is_active;
  }

  changeRole(u: User, role: Role) {
    this.run(this.api.setRole(u.id, role), `${u.name} ahora es ${ROLE_LABELS[role]}.`);
  }

  toggleAdmin(u: User) {
    this.run(this.api.setAdmin(u.id, !u.is_admin), u.is_admin ? `${u.name} ya no es admin.` : `${u.name} ahora es admin.`);
  }

  toggleActive(u: User) {
    if (u.is_active && !confirm(`¿Dar de baja a ${u.name}? No podrá iniciar sesión.`)) return;
    this.run(this.api.setActive(u.id, !u.is_active), u.is_active ? `${u.name} ha sido dado de baja.` : `${u.name} ha sido reactivado.`);
  }

  private run(req: Observable<User>, okMsg: string) {
    req.subscribe({
      next: (updated) => {
        this.users.update((l) => l.map((x) => (x.id === updated.id ? updated : x)));
        this.flash(okMsg, false);
      },
      error: (e: HttpErrorResponse) => this.flash(errorMessage(e), true),
    });
  }

  private flash(msg: string, error: boolean) {
    this.message.set(msg);
    this.isError.set(error);
    setTimeout(() => this.message.set(''), 4000);
  }
}
