"""Extrae los sprites Kenney Particle Pack y los SFX de RPG Audio / Sci-Fi Sounds.

Solo se copian los PNG con transparencia (los de fondo negro no sirven para
AdditiveBlending) y los .ogg de las dos bibliotecas de audio. Los ZIP de origen
quedan intactos: no se crean carpetas temporales de extraccion.

Uso: python scripts/extract_combat_assets.py
"""
import os
import zipfile

SRC = 'C:/Users/kjgs2/Desktop/Material Neon Revenant/Material armas'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTICLES = os.path.join(ROOT, 'assets', 'vfx', 'particles')
AUDIO = os.path.join(ROOT, 'assets', 'audio')


def copy_pack(zip_name, out_dir, predicate):
    os.makedirs(out_dir, exist_ok=True)
    z = zipfile.ZipFile(os.path.join(SRC, zip_name))
    n = 0
    for entry in z.namelist():
        if entry.endswith('/') or not predicate(entry):
            continue
        name = os.path.basename(entry)
        with open(os.path.join(out_dir, name), 'wb') as fh:
            fh.write(z.read(entry))
        n += 1
    return n


def main():
    p = copy_pack(
        'kenney_particle-pack.zip', PARTICLES,
        lambda n: n.startswith('PNG (Transparent)/') and n.lower().endswith('.png'))
    r = copy_pack(
        'kenney_rpg-audio.zip', os.path.join(AUDIO, 'rpg'),
        lambda n: n.startswith('Audio/') and n.lower().endswith('.ogg'))
    s = copy_pack(
        'kenney_sci-fi-sounds.zip', os.path.join(AUDIO, 'scifi'),
        lambda n: n.startswith('Audio/') and n.lower().endswith('.ogg'))
    print('particles=%d  rpg=%d  scifi=%d' % (p, r, s))


if __name__ == '__main__':
    main()
