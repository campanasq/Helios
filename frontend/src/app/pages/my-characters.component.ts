import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Character } from '../core/models';
import { CharacterCardComponent } from './character-card.component';

@Component({
  selector: 'app-my-characters',
  imports: [CharacterCardComponent, RouterLink],
  template: `
    <div class="page-header">
      <h1 class="title">Mis Personajes</h1>
      <a class="btn primary" routerLink="/personajes/nuevo">+ Nuevo personaje</a>
    </div>

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (characters().length === 0) {
      <div class="card empty">Aún no tienes personajes. ¡Crea el primero!</div>
    } @else {
      <div class="cards">
        @for (c of characters(); track c.id) {
          <app-character-card [character]="c">
            <div class="actions">
              <a class="btn ghost small" [routerLink]="['/personajes', c.id]">Abrir hoja</a>
              <button class="btn danger small" (click)="remove(c)">Eliminar</button>
            </div>
          </app-character-card>
        }
      </div>
    }
  `,
})
export class MyCharactersComponent implements OnInit {
  private api = inject(ApiService);
  characters = signal<Character[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.myCharacters().subscribe({
      next: (cs) => { this.characters.set(cs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  remove(c: Character) {
    if (!confirm(`¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`)) return;
    this.api.deleteCharacter(c.id).subscribe(() => this.characters.update((l) => l.filter((x) => x.id !== c.id)));
  }
}
