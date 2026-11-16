import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

const passwordsMatch = (g: AbstractControl): ValidationErrors | null =>
  g.get('password')?.value === g.get('password_confirmation')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1 class="title">Únete a Helios</h1>
        <p class="muted center">Tras registrarte, un admin revisará tu solicitud.</p>

        <label>Nombre <input formControlName="name" autocomplete="name" /></label>
        <label>Email <input type="email" formControlName="email" autocomplete="email" /></label>
        <label>Contraseña (mín. 8) <input type="password" formControlName="password" autocomplete="new-password" /></label>
        <label>Repite la contraseña <input type="password" formControlName="password_confirmation" autocomplete="new-password" /></label>

        @if (form.hasError('mismatch') && form.get('password_confirmation')?.touched) {
          <div class="alert error">Las contraseñas no coinciden.</div>
        }
        @if (error()) { <div class="alert error">{{ error() }}</div> }

        <button class="btn primary" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Creando cuenta…' : 'Registrarse' }}
        </button>
        <p class="muted center">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
      </form>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeRoute()),
      error: (e: HttpErrorResponse) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
