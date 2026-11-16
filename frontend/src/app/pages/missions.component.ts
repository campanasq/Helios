import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { DIFFICULTY_LABELS, Difficulty, Mission, MissionStatus, STATUS_LABELS } from '../core/models';

@Component({
  selector: 'app-missions',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page-header">
      <h1 class="title">Misiones</h1>
      @if (isDm) { <button class="btn primary" (click)="openForm(null)">+ Nueva misión</button> }
    </div>

    @if (loading()) { <p class="muted">Cargando…</p> }
    @else if (missions().length === 0) {
      <div class="card empty">No hay misiones todavía.@if (isDm) { ¡Crea la primera aventura! }</div>
    } @else {
      <div class="mission-list">
        @for (m of missions(); track m.id) {
          <article class="card mission parchment">
            <header>
              <h3>{{ m.title }}</h3>
              <div class="badges">
                <span class="badge diff-{{ m.difficulty }}">{{ diffLabels[m.difficulty] }}</span>
                <span class="badge status-{{ m.status }}">{{ statusLabels[m.status] }}</span>
              </div>
            </header>
            <p class="description">{{ m.description }}</p>
            <p class="muted small">
              Nivel mínimo {{ m.min_level }}
              @if (m.reward) { · Recompensa: {{ m.reward }} }
              @if (m.creator) { · DM: {{ m.creator.name }} }
            </p>
            @if (isDm) {
              <div class="actions">
                <button class="btn ghost small" (click)="openForm(m)">Editar</button>
                <button class="btn danger small" (click)="remove(m)">Eliminar</button>
              </div>
            }
          </article>
        }
      </div>
    }

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="formOpen.set(false)">
        <form class="card modal parchment" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()">
          <h2 class="title">{{ editing() ? 'Editar misión' : 'Nueva misión' }}</h2>
          <label>Título <input formControlName="title" /></label>
          <label>Descripción <textarea rows="5" formControlName="description"></textarea></label>
          <div class="grid-2">
            <label>Dificultad
              <select formControlName="difficulty">@for (d of difficulties; track d) { <option [value]="d">{{ diffLabels[d] }}</option> }</select>
            </label>
            <label>Estado
              <select formControlName="status">@for (s of statuses; track s) { <option [value]="s">{{ statusLabels[s] }}</option> }</select>
            </label>
            <label>Nivel mínimo <input type="number" min="1" max="20" formControlName="min_level" /></label>
            <label>Recompensa <input formControlName="reward" placeholder="Ej: 200 po y una espada +1" /></label>
          </div>
          @if (error()) { <div class="alert error">{{ error() }}</div> }
          <div class="actions">
            <button type="button" class="btn ghost" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit" class="btn primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class MissionsComponent implements OnInit {
  private api = inject(ApiService);
  isDm = inject(AuthService).hasRole('dungeon_master');

  diffLabels = DIFFICULTY_LABELS;
  statusLabels = STATUS_LABELS;
  difficulties = Object.keys(DIFFICULTY_LABELS) as Difficulty[];
  statuses = Object.keys(STATUS_LABELS) as MissionStatus[];

  missions = signal<Mission[]>([]);
  loading = signal(true);
  formOpen = signal(false);
  editing = signal<Mission | null>(null);
  saving = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.required],
    difficulty: ['media' as Difficulty, Validators.required],
    status: ['abierta' as MissionStatus, Validators.required],
    min_level: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    reward: [''],
  });

  ngOnInit() {
    this.api.missions().subscribe({
      next: (ms) => { this.missions.set(ms); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(m: Mission | null) {
    this.editing.set(m);
    this.error.set('');
    this.saving.set(false);
    this.form.reset();
    if (m) this.form.patchValue({ ...m, reward: m.reward ?? '' });
    this.formOpen.set(true);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const data = this.form.getRawValue();
    const m = this.editing();
    const req = m ? this.api.updateMission(m.id, data) : this.api.createMission(data);
    req.subscribe({
      next: (saved) => {
        this.missions.update((l) => (m ? l.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...l]));
        this.formOpen.set(false);
      },
      error: (e: HttpErrorResponse) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }

  remove(m: Mission) {
    if (!confirm(`¿Eliminar la misión "${m.title}"?`)) return;
    this.api.deleteMission(m.id).subscribe(() => this.missions.update((l) => l.filter((x) => x.id !== m.id)));
  }
}
