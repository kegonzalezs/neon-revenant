"""Extrae del ZIP de game-icons.net los iconos del catalogo unificado (80 + 5
sinergias) y genera `src/skill-icons.js`.

Los SVG originales son blanco sobre fondo negro: un <path> de fondo
"M0 0h512v512H0z" y uno o mas <path fill="#fff"> de figura. Para poder
tintarlos con CSS segun clase/rareza se elimina el fondo y todo relleno se
sustituye por `currentColor`. El modulo resultante es SINCRONO (cero IPC,
cero fetch): el renderer puede pintar una carta en el mismo frame.

Uso:  python scripts/build_skill_icons.py [ruta/al/zip]
"""
import collections
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    r'~\Downloads\game-icons.net.svg.zip')
OUT_DIR = os.path.join(ROOT, 'assets', 'ui', 'icons')
OUT_JS = os.path.join(ROOT, 'src', 'skill-icons.js')

# ---------------------------------------------------------------------------
# Mapa exacto: id del item -> nombre de icono en game-icons.net.
# Temas: Arrow & Spear (arquero), Blade/Axe (barbaro), Magic/Symbol (bruja),
# Sci-Fi (robot), Creature (vampiro), Tarot/Skull (pactos), Objetos (reliquias).
# ---------------------------------------------------------------------------
ICON_MAP = {
    # --- EL ARQUERO ---------------------------------------------------------
    'arr_shower': 'arrow-cluster',
    'arr_pierce': 'broadhead-arrow',
    'arr_bounce': 'ricochet',
    'arr_venom': 'chemical-arrow',
    'arr_sniper': 'arrow-scope',
    'arr_explosive': 'flaming-arrow',
    'arr_tailwind': 'arrow-wings',
    'arr_caltrops': 'caltrops',
    'arr_hawkeye': 'eye-target',
    'arr_vertical': 'pentarrows-tornado',
    # --- EL BARBARO ---------------------------------------------------------
    'bar_giant': 'battle-axe',
    'bar_whirl': 'sword-spin',
    'bar_ember': 'fire-axe',
    'bar_quake': 'quake-stomp',
    'bar_throw': 'hatchets',
    'bar_stone': 'stone-pile',
    'bar_cry': 'shouting',
    'bar_thirst': 'enrage',
    'bar_rift': 'volcano',
    'bar_unstop': 'push',
    # --- LA BRUJA -----------------------------------------------------------
    'wit_seek': 'concentration-orb',
    'wit_chain': 'chain-lightning',
    'wit_singularity': 'black-hole-bolas',
    'wit_nova': 'magic-swirl',
    'wit_crystal': 'crystal-shine',
    'wit_familiar': 'floating-crystal',
    'wit_curse': 'cursed-star',
    'wit_blink': 'teleport',
    'wit_meteor': 'meteor-impact',
    'wit_echo': 'boomerang',
    # --- EL ROBOT -----------------------------------------------------------
    'bot_beam': 'laser-precision',
    'bot_drone': 'delivery-drone',
    'bot_emp': 'stun-grenade',
    'bot_overload': 'battery-100',
    'bot_split': 'laser-sparks',
    'bot_turret': 'laser-turret',
    'bot_magnet': 'magnet-blast',
    'bot_missile': 'missile-swarm',
    'bot_shield': 'energy-shield',
    'bot_cooling': 'cooler',
    # --- EL VAMPIRO ---------------------------------------------------------
    'vam_bats': 'bat',
    'vam_daggers': 'flying-dagger',
    'vam_pool': 'blood',
    'vam_overheal': 'heart-battery',
    'vam_frenzy': 'bestial-fangs',
    'vam_shadow': 'cloak-dagger',
    'vam_mist': 'fog',
    'vam_stake': 'heart-stake',
    'vam_pact': 'bleeding-heart',
    'vam_burst': 'spiky-explosion',
    # --- 20 RELIQUIAS GENERALES --------------------------------------------
    'rel_magnet': 'magnet',
    'rel_mercury': 'boots',
    'rel_titan': 'crowned-heart',
    'rel_prism': 'prism',
    'rel_static': 'lightning-dome',
    'rel_vamp': 'marrow-drain',
    'rel_berserk': 'strong',
    'rel_orbital': 'double-ringed-orb',
    'rel_echo': 'bright-explosion',
    'rel_greed': 'coins',
    'rel_hourglass': 'empty-hourglass',
    'rel_bag': 'pouch-with-beads',
    'rel_thrusters': 'jetpack',
    'rel_amulet': 'gem-necklace',
    'rel_whetstone': 'sword-smithing',
    'rel_scrap': 'spikeball',
    'rel_thorns': 'spiked-armor',
    'rel_totem': 'totem-head',
    'rel_mirror': 'mirror-mirror',
    'rel_core': 'cpu-shot',
    # --- 10 PACTOS MALDITOS ------------------------------------------------
    'pct_glass': 'cracked-shield',
    'pct_greed': 'bloody-stash',
    'pct_blind': 'blindfold',
    'pct_death': 'death-skull',
    'pct_giant': 'giant',
    'pct_unstable': 'battery-minus',
    'pct_solitary': 'broken-heart',
    'pct_chaos': 'dice-fire',
    'pct_collector': 'card-ace-spades',
    'pct_phoenix': 'burning-skull',
    # --- 5 SINERGIAS --------------------------------------------------------
    'syn_plague': 'poison-gas',
    'syn_magma': 'flame-spin',
    'syn_tesla': 'tesla-turret',
    'syn_prism': 'orbital-rays',
    'syn_night': 'batwing-emblem',
    # --- 5 ESTADISTICAS BASE (menu de fin de ronda) ------------------------
    'stat_strength': 'strong-man',
    'stat_firerate': 'fast-arrow',
    'stat_hp': 'heart-shield',
    'stat_speed': 'windy-stripes',
    'stat_luck': 'clover',
}

