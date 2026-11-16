import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1 class="title">⚔ Helios</h1>
        <p class="muted center">Entra a la taberna, aventurero.</p>

        <label>Email <input type="email" formControlName="email" autocomplete="email" /></label>
        <label>Contraseña <input type="password" formControlName="password" autocomplete="current-password" /></label>

        @if (error()) { <div class="alert error">{{ error() }}</div> }

        <button class="btn primary" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>
        <p class="muted center">¿No tienes cuenta? <a routerLink="/registro">Regístrate</a></p>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeRoute()),
      error: (e: HttpErrorResponse) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
