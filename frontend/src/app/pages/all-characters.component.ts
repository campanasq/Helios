import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { Character } from '../core/models';
import { CharacterCardComponent } from './character-card.component';

@Component({
  selector: 'app-all-characters',
  imports: [CharacterCardComponent],
  template: `
    <div class="page-header">
      <h1 class="title">Personajes de los usuarios</h1>
      <input class="search" placeholder="Buscar por personaje, jugador, clase…" (input)="query.set($any($event.target).value)" />
    </div>

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (filtered().length === 0) { <div class="card empty">No hay personajes que mostrar.</div> }
    @else {
      <div class="cards">
        @for (c of filtered(); track c.id) { <app-character-card [character]="c" [showOwner]="true" /> }
      </div>
    }
  `,
})
export class AllCharactersComponent implements OnInit {
  private api = inject(ApiService);
  characters = signal<Character[]>([]);
  loading = signal(true);
  query = signal('');

  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.characters();
    return this.characters().filter((c) =>
      [c.name, c.race, c.class, c.user?.name].some((v) => v?.toLowerCase().includes(q)),
    );
  });

  ngOnInit() {
    this.api.allCharacters().subscribe({
      next: (cs) => { this.characters.set(cs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
