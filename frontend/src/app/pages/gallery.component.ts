import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ABILITIES, modifier, signed } from '../core/dnd';
import { GalleryCharacter } from '../core/models';

/** Galería de héroes: escenario en carrusel con todos los personajes que tienen retrato. */
@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <h1 class="title">Galería de héroes</h1>
      @if (all().length > 1) {
        <input class="search" placeholder="Buscar héroe, clase, raza o jugador…" (input)="setQuery($any($event.target).value)" />
      }
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
      <div class="card empty">Ningún héroe coincide con la búsqueda.</div>
    } @else {
      @let sel = selected()!;
      <section class="hall">
        <!-- Escenario -->
        <div class="stage" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
          @for (c of list(); track c.id; let i = $index) {
            @let off = offset(i);
            @if (abs(off) <= 2) {
              <button type="button" class="figure" [class.center]="off === 0"
                [style.--off]="off" [style.--abs]="abs(off)" [style.z-index]="10 - abs(off)"
                (click)="select(i)" [attr.aria-label]="'Ver a ' + c.name" [attr.aria-current]="off === 0">
                <img [src]="c.avatar_url" [alt]="c.name" draggable="false" />
              </button>
            }
          }
          @if (list().length > 1) {
            <button type="button" class="stage-nav prev" (click)="move(-1)" aria-label="Héroe anterior">‹</button>
            <button type="button" class="stage-nav next" (click)="move(1)" aria-label="Héroe siguiente">›</button>
          }
          <div class="stage-plaque">
            <span class="plaque-name">{{ sel.name }}</span>
            <span class="plaque-sub">{{ sel.race }} · {{ sel.class }} · Nv. {{ sel.level }}</span>
          </div>
        </div>

        <!-- Ficha -->
        @for (c of [sel]; track c.id) {
          <aside class="card parchment hero-card">
            <p class="hero-kicker">Héroe {{ index() + 1 }} de {{ list().length }}</p>
            <h2 class="title">{{ c.name }}</h2>
            <p class="hero-sub">{{ c.race }} · {{ c.class }} de nivel {{ c.level }}</p>
            <dl class="hero-facts">
              <div><dt>Jugador</dt><dd>{{ c.user?.name ?? '—' }}</dd></div>
              @if (c.alignment) { <div><dt>Alineamiento</dt><dd>{{ c.alignment }}</dd></div> }
              @if (c.background) { <div><dt>Trasfondo</dt><dd>{{ c.background }}</dd></div> }
            </dl>
            <div class="hero-vitals">
              <div><span>CA</span><strong>{{ c.armor_class }}</strong></div>
              <div><span>PG máx.</span><strong>{{ c.hit_points }}</strong></div>
            </div>
            <div class="stat-row">
              @for (a of abilities; track a.key) {
                <div class="stat"><span>{{ a.short }}</span><strong>{{ c[a.key] }}</strong><small>{{ mod(c[a.key]) }}</small></div>
              }
            </div>
            @if (canOpen(c)) {
              <a class="btn primary" [routerLink]="['/personajes', c.id]">Abrir hoja</a>
            }
          </aside>
        }
      </section>

      <!-- Alineación completa -->
      <section class="lineup-wrap">
        <h3 class="subtitle">Todos los héroes</h3>
        <div class="lineup">
          @for (c of list(); track c.id; let i = $index) {
            <button type="button" class="lineup-item" [class.active]="i === index()" (click)="select(i)">
              <img [src]="c.avatar_url" [alt]="c.name" loading="lazy" draggable="false" />
              <span class="lineup-name">{{ c.name }}</span>
              <span class="lineup-sub">Nv. {{ c.level }} · {{ c.class }}</span>
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
  index = signal(0);

  list = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.all();
    return this.all().filter((c) =>
      [c.name, c.race, c.class, c.user?.name].some((v) => v?.toLowerCase().includes(q)),
    );
  });
  selected = computed(() => this.list()[this.index()] ?? null);

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

  /** Posición relativa al héroe seleccionado, de forma circular (… -2 -1 0 +1 +2 …). */
  offset(i: number): number {
    const n = this.list().length;
    let off = (((i - this.index()) % n) + n) % n;
    if (off > n / 2) off -= n;
    return off;
  }

  select(i: number) { this.index.set(i); }

  move(delta: number) {
    const n = this.list().length;
    if (n) this.index.set((this.index() + delta + n) % n);
  }

  setQuery(q: string) {
    this.query.set(q);
    this.index.set(0);
  }

  canOpen(c: GalleryCharacter) {
    return c.user_id === this.auth.user()?.id || this.auth.hasRole('dungeon_master');
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') this.move(-1);
    if (e.key === 'ArrowRight') this.move(1);
  }

  touchStart(e: TouchEvent) { this.touchX = e.changedTouches[0].clientX; }
  touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchX;
    if (Math.abs(dx) > 40) this.move(dx < 0 ? 1 : -1);
  }
}
