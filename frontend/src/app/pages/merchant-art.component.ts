import { Component, input } from '@angular/core';
import { MerchantPose } from '../core/models';

/**
 * Ilustración por defecto del mercader ambulante con 6 expresiones distintas
 * (IDLE, TALKING, EXPLAINING, EXCITED, ANGRY, BORED) cuando el DM aún no subió
 * dibujos PNG propios para esa pose.
 */
@Component({
  selector: 'app-merchant-art',
  template: `
    @let p = pose();
    <svg class="merchant-svg" [class]="'merchant-svg pose-' + p + (speaking() ? ' speaking' : '')" viewBox="0 0 260 280" role="img" [attr.aria-label]="'Mercader en pose ' + p">
      <defs>
        <radialGradient id="lanternGlow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stop-color="#f3c16a" stop-opacity=".35" />
          <stop offset="100%" stop-color="#1a120b" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="cloakGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#5d3823" />
          <stop offset="100%" stop-color="#2f1b10" />
        </linearGradient>
        <linearGradient id="beardGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a88b6d" />
          <stop offset="65%" stop-color="#7c634b" />
          <stop offset="100%" stop-color="#523f2e" />
        </linearGradient>
      </defs>

      <!-- Luz cálida de farol -->
      <circle cx="130" cy="128" r="118" fill="url(#lanternGlow)" />

      <!-- Cuerpo / abrigo grueso de mercader -->
      <g class="m-body">
        <path d="M36 276 C44 198, 72 178, 130 178 C188 178, 216 198, 224 276 Z" fill="url(#cloakGrad)" stroke="#1e120a" stroke-width="4" />
        <!-- Cuello de piel -->
        <path d="M68 186 Q130 218 192 186 Q178 166 130 170 Q82 166 68 186 Z" fill="#8b6f54" stroke="#2a1c12" stroke-width="3" />
        <!-- Correa con bolsita de oro -->
        <path d="M78 196 L176 274" stroke="#2d1c10" stroke-width="10" stroke-linecap="round" />
        <rect x="120" y="226" width="22" height="16" rx="3" fill="#d4a64a" stroke="#3a250d" stroke-width="2.5" />
      </g>

      <!-- Cabeza y sombrero -->
      <g class="m-head">
        <!-- Orejas -->
        <ellipse cx="76" cy="120" rx="11" ry="15" fill="#d49b72" stroke="#3b2316" stroke-width="3" />
        <ellipse cx="184" cy="120" rx="11" ry="15" fill="#d49b72" stroke="#3b2316" stroke-width="3" />

        <!-- Rostro -->
        <ellipse cx="130" cy="122" rx="54" ry="56" fill="#dfb08a" stroke="#3b2316" stroke-width="3.5" />

        <!-- Rubor si está enojado o emocionado -->
        @if (p === 'angry') {
          <ellipse cx="102" cy="130" rx="14" ry="7" fill="#c94a3f" opacity=".45" />
          <ellipse cx="158" cy="130" rx="14" ry="7" fill="#c94a3f" opacity=".45" />
        } @else if (p === 'excited') {
          <ellipse cx="102" cy="130" rx="12" ry="6" fill="#d97b62" opacity=".35" />
          <ellipse cx="158" cy="130" rx="12" ry="6" fill="#d97b62" opacity=".35" />
        }

        <!-- Cicatriz en ceja derecha -->
        <path d="M150 94 L161 112" stroke="#9e5a46" stroke-width="2.5" stroke-linecap="round" />

        <!-- Barba espesa y bigote -->
        <path d="M76 132 C72 178, 96 218, 130 220 C164 218, 188 178, 184 132 C170 144, 152 146, 130 146 C108 146, 90 144, 76 132 Z" fill="url(#beardGrad)" stroke="#2c1f15" stroke-width="3.5" />
        <!-- Trenza con aro dorado -->
        <rect x="123" y="198" width="14" height="7" rx="2" fill="#e9c46a" stroke="#4a310d" stroke-width="2" />

        <!-- Nariz ancha -->
        <path d="M122 118 Q130 135 138 118" fill="#cf936b" stroke="#5c3621" stroke-width="3" stroke-linecap="round" />

        <!-- Bigote -->
        <path d="M92 142 Q112 132 130 142 Q148 132 168 142 Q152 154 130 148 Q108 154 92 142 Z" fill="#9a7d60" stroke="#2c1f15" stroke-width="2.5" />

        <!-- Ojos y cejas según pose -->
        @switch (p) {
          @case ('angry') {
            <path d="M93 102 L120 112" stroke="#3a281c" stroke-width="6.5" stroke-linecap="round" />
            <path d="M167 102 L140 112" stroke="#3a281c" stroke-width="6.5" stroke-linecap="round" />
            <circle cx="108" cy="116" r="5.5" fill="#1e130c" />
            <circle cx="152" cy="116" r="5.5" fill="#1e130c" />
            <circle cx="110" cy="114" r="1.8" fill="#fff" />
            <circle cx="154" cy="114" r="1.8" fill="#fff" />
            <!-- Venita de furia -->
            <path d="M174 84 L182 90 L176 96 M188 84 L182 90 L189 96" stroke="#e0564d" stroke-width="3" fill="none" stroke-linecap="round" />
          }
          @case ('excited') {
            <path d="M94 98 Q108 90 121 98" stroke="#3a281c" stroke-width="5.5" fill="none" stroke-linecap="round" />
            <path d="M139 98 Q152 90 166 98" stroke="#3a281c" stroke-width="5.5" fill="none" stroke-linecap="round" />
            <circle cx="108" cy="114" r="7.5" fill="#1e130c" />
            <circle cx="152" cy="114" r="7.5" fill="#1e130c" />
            <circle cx="111" cy="111" r="2.8" fill="#ffe9a6" />
            <circle cx="155" cy="111" r="2.8" fill="#ffe9a6" />
            <!-- Destellos de oro -->
            <path d="M44 90 L48 98 L56 102 L48 106 L44 114 L40 106 L32 102 L40 98 Z" fill="#e9c46a" />
            <path d="M214 78 L217 84 L223 87 L217 90 L214 96 L211 90 L205 87 L211 84 Z" fill="#e9c46a" />
          }
          @case ('bored') {
            <path d="M94 109 L121 111" stroke="#3a281c" stroke-width="5.5" stroke-linecap="round" />
            <path d="M139 111 L166 109" stroke="#3a281c" stroke-width="5.5" stroke-linecap="round" />
            <path d="M100 116 Q108 119 116 116" stroke="#1e130c" stroke-width="4" fill="none" stroke-linecap="round" />
            <path d="M144 116 Q152 119 160 116" stroke="#1e130c" stroke-width="4" fill="none" stroke-linecap="round" />
            <!-- Nube de suspiro -->
            <text x="192" y="102" fill="#a3978a" font-size="18" font-weight="700" font-family="Cinzel, serif">…</text>
          }
          @case ('explaining') {
            <path d="M94 100 Q108 94 120 103" stroke="#3a281c" stroke-width="5.5" fill="none" stroke-linecap="round" />
            <path d="M140 105 L166 101" stroke="#3a281c" stroke-width="5.5" stroke-linecap="round" />
            <circle cx="110" cy="114" r="6" fill="#1e130c" />
            <circle cx="154" cy="114" r="6" fill="#1e130c" />
            <circle cx="112" cy="112" r="2" fill="#fff" />
            <circle cx="156" cy="112" r="2" fill="#fff" />
          }
          @default {
            <path d="M94 105 Q108 100 120 107" stroke="#3a281c" stroke-width="5.5" fill="none" stroke-linecap="round" />
            <path d="M140 107 Q152 100 166 105" stroke="#3a281c" stroke-width="5.5" fill="none" stroke-linecap="round" />
            <circle cx="108" cy="115" r="5.5" fill="#1e130c" />
            <circle cx="152" cy="115" r="5.5" fill="#1e130c" />
            <circle cx="110" cy="113" r="1.8" fill="#fff" />
            <circle cx="154" cy="113" r="1.8" fill="#fff" />
          }
        }

        <!-- Boca según pose -->
        <g class="m-mouth">
          @if (p === 'excited') {
            <path d="M112 151 Q130 172 148 151 Z" fill="#4b1914" stroke="#2a140e" stroke-width="2.5" />
            <path d="M117 153 L143 153" stroke="#f5ead6" stroke-width="3" stroke-linecap="round" />
          } @else if (p === 'angry') {
            <path d="M112 162 Q130 148 148 162 Z" fill="#4b1914" stroke="#2a140e" stroke-width="2.5" />
            <path d="M118 158 L122 152 L126 158 M134 158 L138 152 L142 158" stroke="#f5ead6" stroke-width="2" fill="none" />
          } @else if (p === 'talking' || p === 'explaining') {
            <ellipse cx="130" cy="157" rx="13" ry="7" fill="#4b1914" stroke="#2a140e" stroke-width="2.5" />
          } @else if (p === 'bored') {
            <path d="M117 156 L143 156" stroke="#3b2316" stroke-width="3.5" stroke-linecap="round" />
          } @else {
            <path d="M117 155 Q130 160 143 154" stroke="#3b2316" stroke-width="3.5" fill="none" stroke-linecap="round" />
          }
        </g>

        <!-- Sombrero de buhonero con pluma -->
        <path d="M54 88 Q130 104 206 88 Q186 72 130 70 Q74 72 54 88 Z" fill="#3b2618" stroke="#1a0f08" stroke-width="3.5" />
        <path d="M78 80 C84 36, 176 36, 182 80 Z" fill="#4c311e" stroke="#1a0f08" stroke-width="3.5" />
        <path d="M80 77 Q130 86 180 77" stroke="#d4a64a" stroke-width="6" fill="none" />
        <!-- Pluma roja/dorada -->
        <path d="M174 72 C202 52, 206 28, 190 22 C180 34, 174 52, 170 72 Z" fill="#b5413a" stroke="#3a120f" stroke-width="2.5" />
      </g>

      <!-- Gesto de mano en EXPLAINING o EXCITED -->
      @if (p === 'explaining') {
        <g class="m-hand">
          <circle cx="204" cy="204" r="15" fill="#dfb08a" stroke="#3b2316" stroke-width="3" />
          <path d="M204 189 L204 166" stroke="#dfb08a" stroke-width="9" stroke-linecap="round" />
          <path d="M204 189 L204 166" stroke="#3b2316" stroke-width="2.5" stroke-linecap="round" />
        </g>
      } @else if (p === 'excited') {
        <g class="m-hand">
          <circle cx="56" cy="196" r="14" fill="#dfb08a" stroke="#3b2316" stroke-width="3" />
          <circle cx="56" cy="176" r="10" fill="#e9c46a" stroke="#5d3f0d" stroke-width="2.5" />
        </g>
      }
    </svg>
  `,
})
export class MerchantArtComponent {
  pose = input<MerchantPose>('idle');
  speaking = input(false);
}
