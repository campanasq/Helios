import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { formatGold } from '../core/dnd';
import {
  MERCHANT_POSES, MERCHANT_VOICES, Merchant, MerchantPose, MerchantVoice,
  ShopBuyer, ShopItem, ShopPurchase,
} from '../core/models';
import { MerchantArtComponent } from './merchant-art.component';

type DmTab = 'items' | 'merchants' | 'purchases';
type DialogueGroup = FormGroup<{ pose: FormControl<MerchantPose>; text: FormControl<string> }>;

const POSE_LABELS: Record<MerchantPose, string> = {
  idle: 'En reposo',
  talking: 'Hablando',
  explaining: 'Explicando',
  excited: 'Emocionado',
  angry: 'Enojado',
  bored: 'Aburrido',
};

@Component({
  selector: 'app-shop',
  imports: [ReactiveFormsModule, RouterLink, MerchantArtComponent],
  templateUrl: './shop.component.html',
})
export class ShopComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder).nonNullable;

  poses = MERCHANT_POSES;
  voices = MERCHANT_VOICES;
  poseLabels = POSE_LABELS;
  formatGold = formatGold;

  loading = signal(true);
  merchant = signal<Merchant | null>(null);
  buyer = signal<ShopBuyer | null>(null);
  items = computed(() => this.merchant()?.available_items ?? []);
  isDm = computed(() => this.auth.hasRole('dungeon_master'));

  // Estado interactivo del mercader y caja de diálogo procedural
  currentPose = signal<MerchantPose>('idle');
  inspectedItem = signal<ShopItem | null>(null);
  fullText = signal('');
  shownText = signal('');
  typing = signal(false);
  voiceEnabled = signal(true);
  private dialogueCursor = 0;
  private typeTimer: number | null = null;
  private idleTimer: number | null = null;
  private audioCtx: AudioContext | null = null;
  private voiceStep = 0;

  // Compra
  buyingItem = signal<ShopItem | null>(null);
  buyingBusy = signal(false);
  buyError = signal('');

  // Panel DM
  dmOpen = signal(false);
  dmTab = signal<DmTab>('items');
  allMerchants = signal<Merchant[]>([]);
  purchases = signal<ShopPurchase[]>([]);
  dmSaving = signal(false);
  dmMessage = signal('');
  dmIsError = signal(false);

  // Edición de objetos (DM)
  editingItem = signal<ShopItem | null>(null);
  selectedItemFile = signal<File | null>(null);
  removeItemImage = signal(false);
  itemForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(1000)]],
    price_gp: [10, [Validators.required, Validators.min(1), Validators.max(1000000)]],
    inspect_pose: ['explaining' as MerchantPose],
  });

  // Edición de mercaderes (DM)
  editingMerchant = signal<Merchant | null>(null);
  uploadingPose = signal<MerchantPose | null>(null);
  merchantForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    title: ['', [Validators.maxLength(120)]],
    rotation_label: ['Mercader ambulante · Esta quincena', [Validators.maxLength(80)]],
    voice_pitch: ['low' as MerchantVoice],
    greeting: ['¡Bienvenido a mi carreta! Echale un ojo a la mercadería.', [Validators.required, Validators.maxLength(500)]],
    purchase_line: ['¡Excelente elección! Gracias por tu oro.', [Validators.required, Validators.maxLength(500)]],
    no_gold_line: ['No tenés suficientes piezas de Oro en mano. Cambiá monedas en tu hoja primero.', [Validators.required, Validators.maxLength(500)]],
    dialogues: this.fb.array<DialogueGroup>([]),
  });

  get dialogueControls() {
    return this.merchantForm.controls.dialogues;
  }

  /** URL de la imagen subida por el DM para la pose actual (con fallback a idle si existe, o SVG por defecto). */
  activePoseUrl = computed(() => {
    const m = this.merchant();
    if (!m) return null;
    const pose = this.currentPose();
    return m.pose_urls[pose] ?? m.pose_urls.idle ?? null;
  });

  ngOnInit() {
    this.loadShop(true);
  }

  ngOnDestroy() {
    this.clearTimers();
    this.audioCtx?.close().catch(() => {});
  }

  // ==================== Carga de Tienda ====================

  loadShop(greet = false) {
    this.api.shop().subscribe({
      next: (res) => {
        this.merchant.set(res.merchant);
        this.buyer.set(res.buyer);
        this.auth.setGoldTotal(res.buyer ? res.buyer.gold_total : 0);
        this.loading.set(false);
        if (greet && res.merchant) {
          this.speak(res.merchant.greeting, 'talking', false);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  // ==================== Interacción con el Mercader ====================

  onMerchantClick() {
    const m = this.merchant();
    if (!m) return;
    this.inspectedItem.set(null);

    const lines = m.dialogues ?? [];
    if (lines.length === 0) {
      this.speak(m.greeting, 'talking', true);
      return;
    }

    const line = lines[this.dialogueCursor % lines.length];
    this.dialogueCursor++;
    this.speak(line.text, line.pose || 'talking', true);
  }

  onItemHover(item: ShopItem) {
    if (this.inspectedItem()?.id === item.id) return;
    this.inspectedItem.set(item);
    this.speak(item.description, item.inspect_pose || 'explaining', true);
  }

  onItemLeave() {
    this.inspectedItem.set(null);
  }

  onDialogueBoxClick() {
    if (this.typing()) {
      this.finishTypingImmediately();
    } else {
      this.onMerchantClick();
    }
  }

  // ==================== Compra de objetos ====================

  openBuyModal(item: ShopItem) {
    this.buyError.set('');
    this.buyingItem.set(item);
    this.inspectedItem.set(item);
    this.speak(item.description, item.inspect_pose || 'explaining', true);
  }

  canAfford(item: ShopItem): boolean {
    const b = this.buyer();
    return !!b && b.gp >= item.price_gp;
  }

  confirmBuy() {
    const item = this.buyingItem();
    const m = this.merchant();
    if (!item || !m || this.buyingBusy()) return;

    if (!this.canAfford(item)) {
      const b = this.buyer();
      this.buyError.set(
        !b
          ? 'Necesitás un personaje principal vivo para comprar en la tienda.'
          : `Necesitás ${item.price_gp} PO literales en mano (tenés ${b.gp} PO). Si tenés Platino o Plata, cambialos primero en tu hoja.`,
      );
      this.speak(m.no_gold_line, 'angry', true);
      return;
    }

    this.buyingBusy.set(true);
    this.buyError.set('');

    this.api.buyShopItem(item.id).subscribe({
      next: (res) => {
        this.buyingBusy.set(false);
        this.buyingItem.set(null);
        this.inspectedItem.set(null);
        this.buyer.set(res.buyer);
        if (res.buyer) this.auth.setGoldTotal(res.buyer.gold_total);

        // Saca el objeto de la tienda al instante
        this.merchant.update((cur) =>
          cur ? { ...cur, available_items: (cur.available_items ?? []).filter((x) => x.id !== item.id) } : null,
        );

        this.playPurchaseChime();
        this.speak(m.purchase_line, 'excited', true);

        if (this.dmOpen()) this.refreshDmData();
      },
      error: (e: HttpErrorResponse) => {
        this.buyingBusy.set(false);
        const msg = errorMessage(e);
        this.buyError.set(msg);
        this.speak(m.no_gold_line, 'angry', true);
      },
    });
  }

  // ==================== Motor procedural de diálogo + Voz Undertale ====================

  private speak(text: string, pose: MerchantPose, withSound: boolean) {
    this.clearTimers();
    this.currentPose.set(pose);
    this.fullText.set(text);
    this.shownText.set('');
    this.typing.set(true);
    this.voiceStep = 0;

    let idx = 0;
    const step = () => {
      if (idx >= text.length) {
        this.typing.set(false);
        this.typeTimer = null;
        this.scheduleIdleReturn();
        return;
      }

      const ch = text[idx];
      idx++;
      this.shownText.set(text.slice(0, idx));

      if (withSound && this.voiceEnabled() && /[\p{L}\p{N}]/u.test(ch)) {
        this.voiceStep++;
        if (this.voiceStep % 2 === 1) {
          this.playVoiceBlip(this.merchant()?.voice_pitch ?? 'low');
        }
      }

      let delay = 26;
      if (ch === ',' || ch === ';' || ch === ':') delay = 105;
      else if (ch === '.' || ch === '!' || ch === '?' || ch === '…') delay = 165;

      this.typeTimer = window.setTimeout(step, delay);
    };

    step();
  }

  private finishTypingImmediately() {
    this.clearTimers();
    this.shownText.set(this.fullText());
    this.typing.set(false);
    this.scheduleIdleReturn();
  }

  private scheduleIdleReturn() {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (!this.inspectedItem() && !this.typing()) {
        this.currentPose.set('idle');
      }
    }, 2600);
  }

  private clearTimers() {
    if (this.typeTimer !== null) {
      clearTimeout(this.typeTimer);
      this.typeTimer = null;
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private getAudioCtx(): AudioContext | null {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /** Blip vocal sintético estilo Undertale / RPG Maker según el tono del mercader. */
  private playVoiceBlip(voice: MerchantVoice) {
    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const jitter = (Math.random() - 0.5) * 28;
    if (voice === 'low') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(142 + jitter, now);
      osc.frequency.exponentialRampToValueAtTime(112 + jitter * 0.5, now + 0.045);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
    } else if (voice === 'high') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(420 + jitter * 1.6, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
    } else if (voice === 'mystic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(325 + jitter * 1.4, now);
      osc.frequency.exponentialRampToValueAtTime(360 + jitter, now + 0.05);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(255 + jitter * 1.2, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.052);
  }

  /** Sonido de monedas cayendo al concretar una compra. */
  private playPurchaseChime() {
    if (!this.voiceEnabled()) return;
    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((freq, i) => {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  // ==================== Gestión DM ====================

  toggleDmPanel() {
    const next = !this.dmOpen();
    this.dmOpen.set(next);
    if (next) this.refreshDmData();
  }

  refreshDmData() {
    this.api.shopMerchants().subscribe({
      next: (list) => this.allMerchants.set(list),
    });
    this.api.shopPurchases().subscribe({
      next: (list) => this.purchases.set(list),
    });
  }

  // --- Objetos DM ---

  startNewItem() {
    this.editingItem.set(null);
    this.selectedItemFile.set(null);
    this.removeItemImage.set(false);
    this.itemForm.reset({ name: '', description: '', price_gp: 10, inspect_pose: 'explaining' });
  }

  editItem(item: ShopItem) {
    this.editingItem.set(item);
    this.selectedItemFile.set(null);
    this.removeItemImage.set(false);
    this.itemForm.patchValue({
      name: item.name,
      description: item.description,
      price_gp: item.price_gp,
      inspect_pose: item.inspect_pose,
    });
    document.getElementById('dm-item-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  onItemFilePicked(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedItemFile.set(file);
    if (file) this.removeItemImage.set(false);
    input.value = '';
  }

  saveItem() {
    const m = this.merchant();
    if (!m) {
      this.flashDm('No hay ningún mercader activo.', true);
      return;
    }
    if (this.dmSaving()) return;
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      const missing: string[] = [];
      if (this.itemForm.controls.name.invalid) missing.push('nombre del objeto');
      if (this.itemForm.controls.price_gp.invalid) missing.push('precio en oro (mínimo 1 PO)');
      this.flashDm(`Completá los campos requeridos: ${missing.join(', ')}.`, true);
      return;
    }

    const v = this.itemForm.getRawValue();
    const fd = new FormData();
    fd.append('name', v.name.trim());
    fd.append('description', v.description.trim());
    fd.append('price_gp', String(Math.floor(Number(v.price_gp))));
    fd.append('inspect_pose', v.inspect_pose);
    if (this.selectedItemFile()) fd.append('image', this.selectedItemFile()!);
    if (this.removeItemImage()) fd.append('remove_image', '1');

    this.dmSaving.set(true);
    const editing = this.editingItem();
    const req = editing
      ? this.api.updateShopItem(editing.id, fd)
      : this.api.createShopItem(m.id, fd);

    req.subscribe({
      next: () => {
        this.dmSaving.set(false);
        this.startNewItem();
        this.loadShop(false);
        this.refreshDmData();
        this.flashDm(editing ? 'Objeto actualizado.' : 'Objeto agregado a la estantería.', false);
      },
      error: (e: HttpErrorResponse) => {
        this.dmSaving.set(false);
        this.flashDm(errorMessage(e), true);
      },
    });
  }

  deleteItem(item: ShopItem) {
    if (!confirm(`¿Quitar "${item.name}" de la tienda?`)) return;
    this.api.deleteShopItem(item.id).subscribe({
      next: () => {
        if (this.editingItem()?.id === item.id) this.startNewItem();
        this.loadShop(false);
        this.refreshDmData();
        this.flashDm('Objeto eliminado.', false);
      },
      error: (e: HttpErrorResponse) => this.flashDm(errorMessage(e), true),
    });
  }

  // --- Mercaderes DM ---

  private dialogueGroup(d = { pose: 'talking' as MerchantPose, text: '' }): DialogueGroup {
    return this.fb.group({ pose: [d.pose], text: [d.text] });
  }

  addDialogueRow() {
    this.dialogueControls.push(this.dialogueGroup());
  }

  removeDialogueRow(i: number) {
    this.dialogueControls.removeAt(i);
  }

  startNewMerchant() {
    this.editingMerchant.set(null);
    this.dialogueControls.clear();
    this.dialogueControls.push(this.dialogueGroup({ pose: 'talking', text: '' }));
    this.merchantForm.reset({
      name: '',
      title: '',
      rotation_label: 'Mercader ambulante · Próxima rotación',
      voice_pitch: 'medium',
      greeting: '¡Saludos, viajero! Mirá lo que traigo esta semana.',
      purchase_line: '¡Trato hecho! Disfrutá tu nueva adquisición.',
      no_gold_line: 'Te faltan piezas de Oro en mano. Cambiá tus monedas en la hoja primero.',
    });
  }

  editMerchant(m: Merchant) {
    this.editingMerchant.set(m);
    this.dialogueControls.clear();
    (m.dialogues ?? []).forEach((d) => this.dialogueControls.push(this.dialogueGroup(d)));
    if (this.dialogueControls.length === 0) this.dialogueControls.push(this.dialogueGroup());
    this.merchantForm.patchValue({
      name: m.name,
      title: m.title ?? '',
      rotation_label: m.rotation_label ?? '',
      voice_pitch: m.voice_pitch,
      greeting: m.greeting,
      purchase_line: m.purchase_line,
      no_gold_line: m.no_gold_line,
    });
  }

  saveMerchant() {
    if (this.dmSaving()) return;
    if (this.merchantForm.invalid) {
      this.merchantForm.markAllAsTouched();
      this.flashDm('Completá el nombre y las frases obligatorias del mercader.', true);
      return;
    }

    const v = this.merchantForm.getRawValue();
    const editing = this.editingMerchant();
    this.dmSaving.set(true);

    const req = editing
      ? this.api.updateMerchant(editing.id, v)
      : this.api.createMerchant(v);

    req.subscribe({
      next: (saved) => {
        this.dmSaving.set(false);
        this.editMerchant(saved);
        this.loadShop(false);
        this.refreshDmData();
        this.flashDm(editing ? 'Mercader actualizado.' : 'Nuevo mercader creado. Ya podés subirle poses o activarlo.', false);
      },
      error: (e: HttpErrorResponse) => {
        this.dmSaving.set(false);
        this.flashDm(errorMessage(e), true);
      },
    });
  }

  activateMerchant(m: Merchant) {
    this.api.activateMerchant(m.id).subscribe({
      next: () => {
        this.dialogueCursor = 0;
        this.loadShop(true);
        this.refreshDmData();
        this.flashDm(`Ahora atiende ${m.name}.`, false);
      },
      error: (e: HttpErrorResponse) => this.flashDm(errorMessage(e), true),
    });
  }

  deleteMerchant(m: Merchant) {
    if (!confirm(`¿Eliminar al mercader "${m.name}" y todos sus objetos?`)) return;
    this.api.deleteMerchant(m.id).subscribe({
      next: () => {
        if (this.editingMerchant()?.id === m.id) this.startNewMerchant();
        this.loadShop(true);
        this.refreshDmData();
        this.flashDm('Mercader eliminado.', false);
      },
      error: (e: HttpErrorResponse) => this.flashDm(errorMessage(e), true),
    });
  }

  onPoseFilePicked(pose: MerchantPose, e: Event) {
    const m = this.editingMerchant();
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!m || !file) return;

    this.uploadingPose.set(pose);
    this.api.uploadMerchantPose(m.id, pose, file).subscribe({
      next: (updated) => {
        this.uploadingPose.set(null);
        this.editingMerchant.set(updated);
        this.loadShop(false);
        this.refreshDmData();
        this.flashDm(`Imagen de pose ${pose.toUpperCase()} actualizada.`, false);
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingPose.set(null);
        this.flashDm(errorMessage(err), true);
      },
    });
  }

  removePose(pose: MerchantPose) {
    const m = this.editingMerchant();
    if (!m) return;
    this.api.deleteMerchantPose(m.id, pose).subscribe({
      next: (updated) => {
        this.editingMerchant.set(updated);
        this.loadShop(false);
        this.refreshDmData();
        this.flashDm(`Pose ${pose.toUpperCase()} restaurada al dibujo por defecto.`, false);
      },
      error: (err: HttpErrorResponse) => this.flashDm(errorMessage(err), true),
    });
  }

  private flashDm(msg: string, isError: boolean) {
    this.dmMessage.set(msg);
    this.dmIsError.set(isError);
    setTimeout(() => this.dmMessage.set(''), 4000);
  }
}
