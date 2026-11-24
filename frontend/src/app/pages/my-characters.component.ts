import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { goldTotal } from '../core/dnd';
import { Character } from '../core/models';
import { CharacterCardComponent } from './character-card.component';

@Component({
  selector: 'app-my-characters',
  imports: [CharacterCardComponent, RouterLink],
  template: `
    <div class="page-header">
      <h1 class="title">Mis Personajes</h1>
      <div class="header-actions">
        @if (isDm()) {
          <div class="segmented" role="group" aria-label="Filtrar mis personajes">
            <button type="button" [class.active]="filter() === 'all'" (click)="filter.set('all')">Todos</button>
            <button type="button" [class.active]="filter() === 'playable'" (click)="filter.set('playable')">Jugables</button>
            <button type="button" [class.active]="filter() === 'npc'" (click)="filter.set('npc')">NPCs</button>
          </div>
        }
        @if (canCreatePlayable()) {
          <a class="btn primary" routerLink="/personajes/nuevo">
            {{ isDm() ? '+ Nuevo PJ principal' : '+ Nuevo personaje' }}
          </a>
        } @else {
          <span class="badge">Ya tenés tu PJ principal vivo (máx. 1)</span>
        }
        @if (isDm()) {
          <a class="btn ghost" routerLink="/personajes/nuevo" [queryParams]="{ tipo: 'npc' }">+ Nuevo NPC</a>
        }
      </div>
    </div>

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (characters().length === 0) {
      <div class="card empty">Aún no tienes personajes. ¡Crea el primero!</div>
    } @else if (sorted().length === 0) {
      <div class="card empty">No hay personajes en este filtro.</div>
    } @else {
      <div class="cards">
        @for (c of sorted(); track c.id) {
          <app-character-card [character]="c" [markPrincipal]="isDm()">
            <div class="actions">
              <a class="btn ghost small" [routerLink]="['/personajes', c.id]">{{ !c.is_npc && c.is_dead ? 'Ver hoja' : 'Abrir hoja' }}</a>
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
  private auth = inject(AuthService);

  characters = signal<Character[]>([]);
  loading = signal(true);
  filter = signal<'all' | 'playable' | 'npc'>('all');

  isDm = computed(() => this.auth.hasRole('dungeon_master'));
  alivePlayable = computed(() => this.characters().find((c) => !c.is_npc && !c.is_dead) ?? null);
  canCreatePlayable = computed(() => !this.alivePlayable());
  sorted = computed(() => {
    const f = this.filter();
    return [...this.characters()]
      .filter((c) => (f === 'all' ? true : f === 'npc' ? c.is_npc : !c.is_npc))
      .sort((a, b) => {
        const rank = (c: Character) => (!c.is_npc && !c.is_dead ? 0 : c.is_npc ? 1 : 2);
        return rank(a) - rank(b);
      });
  });

  ngOnInit() {
    this.api.myCharacters().subscribe({
      next: (cs) => {
        this.characters.set(cs);
        const alive = cs.find((c) => !c.is_npc && !c.is_dead);
        this.auth.setGoldTotal(alive ? goldTotal(alive.sheet?.money) : 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  remove(c: Character) {
    if (!confirm(`¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`)) return;
    this.api.deleteCharacter(c.id).subscribe(() => {
      this.characters.update((l) => l.filter((x) => x.id !== c.id));
      if (!c.is_npc && !c.is_dead) this.auth.setGoldTotal(0);
    });
  }
}
