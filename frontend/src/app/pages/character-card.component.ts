import { Component, input } from '@angular/core';
import { Character } from '../core/models';
import { STATS } from './character-form.component';

@Component({
  selector: 'app-character-card',
  template: `
    @let c = character();
    <article class="card char-card">
      <header>
        <h3>{{ c.name }}</h3>
        <span class="badge">Nv. {{ c.level }}</span>
      </header>
      <p class="muted">{{ c.race }} · {{ c.class }}@if (c.alignment) { · {{ c.alignment }} }</p>
      @if (c.user && showOwner()) { <p class="owner">Jugador: <strong>{{ c.user.name }}</strong></p> }
      <div class="stat-row">
        @for (s of stats; track s.key) {
          <div class="stat"><span>{{ s.label }}</span><strong>{{ c[s.key] }}</strong><small>{{ mod(c[s.key]) }}</small></div>
        }
      </div>
      <p class="vitals">❤ {{ c.hit_points }} PG · 🛡 CA {{ c.armor_class }}</p>
      @if (c.backstory) { <p class="backstory">{{ c.backstory }}</p> }
      <ng-content />
    </article>
  `,
})
export class CharacterCardComponent {
  character = input.required<Character>();
  showOwner = input(false);
  stats = STATS;
  mod(v: number) {
    const m = Math.floor((v - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  }
}
