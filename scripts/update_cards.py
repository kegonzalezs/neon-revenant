# Sustituye la ilustración SVG de cada tarjeta de sector por una captura real
# del escenario voxel, y pone al día nombres y descripciones.
import io, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'index.html')
SHOTS = os.path.join(ROOT, 'shots')
ART = os.path.join(ROOT, 'art')
os.makedirs(ART, exist_ok=True)

WORLDS = [
    ('rooftop',    'PRADERAS FELICES',  'SECTOR 01 // PRAEDIA'),
    ('hive',       'BOSQUE ENCANTADO',  'SECTOR 02 // NEMUS'),
    ('docks',      'DESIERTO SOLAR',    'SECTOR 03 // SOLIS'),
    ('spire',      'CIUDAD CYBERPUNK',  'SECTOR 04 // NEXO'),
    ('scrapyard',  'HIELO ETERNO',      'SECTOR 05 // GLACIES'),
    ('refinery',   'FÁBRICA INFERNAL',  'SECTOR 06 // FORNAX'),
    ('cathedral',  'CASTILLO OSCURO',   'SECTOR 07 // NOX'),
    ('undercity',  'RUINAS ANTIGUAS',   'SECTOR 08 // RUINA'),
    ('terminus',   'VOLCÁN ROJO',       'SECTOR 09 // IGNIS'),
    ('greenhouse', 'ISLA TROPICAL',     'SECTOR 10 // AQUA'),
    ('foundry',    'ESPACIO INFINITO',  'SECTOR 11 // ASTRA'),
    ('nullspace',  'CIUDAD CELESTIAL',  'SECTOR 12 // CAELUM'),
]

DESC = {
 'rooftop':    'Praderas de bloques a mediodía: mesetas de hierba, cortados de piedra, riachuelos con puentes y un castillo blanco en el horizonte.',
 'hive':       'Bosque de setas gigantes que brillan. Niebla turquesa, ruinas con musgo y agua que emite luz bajo los pies.',
 'docks':      'Dunas y mesetas de arena roja bajo un sol partido. Sombra escasa, arena que cruje y ruinas enterradas.',
 'spire':      'Rascacielos de bloques y neón vertical. Azoteas de cristal, pasarelas y lluvia violeta sobre el vacío.',
 'scrapyard':  'Glaciar de bloques azules: plataformas de hielo, grietas profundas y ventisca a ras de suelo.',
 'refinery':   'Naves de ladrillo, chimeneas encendidas y lava corriendo entre pasarelas de metal.',
 'cathedral':  'Fortaleza de piedra negra con estandartes. Patio de losas, torres altas y una luna roja encima.',
 'undercity':  'Templo devorado por la selva: columnas caídas, escalinatas y agua verdosa entre los bloques.',
 'terminus':   'Cráter abierto y ríos de magma. Ceniza en el aire y roca que se parte bajo las botas.',
 'greenhouse': 'Atolón de arena y palmeras rodeado de mar. Agua turquesa, pasarelas de madera y sol alto.',
 'foundry':    'Asteroide a la deriva: bloques de basalto flotando sobre un cielo estrellado sin fondo.',
 'nullspace':  'Ciudad de mármol blanco entre las nubes. Terrazas flotantes, cúpulas doradas y luz difusa.',
}

# ---- 1 · recortes de las capturas -----------------------------------------
for wid, _, _ in WORLDS:
    src = os.path.join(SHOTS, wid + '.png')
    if not os.path.exists(src):
        print('falta captura', wid); sys.exit(1)
    im = Image.open(src).convert('RGB')
    W, H = im.size
    # Banda central 2.13:1 (proporción de la tarjeta), sin HUD arriba ni abajo.
    ch = int(W / 2.13)
    top = max(0, int(H * 0.36) - ch // 2)
    if top + ch > H: top = H - ch
    im = im.crop((0, top, W, top + ch)).resize((640, 300), Image.LANCZOS)
    im.save(os.path.join(ART, 'sec_%s.jpg' % wid), quality=84, optimize=True)

# ---- 2 · HTML --------------------------------------------------------------
html = io.open(HTML, encoding='utf-8').read()

for wid, name, head in WORLDS:
    # 2a. SVG -> img (dentro de la tarjeta de ese nivel). Idempotente: si la
    # tarjeta ya lleva una imagen, solo se refresca el src.
    key = 'data-level="%s"' % wid
    i = html.find(key)
    if i < 0:
        print('sin tarjeta', wid); sys.exit(1)
    j = html.find('<svg', i)
    k = html.find('</svg>', j) if j >= 0 else -1
    img = '<img class="sec-art" src="art/sec_%s.jpg" alt="%s" loading="lazy">' % (wid, name)
    if j >= 0 and k > j and (html.find('<img', i) < 0 or html.find('<img', i) > j):
        html = html[:j] + img + html[k + len('</svg>'):]

    # 2b. cabecera y descripción de esa tarjeta
    i = html.find(key)
    seg_end = html.find('</button>', i)
    seg = html[i:seg_end]
    seg2 = re.sub(r'(<div class="sec-head"><span>)[^<]*(</span><b>)[^<]*(</b>)',
                  lambda m: m.group(1) + head + m.group(2) + name + m.group(3), seg, count=1)
    seg2 = re.sub(r'<p>.*?</p>', '<p>' + DESC[wid] + '</p>', seg2, count=1, flags=re.S)
    html = html[:i] + seg2 + html[seg_end:]

# 2c. textos sueltos del HUD
html = html.replace('VANTA // PLAZA MERIDIANA // VETERANO', 'VANTA // PRADERAS FELICES // VETERANO')
html = html.replace('<small id="sector-label">PLAZA MERIDIANA</small>', '<small id="sector-label">PRADERAS FELICES</small>')

io.open(HTML, 'w', encoding='utf-8', newline='\n').write(html)
print('tarjetas actualizadas:', len(WORLDS))