# Iconos que no existen en el paquete: se generan por codigo como SVG limpio.
PROCEDURAL = {
    'singularity': '<circle cx="256" cy="256" r="150" fill="none" stroke="currentColor" stroke-width="22"/>'
                   '<circle cx="256" cy="256" r="88" fill="currentColor"/>'
                   '<circle cx="256" cy="256" r="42" fill="#000"/>',
    'chain': '<path d="M96 300 L196 180 L286 300 L396 160" fill="none" stroke="currentColor" stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/>',
}

BG_PATH = re.compile(r'<path[^>]*d="M0 0h512v512H0z"[^>]*/?>', re.I)
FILL = re.compile(r'fill="(?!none")[^"]*"', re.I)
STROKE = re.compile(r'stroke="(?!none")[^"]*"', re.I)
SVG_OPEN = re.compile(r'<svg[^>]*>', re.I)
WS = re.compile(r'\s+')


def clean(raw: str) -> str:
    """Devuelve el innerHTML del SVG, tintable con currentColor."""
    inner = SVG_OPEN.sub('', raw).replace('</svg>', '')
    inner = inner.replace('<?xml version="1.0" encoding="UTF-8"?>', '')
    inner = BG_PATH.sub('', inner)
    inner = FILL.sub('fill="currentColor"', inner)
    inner = STROKE.sub('stroke="currentColor"', inner)
    # Los paths sin relleno explicito tambien deben seguir el color CSS.
    inner = re.sub(r'<(path|circle|rect|polygon|polyline|ellipse)\b(?![^>]*\bfill=)',
                   r'<\1 fill="currentColor"', inner)
    return WS.sub(' ', inner).strip()


def main():
    z = zipfile.ZipFile(ZIP)
    by_name = collections.defaultdict(list)
    for n in z.namelist():
        if n.endswith('.svg'):
            by_name[n.rsplit('/', 1)[-1][:-4]].append(n)

    os.makedirs(OUT_DIR, exist_ok=True)
    icons, missing = {}, []
    for item_id, icon_name in ICON_MAP.items():
        candidates = by_name.get(icon_name, [])
        # Preferimos la variante blanco/negro 1x1, que es la mas limpia.
        path = next((n for n in candidates if '/ffffff/' in n and '/1x1/' in n),
                    candidates[0] if candidates else None)
        if not path:
            missing.append((item_id, icon_name))
            continue
        raw = z.read(path).decode('utf-8', 'replace')
        inner = clean(raw)
        icons[item_id] = inner
        with open(os.path.join(OUT_DIR, icon_name + '.svg'), 'w', encoding='utf-8') as fh:
            fh.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
                     + inner + '</svg>\n')

    for key, markup in PROCEDURAL.items():
        icons['proc_' + key] = markup

    header = (
        '// GENERADO por scripts/build_skill_icons.py — NO editar a mano.\n'
        '// game-icons.net (CC BY 3.0), 4.180 SVG en el paquete; aqui solo los\n'
        '// %d seleccionados, sin fondo y con fill="currentColor" para teñir\n'
        '// por CSS segun clase y rareza. InnerHTML de <svg viewBox="0 0 512 512">.\n'
        '// Los que no existian en el pack se generan por codigo (prefijo proc_).\n\n' % len(icons)
    )
    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write(header)
        fh.write('export const ICON_ART = Object.freeze(' +
                 json.dumps(icons, ensure_ascii=False, separators=(',', ':')) + ');\n\n')
        fh.write('''// Devuelve un <svg> completo listo para innerHTML. `color` se aplica con CSS
// (currentColor); el fallback dibuja un rombo vectorial limpio si falta el icono.
export function svgIcon(id, cls = '', color = '') {
  const art = ICON_ART[id] || ICON_ART.proc_singularity ||
    '<path d="M256 48 448 256 256 464 64 256z" fill="currentColor"/>';
  const style = color ? ` style="color:${color}"` : '';
  return `<svg class="gi ${cls}"${style} viewBox="0 0 512 512" aria-hidden="true">${art}</svg>`;
}

// Icono generado por codigo para un concepto sin equivalente en el pack.
export function proceduralIcon(kind) {
  return `<svg class="gi" viewBox="0 0 512 512" aria-hidden="true">${ICON_ART['proc_' + kind] || ''}</svg>`;
}
''')

    print(f'iconos extraidos: {len(icons) - len(PROCEDURAL)}  |  procedurales: {len(PROCEDURAL)}')
    print(f'faltantes: {missing or "ninguno"}')
    print(f'SVG sueltos: {OUT_DIR} ({len(os.listdir(OUT_DIR))} ficheros)')
    print(f'modulo JS: {OUT_JS} ({os.path.getsize(OUT_JS) // 1024} KB)')


if __name__ == '__main__':
    main()
