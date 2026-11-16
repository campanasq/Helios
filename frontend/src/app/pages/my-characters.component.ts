import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { Character } from '../core/models';
import { CharacterCardComponent } from './character-card.component';
import { CharacterFormComponent } from './character-form.component';

@Component({
  selector: 'app-my-characters',
  imports: [CharacterCardComponent, CharacterFormComponent],
  template: `
    <div class="page-header">
      <h1 class="title">Mis Personajes</h1>
      <button class="btn primary" (click)="openForm(null)">+ Nuevo personaje</button>
    </div>

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (characters().length === 0) {
      <div class="card empty">Aún no tienes personajes. ¡Crea el primero!</div>
    } @else {
      <div class="cards">
        @for (c of characters(); track c.id) {
          <app-character-card [character]="c">
            <div class="actions">
              <button class="btn ghost small" (click)="openForm(c)">Editar</button>
              <button class="btn danger small" (click)="remove(c)">Eliminar</button>
            </div>
          </app-character-card>
        }
      </div>
    }

    @if (formOpen()) {
      <app-character-form [character]="editing()" (saved)="onSaved($event)" (cancel)="formOpen.set(false)" />
    }
  `,
})
export class MyCharactersComponent implements OnInit {
  private api = inject(ApiService);
  characters = signal<Character[]>([]);
  loading = signal(true);
  formOpen = signal(false);
  editing = signal<Character | null>(null);

  ngOnInit() {
    this.api.myCharacters().subscribe({
      next: (cs) => { this.characters.set(cs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(c: Character | null) {
    this.editing.set(c);
    this.formOpen.set(true);
  }

  onSaved(c: Character) {
    this.characters.update((list) => {
      const i = list.findIndex((x) => x.id === c.id);
      return i >= 0 ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list];
    });
    this.formOpen.set(false);
  }

  remove(c: Character) {
    if (!confirm(`¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`)) return;
    this.api.deleteCharacter(c.id).subscribe(() => this.characters.update((l) => l.filter((x) => x.id !== c.id)));
  }
}
