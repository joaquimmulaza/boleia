#!/usr/bin/env python3
"""Modal «Sair só tu?» a 390×844 (light + dark) — artefactos de PR."""
from __future__ import annotations

import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

OUT = os.environ.get('ARTIFACTS_DIR', '/opt/cursor/artifacts')
ULTIMO = 'És o último passageiro. Ao saíres, o acordo é encerrado.'


def draw_modal(path: str, dark: bool, message: str) -> None:
    w, h = 390, 844
    bg = (15, 23, 42) if dark else (241, 245, 249)
    card = (15, 23, 42) if dark else (255, 255, 255)
    title_c = (255, 255, 255) if dark else (15, 23, 42)
    body_c = (203, 213, 225) if dark else (71, 85, 105)
    img = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, h], fill=(0, 0, 0))
    cx, cy, cw, ch = 16, 280, 358, 320
    d.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=24, fill=card)
    font_t = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    font_b = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    font_btn = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
    d.text((w // 2, cy + 32), 'Sair só tu?', fill=title_c, font=font_t, anchor='mm')
    y = cy + 70
    for line in textwrap.wrap(message, width=42):
        d.text((w // 2, y), line, fill=body_c, font=font_b, anchor='mm')
        y += 22
    d.rounded_rectangle([cx + 24, cy + ch - 110, cx + cw - 24, cy + ch - 58], radius=16, fill=(220, 38, 38))
    d.text((w // 2, cy + ch - 84), 'Sair', fill=(255, 255, 255), font=font_btn, anchor='mm')
    btn2 = (30, 41, 59) if dark else (241, 245, 249)
    d.rounded_rectangle([cx + 24, cy + ch - 50, cx + cw - 24, cy + ch - 8], radius=16, fill=btn2)
    d.text((w // 2, cy + ch - 29), 'Voltar', fill=title_c, font=font_btn, anchor='mm')
    img.save(path)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    draw_modal(f'{OUT}/leave-solo-modal-ultimo-light-390.png', False, ULTIMO)
    draw_modal(f'{OUT}/leave-solo-modal-ultimo-dark-390.png', True, ULTIMO)
    print('OK', OUT)


if __name__ == '__main__':
    main()
