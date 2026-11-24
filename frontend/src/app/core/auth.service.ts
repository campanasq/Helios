import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, Role, User } from './models';

const TOKEN_KEY = 'helios_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => !!this.user()?.is_admin || !!this.user()?.is_superadmin);
  readonly isSuperAdmin = computed(() => !!this.user()?.is_superadmin);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasRole(...roles: Role[]): boolean {
    const u = this.user();
    return !!u && roles.includes(u.role);
  }

  /** Se ejecuta al arrancar la app: recupera la sesión si hay token guardado. */
  restoreSession(): Promise<unknown> {
    if (!this.token) return Promise.resolve();
    return firstValueFrom(this.refreshUser());
  }

  refreshUser(): Observable<User | null> {
    return this.http.get<User>(`${environment.apiUrl}/me`).pipe(
      tap((u) => this.user.set(u)),
      catchError(() => {
        this.clear();
        return of(null);
      }),
    );
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/login`, { email, password })
      .pipe(map((r) => this.store(r)));
  }

  register(data: { name: string; email: string; password: string; password_confirmation: string }): Observable<User> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/register`, data)
      .pipe(map((r) => this.store(r)));
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/logout`, {}).subscribe({ error: () => {} });
    this.clear();
    this.router.navigate(['/login']);
  }

  /** Actualiza en memoria el oro total del perfil cuando cambia la billetera del PJ principal vivo. */
  setGoldTotal(gold: number): void {
    this.user.update((u) => (u ? { ...u, gold_total: gold } : null));
  }

  /** Ruta inicial según el rol del usuario. */
  homeRoute(): string {
    const u = this.user();
    if (!u) return '/login';
    if (u.role === 'en_fila') return u.is_admin || u.is_superadmin ? '/admin' : '/en-espera';
    return '/mis-personajes';
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  private store(r: AuthResponse): User {
    localStorage.setItem(TOKEN_KEY, r.token);
    this.user.set(r.user);
    return r.user;
  }
}
