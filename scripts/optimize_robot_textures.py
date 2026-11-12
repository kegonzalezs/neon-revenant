"""Normaliza las texturas 4096² del GLB del robot a 2048².

El GLB original de Meshy pesa 34 MB: tres PNG de 7.3 / 16.0 / 9.3 MB. En
arranques en frío Chromium falla al decodificar el blob de 15.9 MB
("THREE.GLTFLoader: Couldn't load texture blob:..."), el robot se queda sin
mapa base y el renderer suelta un error. Los otros cuatro héroes ya usan 2048²;
dejar el robot en el mismo tamaño elimina la carrera y reduce ~4x la memoria
de decodificación por cambio de personaje.

Solo se reescriben los bufferViews de imagen; geometría, skin, animaciones,
accessors y materiales quedan byte a byte idénticos (se reempaqueta BIN0 y se
actualizan los byteOffset).

Uso: python scripts/optimize_robot_textures.py
"""
import io
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbx_glb import load_glb, save_glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'characters', 'robot_voxel_mixamo.glb')
TMP = SRC + '.tmp'
TEX_SIZE = 2048


def optimise():
    j, bins = load_glb(SRC)
    views = j['bufferViews']
    image_views = {im['bufferView']: im for im in j.get('images', [])
                   if 'bufferView' in im}
    if not image_views:
        raise RuntimeError('el GLB no tiene imagenes embebidas')

    replacements = {}
    for idx, im in image_views.items():
        bv = views[idx]
        off, size = bv.get('byteOffset', 0), bv['byteLength']
        raw = bins[off:off + size]
        src = Image.open(io.BytesIO(raw))
        src.load()
        mode, before = src.mode, src.size
        small = src.convert('RGBA' if 'A' in mode else 'RGB').resize(
            (TEX_SIZE, TEX_SIZE), Image.LANCZOS)
        buf = io.BytesIO()
        small.save(buf, format='PNG', optimize=True)
        replacements[idx] = buf.getvalue()
        print(f'  image[{idx}] {im.get("name")}: {before} {mode} '
              f'{len(raw)/1048576:.1f} MB -> {TEX_SIZE}x{TEX_SIZE} '
              f'{len(replacements[idx])/1048576:.1f} MB')

    # Reempaqueta BIN0 conservando el orden original de los bufferViews y los
    # huecos (por si el exportador dejó alguno), con alineación a 4 bytes.
    order = sorted(range(len(views)), key=lambda i: views[i].get('byteOffset', 0))
    out = bytearray()
    cursor = 0
    new_offsets = {}
    for idx in order:
        bv = views[idx]
        off, size = bv.get('byteOffset', 0), bv['byteLength']
        if off < cursor:
            raise RuntimeError(f'bufferViews solapados en {idx}')
        if off > cursor:
            out += bins[cursor:off]
        while len(out) % 4:
            out += b'\0'
        new_offsets[idx] = len(out)
        out += replacements.get(idx, bins[off:off + size])
        cursor = off + size
    if cursor < len(bins):
        out += bins[cursor:]

    for idx, off in new_offsets.items():
        views[idx]['byteOffset'] = off
    for idx, data in replacements.items():
        views[idx]['byteLength'] = len(data)

    save_glb(TMP, j, bytes(out))
    return j, bins


def validate(j0, bins0):
    j, bins = load_glb(TMP)
    assert len(j['animations']) == len(j0['animations']), 'animaciones perdidas'
    assert len(j['skins']) == len(j0['skins']), 'skins perdidas'
    assert len(j['meshes']) == len(j0['meshes']), 'mallas perdidas'
    assert len(j['accessors']) == len(j0['accessors']), 'accessors perdidos'
    assert len(j['nodes']) == len(j0['nodes']), 'nodos perdidos'
    for i, bv in enumerate(j['bufferViews']):
        off, size = bv.get('byteOffset', 0), bv['byteLength']
        assert off + size <= len(bins), f'bufferView {i} fuera de BIN0'
        assert off % 4 == 0, f'bufferView {i} desalineado'
    comp_bytes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    for i, a in enumerate(j['accessors']):
        bv = j['bufferViews'][a['bufferView']]
        stride = bv.get('byteStride') or comp_bytes[a['componentType']] * ncomp[a['type']]
        need = a.get('byteOffset', 0) + (a['count'] - 1) * stride + comp_bytes[a['componentType']] * ncomp[a['type']]
        assert need <= bv['byteLength'], f'accessor {i} fuera de su bufferView'
    for i, im in enumerate(j['images']):
        bv = j['bufferViews'][im['bufferView']]
        raw = bins[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']]
        pic = Image.open(io.BytesIO(raw))
        pic.load()
        assert pic.size == (TEX_SIZE, TEX_SIZE), f'imagen {i} mal redimensionada'
    # POSITION del primer accessor debe ser idéntico al original.
    def pos(jj, bb):
        a = jj['accessors'][0]
        bv = jj['bufferViews'][a['bufferView']]
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return bb[o:o + min(64, bv['byteLength'])]
    assert pos(j, bins) == pos(j0, bins0), 'la geometría cambió'
    print(f'  validado: {len(j["animations"])} animaciones, '
          f'{len(j["skins"])} skin, {len(j["bufferViews"])} bufferViews, '
          f'{len(j["images"])} imagenes 2048²')


def main():
    before = os.path.getsize(SRC)
    print(f'Optimizando {os.path.basename(SRC)} ({before/1048576:.1f} MB)')
    j0, bins0 = optimise()
    validate(j0, bins0)
    after = os.path.getsize(TMP)
    os.replace(TMP, SRC)
    print(f'Listo: {before/1048576:.1f} MB -> {after/1048576:.1f} MB '
          f'(-{(1-after/before)*100:.0f}%)')


if __name__ == '__main__':
    main()
