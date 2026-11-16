import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ABILITIES, modifier, signed } from '../core/dnd';
import { Character } from '../core/models';

@Component({
  selector: 'app-character-card',
  imports: [RouterLink],
  template: `
    @let c = character();
    <article class="card char-card">
      <a class="char-portrait" [routerLink]="['/personajes', c.id]" [attr.aria-label]="'Abrir hoja de ' + c.name">
        @if (c.avatar_url) { <img [src]="c.avatar_url" [alt]="'Retrato de ' + c.name" loading="lazy" /> }
        @else { <span>🧙</span> }
      </a>
      <div class="char-body">
        <header>
          <h3><a [routerLink]="['/personajes', c.id]">{{ c.name }}</a></h3>
          <span class="badge">Nv. {{ c.level }}</span>
        </header>
        <p class="muted">{{ c.race }} · {{ c.class }}@if (c.alignment) { · {{ c.alignment }} }</p>
        @if (c.user && showOwner()) { <p class="owner">Jugador: <strong>{{ c.user.name }}</strong></p> }
        <div class="stat-row">
          @for (a of abilities; track a.key) {
            <div class="stat"><span>{{ a.short }}</span><strong>{{ c[a.key] }}</strong><small>{{ mod(c[a.key]) }}</small></div>
          }
        </div>
        <p class="vitals">❤ {{ c.sheet.hp_current }}/{{ c.hit_points }} PG · 🛡 CA {{ c.armor_class }}</p>
        <ng-content />
      </div>
    </article>
  `,
})
export class CharacterCardComponent {
  character = input.required<Character>();
  showOwner = input(false);
  abilities = ABILITIES;
  mod = (v: number) => signed(modifier(v));
}
