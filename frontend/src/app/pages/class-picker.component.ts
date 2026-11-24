import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ABILITIES, Ability, modifier, signed } from '../core/dnd';
import { DND_CLASSES, DndClassInfo } from '../core/dnd-classes';
import { RolledStats } from './ability-roller.component';

/**
 * Paso 2 de 3 en la creación de personaje jugable:
 * Selector de clase (12 clases del Manual del Jugador + Artífice)
 * con pixel art 16×16, etiquetas de alcance/magia/rol y descripción motivadora al pasar el mouse.
 */
@Component({
  selector: 'app-class-picker',
  imports: [RouterLink],
  template: `
    <div class="roller-wrap">
      <div class="sheet-toolbar">
        <a class="btn ghost small" routerLink="/mis-personajes">← Cancelar</a>
        <div class="spacer"></div>
        <span class="badge gold">Paso 2 de 3 · Elegí tu clase</span>
      </div>

      <section class="card parchment class-picker-card">
        <header class="roller-head">
          <div>
            <h1 class="title">Elegí la clase de tu personaje</h1>
            <p class="muted">
              Pasá el mouse por cada clase para conocer su estilo. Una vez creado el personaje,
              <strong>tu clase quedará fija en la hoja</strong>.
            </p>
          </div>

          <!-- Resumen compacto de los stats recién tirados en Paso 1 -->
          @if (stats(); as st) {
            <div class="picked-stats-mini" aria-label="Características obtenidas en las tiradas">
              @for (a of abilities; track a.key) {
                <div class="mini-stat" [class.highlighted]="isPrimary(a.key)">
                  <span>{{ a.short }}</span>
                  <strong>{{ st[a.key] }}</strong>
                  <small>{{ mod(st[a.key]) }}</small>
                </div>
              }
            </div>
          }
        </header>

        <!-- Panel motivador en vivo (hover o clase seleccionada) -->
        @let preview = previewClass();
        <div class="class-preview-banner" [style.--cls-accent]="preview.accent">
          <div class="preview-art-frame">
            <svg class="pixel-art big" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
              @for (px of preview.pixels; track $index) {
                <rect [attr.x]="px.x" [attr.y]="px.y" width="1" height="1" [attr.fill]="px.fill" />
              }
            </svg>
          </div>

          <div class="preview-body">
            <div class="preview-head">
              <h2 class="title">{{ preview.name }}</h2>
              <span class="preview-tagline">{{ preview.tagline }}</span>
            </div>

            <div class="badges">
              <span class="badge combat-{{ combatKey(preview.combat) }}">
                {{ preview.combat === 'Rango' ? '🏹' : '⚔' }} {{ preview.combat }}
              </span>
              <span class="badge" [class.magic-yes]="preview.spellcaster" [class.magic-no]="!preview.spellcaster">
                {{ preview.spellcaster ? '✨ ' + preview.spellcasterLabel : '🛡 No spellcaster' }}
              </span>
              <span class="badge role-tag">🎯 {{ preview.role }}</span>
              <span class="badge hit-dice">🎲 Dado de golpe {{ preview.hitDice }}</span>
              <span class="badge key-stat">⭐ Clave: {{ primaryLabels(preview) }}</span>
            </div>

            <p class="preview-desc">{{ preview.description }}</p>
          </div>
        </div>

        <!-- Grilla de las 13 clases -->
        <div class="class-grid">
          @for (cls of classes; track cls.name) {
            <button
              type="button"
              class="class-card-btn"
              [class.selected]="selected()?.name === cls.name"
              [style.--cls-accent]="cls.accent"
              (mouseenter)="hovered.set(cls)"
              (focus)="hovered.set(cls)"
              (mouseleave)="hovered.set(null)"
              (click)="selected.set(cls)">
              <div class="class-card-top">
                <div class="pixel-box">
                  <svg class="pixel-art" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
                    @for (px of cls.pixels; track $index) {
                      <rect [attr.x]="px.x" [attr.y]="px.y" width="1" height="1" [attr.fill]="px.fill" />
                    }
                  </svg>
                </div>
                <div class="class-card-title">
                  <strong>{{ cls.name }}</strong>
                  <span class="muted tiny">{{ cls.hitDice }} · {{ primaryShort(cls) }}</span>
                </div>
              </div>

              <div class="class-tags">
                <span class="cls-tag combat-{{ combatKey(cls.combat) }}">{{ cls.combat }}</span>
                <span class="cls-tag" [class.magic-yes]="cls.spellcaster" [class.magic-no]="!cls.spellcaster">
                  {{ cls.spellcaster ? 'Spellcaster' : 'No spellcaster' }}
                </span>
                <span class="cls-tag role">{{ cls.role }}</span>
              </div>
            </button>
          }
        </div>

        <footer class="roller-footer">
          <p class="muted small">
            @if (selected(); as sel) {
              Clase elegida: <strong>{{ sel.name }}</strong> (precarga dado de golpe {{ sel.hitDice }} y salvaciones).
            } @else {
              Hacé clic en una clase para seleccionarla y pasar a la hoja del personaje.
            }
          </p>
          <button type="button" class="btn primary" [disabled]="!selected()" (click)="confirm()">
            Continuar a la hoja como {{ selected()?.name || '…' }} →
          </button>
        </footer>
      </section>
    </div>
  `,
})
export class ClassPickerComponent {
  stats = input<RolledStats | null>(null);
  completed = output<DndClassInfo>();

  abilities = ABILITIES;
  classes = DND_CLASSES;

  hovered = signal<DndClassInfo | null>(null);
  selected = signal<DndClassInfo | null>(null);

  /** Muestra la clase bajo el mouse; si no hay hover, la seleccionada o la primera. */
  previewClass = computed(() => this.hovered() ?? this.selected() ?? this.classes[0]);

  mod = (score: number) => signed(modifier(score));

  combatKey(combat: DndClassInfo['combat']): string {
    return combat === 'Melee' ? 'melee' : combat === 'Rango' ? 'rango' : 'hibrido';
  }

  isPrimary(key: Ability): boolean {
    return this.previewClass().primaryAbilities.includes(key);
  }

  primaryLabels(cls: DndClassInfo): string {
    return cls.primaryAbilities
      .map((k) => ABILITIES.find((a) => a.key === k)?.label ?? k)
      .join(' y ');
  }

  primaryShort(cls: DndClassInfo): string {
    return cls.primaryAbilities
      .map((k) => ABILITIES.find((a) => a.key === k)?.short ?? k)
      .join('/');
  }

  confirm() {
    const sel = this.selected();
    if (sel) this.completed.emit(sel);
  }
}
