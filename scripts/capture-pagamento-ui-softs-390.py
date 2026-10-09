#!/usr/bin/env python3
"""UI softs #257 — glossário Em custódia + skeleton S3 a 390×844 (light/dark)."""
from __future__ import annotations

import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

OUT = os.environ.get('ARTIFACTS_DIR', '/opt/cursor/artifacts')


def draw_screen(path: str, dark: bool) -> None:
    w, h = 390, 844
    bg = (15, 23, 42) if dark else (248, 250, 252)
    card = (30, 41, 59) if dark else (255, 255, 255)
    border = (51, 65, 85) if dark else (241, 245, 249)
    title_c = (248, 250, 252) if dark else (15, 23, 42)
    muted = (148, 163, 184) if dark else (100, 116, 139)
    body = (226, 232, 240) if dark else (30, 41, 59)
    img = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(img)
    font_h = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
    font_s = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
    font_b = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
    font_chip = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)

    d.text((20, 48), 'Detalhe do acordo', fill=title_c, font=font_h)

    # Cartão S3 — skeleton (sem 0 Kz)
    cx, cy, cw, ch = 20, 100, 350, 120
    d.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=12, fill=card, outline=border, width=1)
    sk = (71, 85, 105) if dark else (226, 232, 240)
    d.rounded_rectangle([cx + 56, cy + 24, cx + 320, cy + 38], radius=4, fill=sk)
    d.rounded_rectangle([cx + 56, cy + 50, cx + 280, cy + 64], radius=4, fill=sk)
    d.text((cx + 16, cy + 88), 'A carregar valor…', fill=muted, font=font_b)

    # Glossário passageiros
    d.text((20, 250), 'PASSAGEIROS · 2', fill=muted, font=font_s)
    gy = 280
    gloss = (
        ('Reservado', 'Lugar ocupado após aceite — aguarda pagamento validado para confirmar.'),
        ('Confirmado', 'Lugar confirmado no acordo após validação do pagamento.'),
        (
            'Em custódia',
            'Valor recebido e retido pela plataforma até libertar ao motorista.',
        ),
    )
    for term, desc in gloss:
        d.rounded_rectangle([20, gy, 370, gy + 52], radius=12, fill=card, outline=border, width=1)
        line = f'{term}: {desc}'
        y = gy + 14
        for wrapped in textwrap.wrap(line, width=48):
            if wrapped.startswith(term):
                d.text((28, y), f'{term}:', fill=body, font=font_b)
                rest = wrapped[len(term) + 1 :].strip()
                if rest:
                    d.text((28 + d.textlength(f'{term}: ', font=font_b), y), rest, fill=muted, font=font_b)
            else:
                d.text((28, y), wrapped, fill=muted, font=font_b)
            y += 16
        gy += 58

    # Chip exemplo
    d.rounded_rectangle([20, gy + 8, 130, gy + 32], radius=12, fill=(51, 65, 85) if dark else (241, 245, 249))
    d.text((28, gy + 12), 'Pagamento cancelado', fill=body, font=font_chip)

    img.save(path)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    draw_screen(f'{OUT}/pagamento-ui-softs-light-390.png', False)
    draw_screen(f'{OUT}/pagamento-ui-softs-dark-390.png', True)
    print('OK', OUT)


if __name__ == '__main__':
    main()
