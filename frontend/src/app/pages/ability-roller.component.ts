import { Component, OnDestroy, computed, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ABILITIES, Ability, modifier, signed } from '../core/dnd';

export interface AbilityRoll {
  id: number;
  dice: number[];
  droppedIndex: number;
  total: number;
  rerolledFrom?: number;
}

export type RolledStats = Record<Ability, number>;

interface TrayDie {
  value: number;
  rotX: number;
  rotY: number;
  durationMs: number;
  delayMs: number;
  dropped: boolean;
}

/** Rotación exacta del cubo para dejar cada cara (1..6) mirando al frente. */
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

/** Posiciones de puntos (1..9 en grilla 3x3) para cada cara de un d6. */
const FACE_PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function roll4d6DropLowest(id: number): AbilityRoll {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  let droppedIndex = 0;
  for (let i = 1; i < dice.length; i++) {
    if (dice[i] < dice[droppedIndex]) droppedIndex = i;
  }
  const total = dice.reduce((sum, val, i) => (i === droppedIndex ? sum : sum + val), 0);
  return { id, dice, droppedIndex, total };
}

/**
 * Paso 1 de creación de personaje:
 * - Bandeja con 4 dados d6 3D en CSS y sonido sintético (Web Audio API).
 * - 6 tiradas de 4d6 descartando el dado más bajo.
 * - Asignación e intercambio libre entre las 6 características.
 * - 1 solo reroll en toda la creación (te quedás con el último valor que salga).
 */
