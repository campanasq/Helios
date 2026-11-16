"""Genera una textura de pergamino seamless (se repite sin costuras) mediante ruido espectral."""
# Uso: python3 scripts/generate-parchment.py public/textures/parchment.webp 11
import sys
import numpy as np
from PIL import Image

N = 1024
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
fx = np.fft.fftfreq(N)[None, :]
fy = np.fft.fftfreq(N)[:, None]

def noise(beta, ax=1.0, ay=1.0, lo=0.0):
    """Ruido 1/f^beta periódico (seamless por construcción), normalizado a 0..1."""
    f = np.sqrt((fx * ax) ** 2 + (fy * ay) ** 2)
    f[0, 0] = 1
    spec = np.fft.fft2(rng.standard_normal((N, N))) / f ** beta
    if lo:
        spec[f < lo] = 0
    n = np.real(np.fft.ifft2(spec))
    return (n - n.min()) / (n.max() - n.min())

stains = noise(2.4)                     # manchas grandes
mottle = noise(1.7)                     # moteado medio
fibers = noise(1.1, ax=1.0, ay=9.0)     # fibras horizontales del papel
fibers2 = noise(1.1, ax=7.0, ay=1.0)    # algunas verticales, más suaves
grain = noise(0.2)                      # grano fino

t = (0.40 * stains ** 1.6 + 0.30 * mottle + 0.07 * fibers + 0.07 * fibers2 + 0.16 * grain)
t = (t - t.min()) / (t.max() - t.min())
# manchitas oscuras ocasionales (zonas donde el ruido medio es muy alto)
spots = np.clip((mottle - 0.78) * 6, 0, 1) * 0.35
t = np.clip(t * 0.85 + spots, 0, 1)

light = np.array([240, 226, 192])   # papel claro
mid = np.array([222, 198, 150])
dark = np.array([170, 128, 74])     # tono envejecido
tt = t[..., None]
rgb = np.where(tt < 0.55, light + (mid - light) * (tt / 0.55), mid + (dark - mid) * ((tt - 0.55) / 0.45))
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(sys.argv[1], 'WEBP', quality=82, method=6)
