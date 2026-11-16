import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-waiting',
  template: `
    <div class="card waiting">
      <div class="big-icon">⏳</div>
      <h2 class="title">Estás en la fila</h2>
      <p>Tu cuenta está pendiente de aprobación. Un administrador revisará tu solicitud y te asignará un rol.</p>
      <p class="muted">Mientras tanto no podrás acceder al resto de la página.</p>
      <button class="btn primary" (click)="check()" [disabled]="checking()">
        {{ checking() ? 'Comprobando…' : 'Comprobar de nuevo' }}
      </button>
      @if (stillWaiting()) { <p class="muted">Todavía sin respuesta. ¡Paciencia, aventurero!</p> }
    </div>
  `,
})
export class WaitingComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  checking = signal(false);
  stillWaiting = signal(false);

  check() {
    this.checking.set(true);
    this.auth.refreshUser().subscribe((u) => {
      this.checking.set(false);
      if (u && u.role !== 'en_fila') this.router.navigateByUrl(this.auth.homeRoute());
      else this.stillWaiting.set(true);
    });
  }
}
