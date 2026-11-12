"""Genera los sprites pixel-art (9-slice + texturas) de la capa visual del juego.

Uso:  python scripts/gen-pixel-ui.py
Salida: assets/ui/pixel/*.png

Todo se dibuja pixel a pixel sin antialiasing. Cada sprite de marco se consume
con `border-image: url(...) N / Npx / 0 round`, donde N es el slice indicado
en SPRITES: las esquinas se dibujan 1:1 (sin escalado) y los cantos se
repiten, de modo que el resultado sigue siendo nitido a cualquier tamano.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'ui' / 'pixel'
OUT.mkdir(parents=True, exist_ok=True)

# --- Paleta tomada de las dos referencias de UI -----------------------------
INK        = (26, 16, 26, 255)   # contorno casi negro
INK_SOFT   = (49, 36, 56, 255)   # #312438 ciruela oscuro
PLUM       = (71, 46, 76, 255)   # #472e4c fondo
SLATE      = (93, 86, 130, 255)  # #5d5682 pizarra violeta
SLATE_HI   = (126, 116, 166, 255)
SLATE_MID  = (86, 79, 121, 255)
SLATE_DK   = (62, 52, 77, 255)
SLATE_DEEP = (40, 31, 56, 255)

WOOD       = (143, 87, 60, 255)  # #8f573c madera
WOOD_HI    = (186, 128, 80, 255)
WOOD_MID   = (156, 98, 66, 255)
WOOD_DK    = (102, 58, 49, 255)
WOOD_DEEP  = (58, 31, 22, 255)
CREAM      = (246, 224, 168, 255)
TAN        = (156, 142, 117, 255)  # #9c8e75 pergamino
TAN_HI     = (181, 166, 136, 255)
TAN_DK     = (128, 116, 96, 255)

GOLD       = (255, 207, 74, 255)
GOLD_DK    = (150, 106, 26, 255)
GREEN      = (30, 131, 75, 255)   # #1e834b
GREEN_HI   = (74, 183, 108, 255)
GREEN_DK   = (14, 63, 33, 255)
LIME       = (214, 226, 84, 255)
AMBER_BTN  = (131, 108, 30, 255)  # #836c1e
AMBER_HI   = (206, 170, 62, 255)
AMBER_DK   = (68, 53, 12, 255)
RED        = (131, 28, 29, 255)
RED_HI     = (190, 66, 56, 255)
RED_DK     = (72, 16, 18, 255)
BLUE       = (36, 82, 150, 255)
BLUE_HI    = (67, 124, 194, 255)
BLUE_DK    = (20, 46, 88, 255)


def step_mask(w, h, cut=6):
    """Rectangulo con esquinas escalonadas (pixel rounded corner)."""
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rectangle((cut, 0, w - cut - 1, h - 1), fill=255)
    d.rectangle((cut - 2, 2, w - cut + 1, h - 3), fill=255)
    d.rectangle((cut - 4, 4, w - cut + 3, h - 5), fill=255)
    d.rectangle((0, cut, w - 1, h - cut - 1), fill=255)
    d.rectangle((2, cut - 2, w - 3, h - cut + 1), fill=255)
    d.rectangle((4, cut - 4, w - 5, h - cut + 3), fill=255)
    return m


def frame_sprite(w, h, cut, outline, pal, accent=None, grain=False, cracks=False):
    """Marco 9-slice: contorno duro, cara biselada y extrusion inferior.

    pal = (hi, mid, base, dark, deep) de arriba abajo.
    """
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    outer = step_mask(w, h, cut)
    img.paste(outline, (0, 0), outer)

    o = 3  # grosor del contorno
    inner_mask = Image.new('L', (w, h), 0)
    inner_mask.paste(step_mask(w - 2 * o, h - 2 * o, max(2, cut - o)), (o, o))
    hi, mid, base, dark, deep = pal
    px = img.load()
    im = inner_mask.load()
    for y in range(h):
        for x in range(w):
            if not im[x, y]:
                continue
            if y < o + 2:
                c = hi
            elif y < o + 4:
                c = mid
            elif y >= h - o - 2:
                c = deep
            elif y >= h - o - 5:
                c = dark
            else:
                c = base
                # Dither determinista: textura de bloques, nunca degradado.
                if (x * 7 + y * 13) % 17 == 0:
                    c = dark
                elif (x * 11 + y * 5) % 23 == 0:
                    c = mid
                if grain and (y + x // 9) % 9 == 0:
                    c = dark
            # Bisel lateral: luz a la izquierda, sombra a la derecha.
            if o <= y < h - o - 5:
                if x < o + 2:
                    c = hi
                elif x >= w - o - 2:
                    c = dark
            px[x, y] = c

    if accent:
        d = ImageDraw.Draw(img)
        d.rectangle((o + 1, o + 1, w - o - 2, h - o - 2), outline=accent)
        # La extrusion inferior vuelve a pintarse encima: en la referencia el
        # canto de la tecla es oscuro, no una linea clara.
        d.rectangle((o + 2, h - o - 6, w - o - 3, h - o - 3), fill=deep)
        d.rectangle((o + 2, h - o - 2, w - o - 3, h - o - 2), fill=deep)

    if cracks:
        d = ImageDraw.Draw(img)
        # Grietas de 1 px en la madera, como en la referencia.
        for cx, cy, length in ((12, 20, 9), (w - 18, 12, 7), (w // 2, h - 14, 6)):
            for k in range(length):
                xx = cx + k + (k // 3)
                yy = cy + k // 2
                if o + 5 < xx < w - o - 5 and o + 5 < yy < h - o - 7:
                    d.point((xx, yy), fill=WOOD_DEEP)
                    if k % 3 == 0:
                        d.point((xx, yy + 1), fill=WOOD_HI)
    return img


def ornate_sprite(w=64, h=64, cut=8, wood=False):
    """Marco de tarjeta de tienda / ficha RPG: doble filete dorado y esquinas
    ornamentadas en L, con cara de pizarra oscura o de madera."""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    outer = step_mask(w, h, cut)
    img.paste(INK, (0, 0), outer)
    d = ImageDraw.Draw(img)

    face = WOOD if wood else (58, 37, 64, 255)
    face_alt = WOOD_DK if wood else (49, 32, 56, 255)
    face_hi = WOOD_MID if wood else (72, 48, 78, 255)
    d.rectangle((4, 4, w - 5, h - 5), fill=face)
    px = img.load()
    for y in range(4, h - 4):
        for x in range(4, w - 4):
            if (x * 7 + y * 13) % 19 == 0:
                px[x, y] = face_alt
            elif (x * 11 + y * 5) % 31 == 0:
                px[x, y] = face_hi
            if wood and (y + x // 9) % 9 == 0:
                px[x, y] = WOOD_DK

    # Doble filete dorado, como en las fichas de equipo de la referencia.
    d.rectangle((4, 4, w - 5, h - 5), outline=GOLD_DK)
    d.rectangle((6, 6, w - 7, h - 7), outline=(206, 160, 62, 255))
    d.rectangle((8, 8, w - 9, h - 9), outline=(92, 60, 24, 255))

    # Motivos en L en las cuatro esquinas (adornos pixel a pixel).
    for sx, sy, dx, dy in ((10, 10, 1, 1), (w - 11, 10, -1, 1),
                           (10, h - 11, 1, -1), (w - 11, h - 11, -1, -1)):
        for k in range(7):
            d.point((sx + dx * k, sy), fill=GOLD)
            d.point((sx, sy + dy * k), fill=GOLD)
        d.point((sx + dx * 2, sy + dy * 2), fill=GOLD)
        d.point((sx + dx * 3, sy + dy * 1), fill=GOLD_DK)
        d.point((sx + dx * 1, sy + dy * 3), fill=GOLD_DK)

    # Canto inferior extruido.
    d.rectangle((4, h - 8, w - 5, h - 5), fill=WOOD_DEEP if wood else INK_SOFT)
    d.rectangle((4, h - 5, w - 5, h - 5), fill=INK)
    return img


def texture_tile(w, h, base, alt1, alt2=None, grain=False):
    img = Image.new('RGBA', (w, h), base)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if (x * 3 + y * 5) % 13 == 0:
                px[x, y] = alt1
            elif alt2 and (x * 7 + y * 2) % 19 == 0:
                px[x, y] = alt2
            elif grain and y % 5 == 0 and (x + y) % 4:
                px[x, y] = alt1
    return img


def checker_floor(size=64, cell=32):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, size - 1, size - 1), fill=(65, 43, 60, 255))
    d.rectangle((0, 0, cell - 1, cell - 1), fill=(124, 91, 70, 255))
    d.rectangle((cell, cell, size - 1, size - 1), fill=(124, 91, 70, 255))
    d.rectangle((cell - 2, 0, cell + 1, size - 1), fill=(38, 25, 38, 255))
    d.rectangle((0, cell - 2, size - 1, cell + 1), fill=(38, 25, 38, 255))
    for y in range(2, size, 6):
        for x in range(2, size, 7):
            if (x // 7 + y // 6) % 3 == 0:
                d.point((x, y), fill=(150, 112, 82, 255))
    return img


def save(img, name, scale=1):
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(OUT / name)
    return img


# --- Marcos y botones (w, h, cut, contorno, paleta, acento, vetas, grietas) --
SPRITES = [
    ('panel-slate.png', 48, 48, 7, INK,
     (SLATE_HI, SLATE_MID, SLATE, SLATE_DK, SLATE_DEEP), None, False, False),
    ('panel-plum.png', 48, 48, 7, INK,
     (SLATE_MID, SLATE_DK, INK_SOFT, SLATE_DEEP, INK), None, False, False),
    ('panel-wood.png', 48, 48, 7, INK,
     (WOOD_HI, WOOD_MID, WOOD, WOOD_DK, WOOD_DEEP), None, True, True),
    ('panel-parchment.png', 48, 48, 7, INK,
     (TAN_HI, TAN, TAN, TAN_DK, WOOD_DEEP), None, True, False),
    ('header-plate.png', 48, 28, 6, INK,
     (SLATE_DK, INK_SOFT, INK_SOFT, SLATE_DEEP, INK), GOLD_DK, False, False),

    ('btn-wood.png', 48, 32, 7, INK,
     (WOOD_HI, WOOD_MID, WOOD, WOOD_DK, WOOD_DEEP), None, True, True),
    ('btn-green.png', 48, 32, 7, INK,
     (GREEN_HI, GREEN, GREEN, GREEN_DK, (10, 45, 24, 255)), LIME, False, False),
    ('btn-gold.png', 48, 32, 7, INK,
     (AMBER_HI, AMBER_BTN, AMBER_BTN, AMBER_DK, (44, 34, 8, 255)), GOLD, False, False),
    ('btn-red.png', 48, 32, 7, INK,
     (RED_HI, RED, RED, RED_DK, (45, 10, 12, 255)), (196, 84, 78, 255), False, False),
    ('btn-blue.png', 48, 32, 7, INK,
     (BLUE_HI, BLUE, BLUE, BLUE_DK, (12, 30, 58, 255)), (120, 176, 226, 255), False, False),
    ('btn-slate.png', 48, 32, 7, INK,
     (SLATE_HI, SLATE_MID, SLATE, SLATE_DK, SLATE_DEEP), (176, 164, 210, 255), False, False),

    ('frame-icon.png', 28, 28, 5, INK,
     (WOOD_HI, WOOD_MID, WOOD_DK, WOOD_DEEP, INK), GOLD_DK, True, False),
    ('frame-hud.png', 32, 32, 6, INK,
     (SLATE_HI, SLATE_MID, SLATE, SLATE_DK, SLATE_DEEP), None, False, False),
]

previews = []
for spec in SPRITES:
    name, w, h, cut, outline, pal, accent, grain, cracks = spec
    img = frame_sprite(w, h, cut, outline, pal, accent, grain, cracks)
    save(img, name)
    previews.append((name, img))

for name, wood in (('panel-ornate.png', False), ('panel-sheet.png', True)):
    img = ornate_sprite(64, 64, 8, wood)
    save(img, name)
    previews.append((name, img))

# --- Texturas repetibles ----------------------------------------------------
tiles = {
    'tile-slate.png': texture_tile(8, 8, SLATE, SLATE_MID, SLATE_DK),
    'tile-plum.png': texture_tile(8, 8, INK_SOFT, SLATE_DEEP, None),
    'tile-wood.png': texture_tile(8, 8, WOOD, WOOD_DK, WOOD_MID, grain=True),
    'tile-tan.png': texture_tile(8, 8, TAN, TAN_DK, TAN_HI, grain=True),
    'tile-bg.png': texture_tile(16, 16, PLUM, (77, 50, 82, 255), (63, 41, 68, 255)),
}
for name, img in tiles.items():
    save(img, name)
    previews.append((name, img))

floor = checker_floor()
save(floor, 'floor.png')
previews.append(('floor.png', floor))

# --- Hoja de contacto para revision visual ---------------------------------
scale = 4
cols, pad, label_h = 4, 18, 16
cell_w = max(i.width for _, i in previews) * scale + pad
cell_h = max(i.height for _, i in previews) * scale + pad + label_h
rows = (len(previews) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (32, 24, 34))
sd = ImageDraw.Draw(sheet)
for idx, (name, img) in enumerate(previews):
    cx, cy = (idx % cols) * cell_w, (idx // cols) * cell_h
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    sheet.paste(big, (cx + pad // 2, cy + pad // 2), big if img.mode == 'RGBA' else None)
    sd.text((cx + 4, cy + big.height + pad // 2 + 2), name, fill=(240, 220, 170))
sheet.save(ROOT / 'pixel-ui-sheet.png')

print('sprites:', len(SPRITES), 'tiles:', len(tiles), 'sheet: pixel-ui-sheet.png')
print('outdir:', OUT)
