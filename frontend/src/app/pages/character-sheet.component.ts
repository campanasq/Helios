import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, debounceTime, of, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import {
  ABILITIES, ABILITY_SHORT, ALIGNMENTS, Ability, BACKGROUNDS, CLASSES, COINS, RACES, SKILLS,
  modifier, proficiencyBonus, signed,
} from '../core/dnd';
import { Character } from '../core/models';
import { blobToDataUrl, clearDraft, dataUrlToBlob, draftKey, readDraft, writeDraft } from '../core/drafts';
import { AvatarCropperComponent } from './avatar-cropper.component';

type Tab = 'hoja' | 'trasfondo' | 'conjuros';
type AttackGroup = FormGroup<{ name: FormControl<string>; bonus: FormControl<string>; damage: FormControl<string> }>;
type FormValue = ReturnType<CharacterSheetComponent['form']['getRawValue']>;
type SpellGroup = FormGroup<{ level: FormControl<number>; name: FormControl<string>; prepared: FormControl<boolean> }>;

@Component({
  selector: 'app-character-sheet',
  imports: [ReactiveFormsModule, RouterLink, AvatarCropperComponent],
  templateUrl: './character-sheet.component.html',
})
export class CharacterSheetComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder).nonNullable;
  private destroyRef = inject(DestroyRef);

  // Constantes para la plantilla
  abilities = ABILITIES; skills = SKILLS; races = RACES; classes = CLASSES;
  alignments = ALIGNMENTS; backgrounds = BACKGROUNDS; coins = COINS; abilityShort = ABILITY_SHORT;
  spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  signed = signed; modifier = modifier;

  tab = signal<Tab>('hoja');
  loading = signal(true);
  saving = signal(false);
  message = signal('');
  isError = signal(false);

  character = signal<Character | null>(null);
  editable = signal(true);

  /** Fecha del borrador local recuperado (si lo hay), para avisar al usuario. */
  draftRestoredAt = signal<Date | null>(null);
  private storageKey = '';
  private pendingAvatarDataUrl: string | null = null;

  // Avatar
  cropperOpen = signal(false);
  avatarUrl = signal<string | null>(null);
  /** Para personajes nuevos: el avatar se sube al guardar. */
  private pendingAvatar: Blob | null = null;
  private objectUrl: string | null = null;

  form = this.buildForm();
  private initialValue = this.form.getRawValue();
  /** Valor actual del formulario como signal (para los cálculos derivados). */
  v = signal(this.form.getRawValue());

  prof = computed(() => proficiencyBonus(this.v().level));
  mods = computed(() => {
    const v = this.v();
    return Object.fromEntries(ABILITIES.map((a) => [a.key, modifier(v[a.key])])) as Record<Ability, number>;
  });
  saveBonus = (a: Ability) => this.mods()[a] + (this.v().sheet.saving_throws[a] ? this.prof() : 0);
  skillBonus = (key: string, a: Ability) => this.mods()[a] + this.v().sheet.skills[key] * this.prof();
  initiative = computed(() => this.mods().dexterity + Number(this.v().sheet.initiative_bonus || 0));
  passivePerception = computed(() => 10 + this.skillBonus('perception', 'wisdom'));
  spellMod = computed(() => {
    const a = this.v().sheet.spellcasting.ability as Ability | '';
    return a ? this.mods()[a] : null;
  });
  spellDc = computed(() => (this.spellMod() === null ? null : 8 + this.prof() + this.spellMod()!));
  spellAttack = computed(() => (this.spellMod() === null ? null : this.prof() + this.spellMod()!));
  /** Índices de los conjuros dentro del FormArray, agrupados por nivel. */
  spellsByLevel = computed(() => {
    const groups: number[][] = this.spellLevels.map(() => []);
    this.v().sheet.spellcasting.spells.forEach((s, i) => groups[s.level]?.push(i));
    return groups;
  });

  get sheet() { return this.form.controls.sheet; }
  get attacks() { return this.sheet.controls.attacks; }
  get spells() { return this.sheet.controls.spellcasting.controls.spells; }
  get slots() { return this.sheet.controls.spellcasting.controls.slots; }

  ngOnInit() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.v.set(this.form.getRawValue()));

    // Autoguardado local del borrador (medio segundo después de dejar de escribir)
    this.form.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.saveDraft());

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.storageKey = draftKey(this.auth.user()?.id, id || null);
    if (!id) {
      this.restoreDraft();
      this.loading.set(false);
      return;
    }
    this.api.character(id).subscribe({
      next: (c) => this.load(c),
      error: (e: HttpErrorResponse) => {
        this.flash(errorMessage(e), true);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  // ---------- Formulario ----------

  private buildForm() {
    const fb = this.fb;
    const stat = () => fb.control(10, [Validators.required, Validators.min(1), Validators.max(30)]);
    return fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      race: ['', [Validators.required, Validators.maxLength(50)]],
      class: ['', [Validators.required, Validators.maxLength(50)]],
      level: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
      alignment: [''],
      background: [''],
      strength: stat(), dexterity: stat(), constitution: stat(),
      intelligence: stat(), wisdom: stat(), charisma: stat(),
      hit_points: [10, [Validators.required, Validators.min(1), Validators.max(999)]],
      armor_class: [10, [Validators.required, Validators.min(1), Validators.max(40)]],
      backstory: [''],
      sheet: fb.group({
        player_name: [this.auth.user()?.name ?? ''],
        experience: [0],
        inspiration: [false],
        speed: [30],
        initiative_bonus: [0],
        hp_current: [10],
        hp_temp: [0],
        hit_dice: ['1d8'],
        saving_throws: fb.group(Object.fromEntries(ABILITIES.map((a) => [a.key, false])) as Record<Ability, boolean>),
        skills: fb.group(Object.fromEntries(SKILLS.map((s) => [s.key, 0])) as Record<string, number>),
        death_saves: fb.group({ successes: [0], failures: [0] }),
        money: fb.group({ cp: [0], sp: [0], ep: [0], gp: [0], pp: [0] }),
        attacks: fb.array<AttackGroup>([]),
        proficiencies_languages: [''], equipment: [''],
        personality_traits: [''], ideals: [''], bonds: [''], flaws: [''], features_traits: [''],
        age: [''], height: [''], weight: [''], eyes: [''], skin: [''], hair: [''],
        appearance: [''], allies: [''], additional_features: [''], treasure: [''],
        spellcasting: fb.group({
          class: [''],
          ability: [''],
          slots: fb.array(Array.from({ length: 9 }, () => fb.group({ total: [0], used: [0] }))),
          spells: fb.array<SpellGroup>([]),
        }),
      }),
    });
  }

  private attackGroup(a = { name: '', bonus: '', damage: '' }): AttackGroup {
    return this.fb.group({ name: [a.name], bonus: [a.bonus], damage: [a.damage] });
  }

  private spellGroup(s = { level: 0, name: '', prepared: false }): SpellGroup {
    return this.fb.group({ level: [s.level], name: [s.name], prepared: [s.prepared] });
  }

  private load(c: Character) {
    this.character.set(c);
    this.avatarUrl.set(c.avatar_url);
    this.editable.set(c.user_id === this.auth.user()?.id);

    this.applyValue({
      ...c,
      alignment: c.alignment ?? '',
      background: c.background ?? '',
      backstory: c.backstory ?? '',
    } as unknown as FormValue);

    if (!this.editable()) this.form.disable({ emitEvent: false });
    this.form.markAsPristine();
    if (this.editable()) this.restoreDraft(c);
    this.loading.set(false);
  }

  /** Vuelca un valor completo en el formulario, recreando las listas (ataques/conjuros). */
  private applyValue(value: FormValue) {
    this.attacks.clear({ emitEvent: false });
    (value.sheet?.attacks ?? []).forEach((a) => this.attacks.push(this.attackGroup(a), { emitEvent: false }));
    this.spells.clear({ emitEvent: false });
    (value.sheet?.spellcasting?.spells ?? []).forEach((s) => this.spells.push(this.spellGroup(s), { emitEvent: false }));
    this.form.patchValue(value as never, { emitEvent: false });
    this.v.set(this.form.getRawValue());
  }

  // ---------- Borrador local ----------

  private saveDraft() {
    if (!this.editable() || !this.form.dirty || this.loading()) return;
    writeDraft(this.storageKey, {
      value: this.form.getRawValue(),
      savedAt: new Date().toISOString(),
      avatar: this.pendingAvatarDataUrl,
    });
  }

  private restoreDraft(server?: Character) {
    const d = readDraft<FormValue>(this.storageKey);
    if (!d) return;
    // Si el personaje se guardó en el servidor después del borrador, el borrador está obsoleto
    if (server && new Date(server.updated_at) > new Date(d.savedAt)) {
      clearDraft(this.storageKey);
      return;
    }
    this.applyValue(d.value);
    this.form.markAsDirty();
    if (!server && d.avatar) {
      this.pendingAvatarDataUrl = d.avatar;
      this.avatarUrl.set(d.avatar);
      dataUrlToBlob(d.avatar).then((b) => (this.pendingAvatar = b)).catch(() => {});
    }
    this.draftRestoredAt.set(new Date(d.savedAt));
  }

  discardDraft() {
    if (!confirm('¿Descartar los cambios sin guardar?')) return;
    clearDraft(this.storageKey);
    this.draftRestoredAt.set(null);
    const c = this.character();
    if (c) {
      this.load(c);
      return;
    }
    this.applyValue(this.initialValue);
    this.form.markAsPristine();
    this.pendingAvatar = null;
    this.pendingAvatarDataUrl = null;
    this.avatarUrl.set(null);
  }

  addAttack() { this.attacks.push(this.attackGroup()); }
  removeAttack(i: number) { this.attacks.removeAt(i); }
  addSpell(level: number) { this.spells.push(this.spellGroup({ level, name: '', prepared: false })); }
  removeSpell(i: number) { this.spells.removeAt(i); }

  /** Competencia en habilidad: nada → competente → pericia → nada */
  cycleSkill(key: string) {
    if (!this.editable()) return;
    const ctrl = this.sheet.controls.skills.get(key)!;
    ctrl.setValue((ctrl.value + 1) % 3);
    ctrl.markAsDirty();
  }

  /** Marca/desmarca salvaciones de muerte haciendo clic en el círculo n (1..3) */
  setDeathSave(kind: 'successes' | 'failures', n: number) {
    if (!this.editable()) return;
    const ctrl = this.sheet.controls.death_saves.controls[kind];
    ctrl.setValue(ctrl.value === n ? n - 1 : n);
    ctrl.markAsDirty();
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.tab.set('hoja');
      this.flash('Revisa los campos obligatorios (nombre, raza, clase…).', true);
      return;
    }
    this.saving.set(true);
    const data = this.form.getRawValue() as unknown as Partial<Character>;
    const existing = this.character();

    const req: Observable<Character> = existing
      ? this.api.updateCharacter(existing.id, data)
      : this.api.createCharacter(data).pipe(
          switchMap((c) => (this.pendingAvatar ? this.api.uploadAvatar(c.id, this.pendingAvatar) : of(c))),
        );

    req.subscribe({
      next: (c) => {
        this.saving.set(false);
        this.pendingAvatar = null;
        this.pendingAvatarDataUrl = null;
        this.form.markAsPristine();
        clearDraft(this.storageKey);
        this.draftRestoredAt.set(null);
        if (!existing) {
          // Se recarga la hoja ya guardada en /personajes/:id
          this.router.navigate(['/personajes', c.id], { replaceUrl: true });
        } else {
          this.character.set(c);
        }
        this.flash('Personaje guardado.', false);
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.flash(errorMessage(e), true);
      },
    });
  }

  // ---------- Avatar ----------

  onAvatarCropped(blob: Blob) {
    this.cropperOpen.set(false);
    const c = this.character();
    if (!c) {
      // Personaje nuevo: guardamos el blob y mostramos la vista previa local
      this.pendingAvatar = blob;
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = URL.createObjectURL(blob);
      this.avatarUrl.set(this.objectUrl);
      this.form.markAsDirty();
      blobToDataUrl(blob).then((url) => {
        this.pendingAvatarDataUrl = url;
        this.saveDraft();
      });
      return;
    }
    this.api.uploadAvatar(c.id, blob).subscribe({
      next: (updated) => {
        this.character.set(updated);
        this.avatarUrl.set(updated.avatar_url);
        this.flash('Retrato actualizado.', false);
      },
      error: (e: HttpErrorResponse) => this.flash(errorMessage(e), true),
    });
  }

  removeAvatar() {
    const c = this.character();
    if (!c) {
      this.pendingAvatar = null;
      this.pendingAvatarDataUrl = null;
      this.avatarUrl.set(null);
      this.saveDraft();
      return;
    }
    if (!confirm('¿Quitar el retrato?')) return;
    this.api.deleteAvatar(c.id).subscribe({
      next: (updated) => {
        this.character.set(updated);
        this.avatarUrl.set(null);
      },
      error: (e: HttpErrorResponse) => this.flash(errorMessage(e), true),
    });
  }

  private flash(msg: string, error: boolean) {
    this.message.set(msg);
    this.isError.set(error);
    setTimeout(() => this.message.set(''), 4000);
  }
}
