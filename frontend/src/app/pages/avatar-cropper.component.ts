import { Component, output, signal } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

/**
 * Modal para elegir el retrato del personaje: PNG (idealmente con fondo transparente),
 * recortado en proporción 2:4 para que aparezca "de pie" en la Galería de héroes.
 */
@Component({
  selector: 'app-avatar-cropper',
  imports: [ImageCropperComponent],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <div class="card modal cropper-modal" (click)="$event.stopPropagation()">
        <h2 class="title">Retrato del personaje</h2>
        <p class="muted small">
          Sube un <strong>PNG</strong> de tu personaje <strong>de cuerpo entero</strong>, a ser posible con el
          <strong>fondo transparente</strong> (recortado). Se encuadra en proporción 2:4 y así aparecerá de pie en la Galería de personajes.
        </p>

        <label class="btn ghost file-btn">
          {{ file() ? 'Elegir otra imagen' : 'Elegir PNG…' }}
          <input type="file" accept="image/png" (change)="onFile($event)" hidden />
        </label>

        @if (error()) { <div class="alert error">{{ error() }}</div> }
        @if (opaque()) {
          <div class="alert warn">
            Esta imagen no tiene fondo transparente. Se puede usar, pero en la galería se verá con su fondo.
            Puedes quitar el fondo con herramientas gratuitas como remove.bg o Photopea.
          </div>
        }

        @if (file()) {
          <div class="cropper-area">
            <div class="checkerboard">
              <image-cropper
                [imageFile]="file()!"
                [maintainAspectRatio]="true"
                [aspectRatio]="1 / 2"
                [resizeToWidth]="400"
                [onlyScaleDown]="false"
                format="png"
                output="blob"
                (imageCropped)="cropped.set($event)"
                (loadImageFailed)="error.set('No se pudo cargar la imagen.')"
              />
            </div>
            @if (cropped()?.objectUrl) {
              <div class="cropper-preview">
                <span class="muted small">Vista previa</span>
                <div class="checkerboard"><img [src]="cropped()!.objectUrl" alt="Vista previa del retrato" /></div>
              </div>
            }
          </div>
        }

        <div class="actions">
          <button class="btn ghost" (click)="cancel.emit()">Cancelar</button>
          <button class="btn primary" [disabled]="!cropped()?.blob" (click)="confirm()">Usar esta imagen</button>
        </div>
      </div>
    </div>
  `,
})
export class AvatarCropperComponent {
  done = output<Blob>();
  cancel = output<void>();

  file = signal<File | null>(null);
  cropped = signal<ImageCroppedEvent | null>(null);
  error = signal('');
  /** true si el PNG no tiene ningún píxel transparente */
  opaque = signal(false);

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.error.set('');
    this.opaque.set(false);
    if (f.type !== 'image/png') {
      this.error.set('El retrato debe ser una imagen PNG.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      this.error.set('La imagen es demasiado grande (máx. 20 MB).');
      return;
    }
    this.cropped.set(null);
    this.file.set(f);
    this.checkTransparency(f);
  }

  confirm() {
    const blob = this.cropped()?.blob;
    if (blob) this.done.emit(blob);
  }

  /** Muestrea la imagen reducida y comprueba si tiene algún píxel con alfa < 255. */
  private async checkTransparency(f: File) {
    try {
      const bmp = await createImageBitmap(f);
      const w = Math.min(256, bmp.width);
      const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let transparent = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) { transparent = true; break; }
      }
      this.opaque.set(!transparent);
    } catch {
      /* si el navegador no puede analizarla, no avisamos */
    }
  }
}
