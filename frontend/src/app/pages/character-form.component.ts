import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { Character } from '../core/models';

export const RACES = ['Humano', 'Elfo', 'Enano', 'Mediano', 'Gnomo', 'Semielfo', 'Semiorco', 'Tiefling', 'Dracónido'];
export const CLASSES = ['Bárbaro', 'Bardo', 'Brujo', 'Clérigo', 'Druida', 'Explorador', 'Guerrero', 'Hechicero', 'Mago', 'Monje', 'Paladín', 'Pícaro'];
export const ALIGNMENTS = ['Legal bueno', 'Neutral bueno', 'Caótico bueno', 'Legal neutral', 'Neutral', 'Caótico neutral', 'Legal malvado', 'Neutral malvado', 'Caótico malvado'];
export const STATS = [
  { key: 'strength', label: 'FUE' }, { key: 'dexterity', label: 'DES' }, { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' }, { key: 'wisdom', label: 'SAB' }, { key: 'charisma', label: 'CAR' },
] as const;

@Component({
  selector: 'app-character-form',
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <form class="card modal" [formGroup]="form" (ngSubmit)="submit()" (click)="$event.stopPropagation()">
        <h2 class="title">{{ character() ? 'Editar personaje' : 'Nuevo personaje' }}</h2>

        <div class="grid-2">
          <label>Nombre <input formControlName="name" /></label>
          <label>Nivel <input type="number" min="1" max="20" formControlName="level" /></label>
          <label>Raza
            <select formControlName="race">@for (r of races; track r) { <option [value]="r">{{ r }}</option> }</select>
          </label>
          <label>Clase
            <select formControlName="class">@for (c of classes; track c) { <option [value]="c">{{ c }}</option> }</select>
          </label>
          <label>Alineamiento
            <select formControlName="alignment"><option value="">—</option>@for (a of alignments; track a) { <option [value]="a">{{ a }}</option> }</select>
          </label>
          <label>Trasfondo <input formControlName="background" placeholder="Ej: Soldado, Erudito…" /></label>
        </div>

        <h3 class="subtitle">Atributos</h3>
        <div class="stats-grid">
          @for (s of stats; track s.key) {
            <label class="stat-input">{{ s.label }} <input type="number" min="1" max="30" [formControlName]="s.key" /></label>
          }
          <label class="stat-input">PG <input type="number" min="1" formControlName="hit_points" /></label>
          <label class="stat-input">CA <input type="number" min="1" formControlName="armor_class" /></label>
        </div>

        <label>Historia <textarea rows="4" formControlName="backstory"></textarea></label>

        @if (error()) { <div class="alert error">{{ error() }}</div> }

        <div class="actions">
          <button type="button" class="btn ghost" (click)="cancel.emit()">Cancelar</button>
          <button type="submit" class="btn primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class CharacterFormComponent implements OnInit {
  private api = inject(ApiService);
  character = input<Character | null>(null);
  saved = output<Character>();
  cancel = output<void>();

  races = RACES; classes = CLASSES; alignments = ALIGNMENTS; stats = STATS;
  saving = signal(false);
  error = signal('');

  private stat = () => [10, [Validators.required, Validators.min(1), Validators.max(30)]];
  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    race: [RACES[0], Validators.required],
    class: [CLASSES[0], Validators.required],
    level: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    alignment: [''],
    background: [''],
    strength: this.stat(), dexterity: this.stat(), constitution: this.stat(),
    intelligence: this.stat(), wisdom: this.stat(), charisma: this.stat(),
    hit_points: [10, [Validators.required, Validators.min(1)]],
    armor_class: [10, [Validators.required, Validators.min(1)]],
    backstory: [''],
  });

  ngOnInit() {
    const c = this.character();
    if (c) this.form.patchValue({ ...c, alignment: c.alignment ?? '', background: c.background ?? '', backstory: c.backstory ?? '' } as never);
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const data = this.form.getRawValue() as Partial<Character>;
    const c = this.character();
    const req = c ? this.api.updateCharacter(c.id, data) : this.api.createCharacter(data);
    req.subscribe({
      next: (res) => this.saved.emit(res),
      error: (e: HttpErrorResponse) => { this.error.set(errorMessage(e)); this.saving.set(false); },
    });
  }
}
