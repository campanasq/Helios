import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ABILITIES, modifier, signed } from '../core/dnd';
import { GalleryCharacter } from '../core/models';

type GalleryFilter = 'all' | 'playable' | 'npc';

/** Galería de personajes: escenario en carrusel con todos los personajes jugables y NPCs que tienen retrato. */
@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <h1 class="title">Galería de personajes</h1>
      <div class="gallery-controls">
        <div class="segmented" role="group" aria-label="Filtrar tipo de personaje">
          <button type="button" [class.active]="filter() === 'all'" (click)="setFilter('all')">Todos</button>
          <button type="button" [class.active]="filter() === 'playable'" (click)="setFilter('playable')">Jugables</button>
          <button type="button" [class.active]="filter() === 'npc'" (click)="setFilter('npc')">NPCs</button>
        </div>
        @if (all().length > 1) {
          <input class="search" placeholder="Buscar personaje, clase, raza o jugador…" (input)="setQuery($any($event.target).value)" />
        }
      </div>
    </div>

    @if (loading()) {
      <p class="muted">Encendiendo las antorchas…</p>
    } @else if (all().length === 0) {
      <div class="card empty">
        <div class="big-icon">🕯️</div>
        <p>El salón está vacío. Sube el retrato PNG de tu personaje desde su hoja para que aparezca aquí.</p>
        <a class="btn primary" routerLink="/mis-personajes">Ir a Mis Personajes</a>
      </div>
    } @else if (list().length === 0) {
      <div class="card empty">Ningún personaje coincide con la búsqueda o el filtro.</div>
    } @else {
      @let sel = selected()!;
      <section class="hall">
        <!-- Escenario -->
        <div class="stage" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
          @for (c of list(); track c.id; let i = $index) {
            @let off = offset(i);
            @if (abs(off) <= 2) {
              <button type="button" class="figure" [class.center]="off === 0" [class.is-dead]="!c.is_npc && c.is_dead"
                [style.--off]="off" [style.--abs]="abs(off)" [style.z-index]="10 - abs(off)"
                (click)="select(i)" [attr.aria-label]="'Ver a ' + displayName(c)" [attr.aria-current]="off === 0">
                <img [src]="figureImageUrl(c, off === 0)" [alt]="displayName(c)" draggable="false" />
              </button>
            }
          }
          @if (list().length > 1) {
            <button type="button" class="stage-nav prev" (click)="move(-1)" aria-label="Personaje anterior">‹</button>
            <button type="button" class="stage-nav next" (click)="move(1)" aria-label="Personaje siguiente">›</button>
          }
          @if (selectedImages().length > 1) {
            <div class="stage-vnav-wrap">
              <button type="button" class="stage-vnav" (click)="moveImage(-1)" aria-label="Imagen anterior del personaje" title="Imagen anterior (↑)">▲</button>
              <span class="stage-vnav-count">{{ imageIndex() + 1 }} / {{ selectedImages().length }}</span>
              <button type="button" class="stage-vnav" (click)="moveImage(1)" aria-label="Siguiente imagen del personaje" title="Siguiente imagen (↓)">▼</button>
            </div>
          }
          <div class="stage-plaque">
            <span class="plaque-name">@if (!sel.is_npc && sel.is_dead) { 💀 }{{ displayName(sel) }}</span>
            @if (currentCaption(); as cap) {
              <span class="plaque-caption">{{ cap }}</span>
            }
            @if (plaqueSub(sel); as sub) {
              <span class="plaque-sub">{{ sub }}</span>
            }
          </div>
        </div>

        <!-- Ficha pública (respeta la visibilidad elegida por cada jugador o DM) -->
        @for (c of [sel]; track c.id) {
          <aside class="card parchment hero-card">
            <div class="badges" style="justify-content: space-between; align-items: center;">
              <p class="hero-kicker">Personaje {{ index() + 1 }} de {{ list().length }}</p>
              <div class="badges">
                @if (c.is_npc) { <span class="badge npc">NPC</span> }
                @if (!c.is_npc && c.is_dead) { <span class="badge dead">💀 Muerto</span> }
              </div>
            </div>
            <h2 class="title">{{ displayName(c) }}</h2>
            @if (heroSubtitle(c); as sub) {
              <p class="hero-sub">{{ sub }}</p>
            }

            @if (c.user || c.alignment || c.background) {
              <dl class="hero-facts">
                @if (c.user) { <div><dt>{{ c.is_npc ? 'DM' : 'Jugador' }}</dt><dd>{{ c.user.name }}</dd></div> }
                @if (c.alignment) { <div><dt>Alineamiento</dt><dd>{{ c.alignment }}</dd></div> }
                @if (c.background) { <div><dt>Trasfondo</dt><dd>{{ c.background }}</dd></div> }
              </dl>
            }

            @if (c.armor_class !== null || c.hit_points !== null) {
              <div class="hero-vitals">
                <div><span>CA</span><strong>{{ c.armor_class }}</strong></div>
                <div><span>PG máx.</span><strong>{{ c.hit_points }}</strong></div>
              </div>
            }

            @if (c.strength !== null) {
              <div class="stat-row">
                @for (a of abilities; track a.key) {
                  @let val = c[a.key]!;
                  <div class="stat"><span>{{ a.short }}</span><strong>{{ val }}</strong><small>{{ mod(val) }}</small></div>
                }
              </div>
            }

            @if (c.backstory) {
              <p class="hero-backstory">{{ c.backstory }}</p>
            }

            @if (isInfoHidden(c)) {
              <p class="muted small">Información adicional reservada.</p>
            }

            @if (canOpen(c)) {
              <a class="btn primary" [routerLink]="['/personajes', c.id]">Abrir hoja</a>
            }
          </aside>
        }
      </section>

      <!-- Alineación completa -->
      <section class="lineup-wrap">
        <h3 class="subtitle">Todos los personajes</h3>
        <div class="lineup">
          @for (c of list(); track c.id; let i = $index) {
            <button type="button" class="lineup-item" [class.active]="i === index()" [class.is-dead]="!c.is_npc && c.is_dead" (click)="select(i)">
              <img [src]="c.avatar_url" [alt]="displayName(c)" loading="lazy" draggable="false" />
              <span class="lineup-name">@if (!c.is_npc && c.is_dead) { 💀 }{{ displayName(c) }}</span>
              <span class="lineup-sub">{{ lineupSub(c) }}</span>
            </button>
          }
        </div>
      </section>
    }

    @if (withoutPortrait() > 0) {
      <p class="muted small center gallery-note">
        {{ withoutPortrait() }} {{ withoutPortrait() === 1 ? 'personaje aún no tiene' : 'personajes aún no tienen' }} retrato y no aparece{{ withoutPortrait() === 1 ? '' : 'n' }} en la galería.
      </p>
    }
  `,
})
export class GalleryComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  abilities = ABILITIES;
  mod = (v: number) => signed(modifier(v));
  abs = Math.abs;

  loading = signal(true);
  all = signal<GalleryCharacter[]>([]);
  withoutPortrait = signal(0);
  query = signal('');
  filter = signal<GalleryFilter>('all');
  index = signal(0);
  imageIndex = signal(0);

  hasNpcs = computed(() => this.all().some((c) => c.is_npc));

  list = computed(() => {
    const q = this.query().toLowerCase().trim();
    const f = this.filter();
    return this.all().filter((c) => {
      if (f === 'playable' && c.is_npc) return false;
      if (f === 'npc' && !c.is_npc) return false;
      if (!q) return true;
      return [c.name, c.race, c.class, c.user?.name].some((v) => v?.toLowerCase().includes(q));
    });
  });
  selected = computed(() => this.list()[this.index()] ?? null);
  selectedImages = computed(() => this.selected()?.gallery_images ?? []);
  currentCaption = computed(() => this.selectedImages()[this.imageIndex()]?.caption ?? null);

  private touchX = 0;

  ngOnInit() {
    this.api.gallery().subscribe({
      next: (r) => {
        this.all.set(r.characters);
        this.withoutPortrait.set(r.without_portrait);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  displayName(c: GalleryCharacter): string {
    return c.name ?? '???';
  }

  figureImageUrl(c: GalleryCharacter, isCenter: boolean): string | null {
    if (isCenter && c.gallery_images?.length) {
      return c.gallery_images[this.imageIndex()]?.url ?? c.gallery_images[0].url;
    }
    return c.gallery_images?.[0]?.url ?? c.avatar_url;
  }

  plaqueSub(c: GalleryCharacter): string {
    const parts: string[] = [];
    if (c.is_npc) parts.push('NPC');
    if (c.race) parts.push(c.race);
    if (c.class) parts.push(c.class);
    if (c.level !== null) parts.push(`Nv. ${c.level}`);
    if (!c.is_npc && c.is_dead) parts.push('Muerto');
    return parts.join(' · ');
  }

  heroSubtitle(c: GalleryCharacter): string {
    const parts: string[] = [];
    if (c.race) parts.push(c.race);
    if (c.class && c.level !== null) parts.push(`${c.class} de nivel ${c.level}`);
    else if (c.class) parts.push(c.class);
    else if (c.level !== null) parts.push(`Nivel ${c.level}`);
    return parts.join(' · ');
  }

  lineupSub(c: GalleryCharacter): string {
    if (!c.is_npc && c.is_dead) return 'Muerto';
    if (c.is_npc) return c.race ? `NPC · ${c.race}` : 'NPC';
    if (c.level !== null && c.class) return `Nv. ${c.level} · ${c.class}`;
    if (c.race) return c.race;
    return 'Personaje';
  }

  isInfoHidden(c: GalleryCharacter): boolean {
    return (
      !c.race && !c.class && c.level === null && !c.user && !c.alignment &&
      !c.background && c.armor_class === null && c.strength === null && !c.backstory
    );
  }

  /** Posición relativa al personaje seleccionado, de forma circular (… -2 -1 0 +1 +2 …). */
  offset(i: number): number {
    const n = this.list().length;
    let off = (((i - this.index()) % n) + n) % n;
    if (off > n / 2) off -= n;
    return off;
  }

  select(i: number) {
    if (i !== this.index()) this.imageIndex.set(0);
    this.index.set(i);
  }

  move(delta: number) {
    const n = this.list().length;
    if (n) {
      this.index.set((this.index() + delta + n) % n);
      this.imageIndex.set(0);
    }
  }

  moveImage(delta: number) {
    const n = this.selectedImages().length;
    if (n > 1) {
      this.imageIndex.set((this.imageIndex() + delta + n) % n);
    }
  }

  setQuery(q: string) {
    this.query.set(q);
    this.index.set(0);
    this.imageIndex.set(0);
  }

  setFilter(f: GalleryFilter) {
    this.filter.set(f);
    this.index.set(0);
    this.imageIndex.set(0);
  }

  canOpen(c: GalleryCharacter) {
    if (c.is_npc) return c.user_id === this.auth.user()?.id;
    return c.user_id === this.auth.user()?.id || this.auth.hasRole('dungeon_master');
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') this.move(-1);
    if (e.key === 'ArrowRight') this.move(1);
    if (e.key === 'ArrowUp' && this.selectedImages().length > 1) {
      e.preventDefault();
      this.moveImage(-1);
    }
    if (e.key === 'ArrowDown' && this.selectedImages().length > 1) {
      e.preventDefault();
      this.moveImage(1);
    }
  }

  touchStart(e: TouchEvent) { this.touchX = e.changedTouches[0].clientX; }
  touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchX;
    if (Math.abs(dx) > 40) this.move(dx < 0 ? 1 : -1);
  }
}