@Component({
  selector: 'app-ability-roller',
  imports: [RouterLink],
  template: `
    <div class="roller-wrap">
      <div class="sheet-toolbar">
        <a class="btn ghost small" routerLink="/mis-personajes">← Volver</a>
        <div class="spacer"></div>
        <button
          type="button"
          class="btn ghost small"
          (click)="soundEnabled.set(!soundEnabled())"
          [attr.aria-pressed]="soundEnabled()">
          {{ soundEnabled() ? '🔊 Sonido activado' : '🔇 Sonido silenciado' }}
        </button>
        <span class="badge gold">Paso 1 de 2 · Tiradas de características</span>
      </div>

      <section class="card parchment roller-card">
        <header class="roller-head">
          <div>
            <h1 class="title">Tirador de características (4d6)</h1>
            <p class="muted">
              Tirá <strong>4 dados de 6 caras</strong> seis veces (se descarta automáticamente el dado más bajo).
              Después asigná o intercambiá cada puntaje entre tus características.
            </p>
          </div>
          <div class="roller-controls">
            @if (rolls().length < 6) {
              <button type="button" class="btn primary" [disabled]="rolling()" (click)="rollNext()">
                🎲 {{ rolling() ? 'Tirando…' : 'Tirar 4d6 (' + (rolls().length + 1) + '/6)' }}
              </button>
              <button type="button" class="btn ghost" [disabled]="rolling()" (click)="rollRemaining()">
                Tirar restantes
              </button>
            } @else {
              <span class="badge gold">6/6 tiradas listas</span>
            }
          </div>
        </header>

        <!-- Bandeja de dados 3D -->
        <div class="dice-tray" [class.rolling]="rolling()">
          <div class="tray-caption">
            <span>{{ trayLabel() }}</span>
            @if (!rolling() && lastResult(); as res) {
              <span class="tray-result">
                Total: <strong>{{ res.total }}</strong>
                @if (res.rerolledFrom !== undefined) {
                  <small> (antes {{ res.rerolledFrom }})</small>
                }
              </span>
            }
          </div>

          <div class="tray-dice">
            @for (d of trayDice(); track $index) {
              <div class="die-slot" [class.dropped]="!rolling() && d.dropped">
                <div class="die-bounce" [class.toss-a]="tossParity() === 1" [class.toss-b]="tossParity() === 2" [style.--delay.ms]="d.delayMs">
                  <div class="die-scene">
                    <div
                      class="die-cube"
                      [style.transform]="'rotateX(' + d.rotX + 'deg) rotateY(' + d.rotY + 'deg)'"
                      [style.transition-duration.ms]="d.durationMs">
                      @for (face of faces; track face) {
                        <div class="die-face face-{{ face }}">
                          @for (cell of pipCells; track cell) {
                            <span class="pip" [class.on]="hasPip(face, cell)"></span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
                <span class="die-tag">
                  @if (rolling()) {
                    …
                  } @else if (d.dropped) {
                    Descartado ({{ d.value }})
                  } @else if (hasRolledOnce()) {
                    {{ d.value }}
                  } @else {
                    d6
                  }
                </span>
              </div>
            }
          </div>
        </div>

        <!-- Tiradas realizadas -->
        <div class="rolls-section">
          <div class="section-row">
            <h2 class="subtitle">Tiradas realizadas ({{ rolls().length }}/6)</h2>
            <span class="reroll-status" [class.used]="rerollUsed()">
              @if (!rerollUsed()) {
                🎯 1 reroll disponible (te quedás con el último resultado)
              } @else {
                🔒 Reroll ya utilizado
              }
            </span>
          </div>

          <div class="rolls-grid">
            @for (slot of slots; track slot) {
              @let r = rolls()[slot];
              @if (r) {
                <div class="roll-box" [class.assigned]="assignedAbilityFor(r.id) !== null" [class.rerolled]="r.rerolledFrom !== undefined">
                  <div class="roll-top">
                    <span class="roll-idx">Tirada #{{ r.id + 1 }}</span>
                    @if (assignedAbilityFor(r.id); as ab) {
                      <span class="badge gold">{{ abilityShort(ab) }}</span>
                    } @else {
                      <span class="muted tiny">Sin asignar</span>
                    }
                  </div>

                  <strong class="roll-total">{{ r.total }}</strong>

                  <div class="dice-list" [attr.aria-label]="'Dados: ' + r.dice.join(', ')">
                    @for (d of r.dice; track $index) {
                      <span class="die" [class.dropped]="$index === r.droppedIndex" [title]="$index === r.droppedIndex ? 'Dado más bajo (descartado)' : 'Dado sumado'">
                        {{ d }}
                      </span>
                    }
                  </div>

                  @if (r.rerolledFrom !== undefined) {
                    <span class="reroll-note">Reroll: {{ r.rerolledFrom }} → {{ r.total }}</span>
                  }

                  @if (allRolled() && !rerollUsed()) {
                    <button type="button" class="btn ghost small reroll-btn" [disabled]="rolling()" (click)="askReroll(r.id)">
                      ↻ Reroll
                    </button>
                  }
                </div>
              } @else {
                <div class="roll-box empty-slot">
                  <span class="roll-idx">Tirada #{{ slot + 1 }}</span>
                  <span class="muted">?</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- Menú de asignación e intercambio -->
        @if (allRolled()) {
          <div class="assign-section">
            <div class="section-row">
              <div>
                <h2 class="subtitle">Asignar características</h2>
                <p class="muted small">
                  Elegí qué tirada va en cada característica usando el menú (si ya está en otra, se intercambian solas)
                  o hacé clic en dos características para intercambiarlas.
                </p>
              </div>
              <div class="assign-actions">
                <button type="button" class="btn ghost small" [disabled]="rolling()" (click)="autoAssign()">Asignar en orden</button>
                <button type="button" class="btn ghost small" [disabled]="rolling()" (click)="clearAssignments()">Limpiar</button>
              </div>
            </div>

            @if (swapSource(); as src) {
              <div class="alert warn">
                Elegí otra característica para intercambiarla con <strong>{{ abilityLabel(src) }}</strong>
                <button type="button" class="btn ghost small" (click)="swapSource.set(null)">Cancelar</button>
              </div>
            }

            <div class="assign-grid">
              @for (a of abilities; track a.key) {
                @let rollId = assignments()[a.key];
                @let score = rollId !== null ? rollById(rollId)?.total ?? null : null;
                <div class="assign-card" [class.swap-selected]="swapSource() === a.key" [class.filled]="score !== null">
                  <div class="assign-card-head">
                    <div>
                      <span class="ab-short">{{ a.short }}</span>
                      <strong>{{ a.label }}</strong>
                    </div>
                    <button
                      type="button"
                      class="btn ghost small"
                      (click)="toggleSwap(a.key)"
                      [disabled]="rolling() || (score === null && swapSource() === null)"
                      [title]="swapSource() === a.key ? 'Cancelar intercambio' : 'Intercambiar con otra característica'">
                      {{ swapSource() === a.key ? 'Cancelar' : swapSource() ? '⇄ Aquí' : '⇄' }}
                    </button>
                  </div>

                  <div class="assign-score">
                    @if (score !== null) {
                      <strong>{{ score }}</strong>
                      <span class="mod-pill">{{ mod(score) }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </div>

                  <select
                    [disabled]="rolling()"
                    [value]="rollId === null ? '' : rollId"
                    (change)="assign(a.key, $any($event.target).value)"
                    [attr.aria-label]="'Asignar tirada a ' + a.label">
                    <option value="">Elegir tirada…</option>
                    @for (r of rolls(); track r.id) {
                      @let owner = assignedAbilityFor(r.id);
                      <option [value]="r.id">
                        {{ r.total }} (Tirada #{{ r.id + 1 }}{{ owner && owner !== a.key ? ' · en ' + abilityShort(owner) : '' }})
                      </option>
                    }
                  </select>
                </div>
              }
            </div>
          </div>

          <footer class="roller-footer">
            <p class="muted small">
              Después vas a poder ajustar estos puntajes en la hoja si tu raza o nivel suma bonificadores.
            </p>
            <button type="button" class="btn primary" [disabled]="!allAssigned() || rolling()" (click)="confirm()">
              Continuar a la hoja del personaje →
            </button>
          </footer>
        }
      </section>
    </div>

    <!-- Modal de confirmación de reroll único -->
    @if (pendingRerollId() !== null) {
      @let r = rollById(pendingRerollId()!)!;
      @let ab = assignedAbilityFor(r.id);
      <div class="modal-backdrop" (click)="pendingRerollId.set(null)">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h2 class="title">¿Confirmar reroll?</h2>
          <p>
            Vas a volver a tirar la <strong>Tirada #{{ r.id + 1 }}</strong>
            @if (ab) { (actualmente en <strong>{{ abilityLabel(ab) }}</strong>) }
            con puntaje actual <strong>{{ r.total }}</strong>.
          </p>
          <p class="alert warn">
            <strong>Atención:</strong> solo tenés <strong>1 reroll</strong> en toda la creación y te vas a quedar con el
            <strong>último resultado que salga</strong>, incluso si es menor que {{ r.total }}.
          </p>
          <div class="actions">
            <button type="button" class="btn ghost" (click)="pendingRerollId.set(null)">Cancelar</button>
            <button type="button" class="btn primary" (click)="confirmReroll()">Sí, volver a tirar 4d6</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AbilityRollerComponent implements OnDestroy {
  completed = output<RolledStats>();

  abilities = ABILITIES;
  slots = [0, 1, 2, 3, 4, 5];
  faces = [1, 2, 3, 4, 5, 6];
  pipCells = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  rolls = signal<AbilityRoll[]>([]);
  assignments = signal<Record<Ability, number | null>>({
    strength: null,
    dexterity: null,
    constitution: null,
    intelligence: null,
    wisdom: null,
    charisma: null,
  });

  soundEnabled = signal(true);
  rolling = signal(false);
  hasRolledOnce = signal(false);
  lastResult = signal<AbilityRoll | null>(null);
  trayLabel = signal('Bandeja de dados · Listo para tirar 4d6');
  /** Alterna 1 ↔ 2 en cada tirada para reiniciar el @keyframes de rebote. */
  tossParity = signal<0 | 1 | 2>(0);

  trayDice = signal<TrayDie[]>([
    { value: 6, rotX: -20, rotY: 25, durationMs: 0, delayMs: 0, dropped: false },
    { value: 5, rotX: 18, rotY: 70, durationMs: 0, delayMs: 0, dropped: false },
    { value: 4, rotX: 68, rotY: -22, durationMs: 0, delayMs: 0, dropped: false },
    { value: 3, rotX: -72, rotY: 20, durationMs: 0, delayMs: 0, dropped: false },
  ]);

  rerollUsed = signal(false);
  pendingRerollId = signal<number | null>(null);
  swapSource = signal<Ability | null>(null);

  allRolled = computed(() => this.rolls().length === 6);
  allAssigned = computed(() => {
    const a = this.assignments();
    return this.allRolled() && ABILITIES.every((ab) => a[ab.key] !== null);
  });

  private spinCycle = 0;
  private timers: number[] = [];
  private audioCtx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  ngOnDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.audioCtx?.close().catch(() => {});
  }

  hasPip(face: number, cell: number): boolean {
    return FACE_PIPS[face]?.includes(cell) ?? false;
  }

  mod = (score: number) => signed(modifier(score));

  rollById(id: number): AbilityRoll | undefined {
    return this.rolls().find((r) => r.id === id);
  }

  abilityShort(key: Ability): string {
    return ABILITIES.find((a) => a.key === key)?.short ?? key;
  }

  abilityLabel(key: Ability): string {
    return ABILITIES.find((a) => a.key === key)?.label ?? key;
  }

  assignedAbilityFor(rollId: number): Ability | null {
    const a = this.assignments();
    for (const ab of ABILITIES) {
      if (a[ab.key] === rollId) return ab.key;
    }
    return null;
  }

  rollNext() {
    if (this.rolling() || this.rolls().length >= 6) return;
    const nextId = this.rolls().length;
    const result = roll4d6DropLowest(nextId);

    this.animateTray(result, `Tirada #${nextId + 1} de 6`, 860, () => {
      this.rolls.update((list) => [...list, result]);
      if (this.rolls().length === 6) {
        this.autoAssign();
      }
    });
  }

  rollRemaining() {
    if (this.rolling() || this.rolls().length >= 6) return;
    const stepNext = () => {
      if (this.rolls().length >= 6) return;
      const nextId = this.rolls().length;
      const result = roll4d6DropLowest(nextId);
      const isLast = nextId === 5;
      this.animateTray(result, `Tirada #${nextId + 1} de 6`, isLast ? 820 : 480, () => {
        this.rolls.update((list) => [...list, result]);
        if (this.rolls().length === 6) {
          this.autoAssign();
        } else {
          const t = window.setTimeout(stepNext, 90);
          this.timers.push(t);
        }
      });
    };
    stepNext();
  }

  autoAssign() {
    if (!this.allRolled()) return;
    this.assignments.set({
      strength: 0,
      dexterity: 1,
      constitution: 2,
      intelligence: 3,
      wisdom: 4,
      charisma: 5,
    });
    this.swapSource.set(null);
  }

  clearAssignments() {
    this.assignments.set({
      strength: null,
      dexterity: null,
      constitution: null,
      intelligence: null,
      wisdom: null,
      charisma: null,
    });
    this.swapSource.set(null);
  }

  assign(target: Ability, rawVal: string) {
    this.swapSource.set(null);
    const current = { ...this.assignments() };
    if (rawVal === '') {
      current[target] = null;
      this.assignments.set(current);
      return;
    }
    const chosenRollId = Number(rawVal);
    const previousOwner = this.assignedAbilityFor(chosenRollId);
    const displacedRollId = current[target];

    current[target] = chosenRollId;
    if (previousOwner && previousOwner !== target) {
      current[previousOwner] = displacedRollId;
    }
    this.assignments.set(current);
  }

  toggleSwap(ability: Ability) {
    const src = this.swapSource();
    if (src === null) {
      if (this.assignments()[ability] === null) return;
      this.swapSource.set(ability);
      return;
    }
    if (src === ability) {
      this.swapSource.set(null);
      return;
    }
    const current = { ...this.assignments() };
    const tmp = current[src];
    current[src] = current[ability];
    current[ability] = tmp;
    this.assignments.set(current);
    this.swapSource.set(null);
  }

  askReroll(rollId: number) {
    if (this.rerollUsed() || !this.allRolled() || this.rolling()) return;
    this.pendingRerollId.set(rollId);
  }

  confirmReroll() {
    const id = this.pendingRerollId();
    if (id === null || this.rerollUsed() || this.rolling()) return;
    const prev = this.rollById(id);
    if (!prev) return;

    const fresh = roll4d6DropLowest(id);
    fresh.rerolledFrom = prev.total;

    this.pendingRerollId.set(null);
    this.rerollUsed.set(true);

    this.animateTray(fresh, `Reroll de Tirada #${id + 1} (antes ${prev.total})`, 920, () => {
      this.rolls.update((list) => list.map((r) => (r.id === id ? fresh : r)));
    });
  }

  confirm() {
    if (!this.allAssigned() || this.rolling()) return;
    const a = this.assignments();
    const stats = {} as RolledStats;
    for (const ab of ABILITIES) {
      const roll = this.rollById(a[ab.key]!);
      stats[ab.key] = roll ? roll.total : 10;
    }
    this.completed.emit(stats);
  }

  // ---------- Animación 3D y sonido ----------

  private animateTray(result: AbilityRoll, label: string, durationMs: number, onFinish: () => void) {
    this.rolling.set(true);
    this.hasRolledOnce.set(true);
    this.trayLabel.set(label);
    this.spinCycle++;
    this.tossParity.set(this.spinCycle % 2 === 1 ? 1 : 2);

    const nextDice: TrayDie[] = result.dice.map((value, idx) => {
      const base = FACE_ROTATION[value];
      // Sumamos vueltas completas distintas por dado para que siempre roten en 3D
      const turnsX = (this.spinCycle * 2 + 1 + (idx % 2)) * 360;
      const turnsY = (this.spinCycle * 2 + 2 + ((idx + 1) % 3)) * 360;
      return {
        value,
        rotX: base.x + turnsX,
        rotY: base.y + turnsY,
        durationMs: Math.max(360, durationMs - 140 + idx * 45),
        delayMs: idx * 35,
        dropped: idx === result.droppedIndex,
      };
    });

    this.trayDice.set(nextDice);
    this.playDiceRollSound(durationMs, result.total);

    const t = window.setTimeout(() => {
      this.rolling.set(false);
      this.lastResult.set(result);
      onFinish();
    }, durationMs);
    this.timers.push(t);
  }

  /** Sintetiza clacks realistas de dados rebotando sobre madera usando Web Audio API. */
  private playDiceRollSound(durationMs: number, total: number) {
    if (!this.soundEnabled()) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!this.noiseBuffer) {
        const len = Math.floor(ctx.sampleRate * 0.06);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
        }
        this.noiseBuffer = buf;
      }

      const now = ctx.currentTime;
      const scale = durationMs / 860;
      // Tiempos de rebote cada vez más espaciados y suaves hasta frenarse
      const hits = [
        { t: 0.02, gain: 0.24, freq: 1150 },
        { t: 0.07, gain: 0.28, freq: 1420 },
        { t: 0.13, gain: 0.22, freq: 980 },
        { t: 0.20, gain: 0.25, freq: 1320 },
        { t: 0.29, gain: 0.19, freq: 1080 },
        { t: 0.39, gain: 0.16, freq: 1240 },
        { t: 0.51, gain: 0.12, freq: 960 },
        { t: 0.64, gain: 0.08, freq: 1180 },
      ];

      for (const h of hits) {
        const at = now + h.t * scale;
        this.scheduleClack(ctx, at, h.gain, h.freq + (Math.random() - 0.5) * 240);
      }

      // Chime sutil al asentarse si sacó una tirada alta (15+)
      if (total >= 15) {
        const settleAt = now + (durationMs / 1000) * 0.94;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(total >= 17 ? 880 : 660, settleAt);
        g.gain.setValueAtTime(0.0001, settleAt);
        g.gain.linearRampToValueAtTime(0.08, settleAt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, settleAt + 0.35);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(settleAt);
        osc.stop(settleAt + 0.36);
      }
    } catch {
      // Si el navegador bloquea Web Audio, no rompemos el flujo
    }
  }

  private scheduleClack(ctx: AudioContext, at: number, gainLevel: number, toneFreq: number) {
    // 1) Impacto seco de ruido filtrado
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200 + Math.random() * 1100, at);
      filter.Q.setValueAtTime(2.6, at);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(gainLevel, at);
      ng.gain.exponentialRampToValueAtTime(0.001, at + 0.038);

      noise.connect(filter);
      filter.connect(ng);
      ng.connect(ctx.destination);
      noise.start(at);
      noise.stop(at + 0.04);
    }

    // 2) Cuerpo de madera/resina del dado golpeando la bandeja
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(toneFreq, at);
    osc.frequency.exponentialRampToValueAtTime(toneFreq * 0.45, at + 0.028);

    og.gain.setValueAtTime(gainLevel * 0.55, at);
    og.gain.exponentialRampToValueAtTime(0.001, at + 0.032);

    osc.connect(og);
    og.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.035);
  }
}
