"""Riggea los 4 personajes nuevos y los exporta como GLB autonomos.

Estrategia:
  * Base = 'Arquero Animado.glb' (esqueleto Mixamo de 32 huesos ya ajustado a
    las proporciones de estos modelos, 3 clips utiles, inverse bind matrices).
  * Los FBX estaticos son LA MISMA MALLA escalada x1.5746 (distancia NN ~0.0022),
    asi que se transfieren los pesos de skinning por vecino mas cercano.
  * Se anyade 'Boxing_Practice' desde el GLB del robot para que el juego
    encuentre los 4 nombres de clip que espera (guard incluido).
  * Texturas 4096 -> 2048 con filtro NEAREST: acorde al estilo pixelart 3D.

Uso: python scripts/build_characters.py
"""
import copy
import io
import os
import sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbx_glb import FBX, fbx_meshes, fbx_images, load_glb, accessor, save_glb

SRC = 'C:/Users/kjgs2/Desktop/Material Neon Revenant/Material personajes'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'assets', 'characters')
BASE = 'Arquero Animado.glb'
ROBOT = 'Robot Animado.glb'
TEX_SIZE = 2048
TARGET_HEIGHT = 1.70

NEAREST, LINEAR_MIPMAP_LINEAR = 9728, 9987


# ------------------------------------------------------------ GLB builder ---
class Builder:
    def __init__(self, j, bins):
        self.j = copy.deepcopy(j)
        self.blobs = [self._slice(j, bins, i) for i in range(len(j['bufferViews']))]
        self.meta = [{k: v for k, v in bv.items()
                      if k not in ('byteOffset', 'byteLength')}
                     for bv in j['bufferViews']]

    @staticmethod
    def _slice(j, bins, i):
        bv = j['bufferViews'][i]
        off = bv.get('byteOffset', 0)
        return bins[off:off + bv['byteLength']]

    def set_bv(self, i, data):
        self.blobs[i] = data

    def add_bv(self, data, meta=None):
        self.blobs.append(data)
        self.meta.append(meta or {})
        return len(self.blobs) - 1

    def add_accessor(self, acc):
        self.j['accessors'].append(acc)
        return len(self.j['accessors']) - 1

    def build(self, path):
        out = bytearray()
        views = []
        for blob, meta in zip(self.blobs, self.meta):
            out += b'\0' * ((4 - len(out) % 4) % 4)
            off = len(out)
            out += blob
            v = dict(meta)
            v['byteOffset'] = off
            v['byteLength'] = len(blob)
            views.append(v)
        self.j['bufferViews'] = views
        return save_glb(path, self.j, bytes(out))


def add_animation(builder, src_j, src_bins, name):
    """Copia una animacion completa (accessors + bufferViews) desde otro GLB."""
    anim = next(a for a in src_j['animations'] if a['name'] == name)
    by_name = {n.get('name'): i for i, n in enumerate(builder.j['nodes'])}
    node_map = {}
    for i, n in enumerate(src_j['nodes']):
        nm = n.get('name')
        node_map[i] = by_name.get(nm, i)

    cache, samplers = {}, []
    for s in anim['samplers']:
        ns = {}
        for key in ('input', 'output'):
            acc = copy.deepcopy(src_j['accessors'][s[key]])
            sbv = acc['bufferView']
            if sbv not in cache:
                v = src_j['bufferViews'][sbv]
                off = v.get('byteOffset', 0)
                data = src_bins[off:off + v['byteLength']]
                meta = {k: z for k, z in v.items()
                        if k not in ('byteOffset', 'byteLength')}
                cache[sbv] = builder.add_bv(data, meta)
            acc['bufferView'] = cache[sbv]
            ns[key] = builder.add_accessor(acc)
        ns['interpolation'] = s.get('interpolation', 'LINEAR')
        samplers.append(ns)

    channels = []
    for c in anim['channels']:
        c = copy.deepcopy(c)
        t = c['target']
        t['node'] = node_map.get(t['node'], t['node'])
        channels.append(c)
    builder.j['animations'].append({
        'name': name, 'samplers': samplers, 'channels': channels
    })


# --------------------------------------------------------------- texturas ---
def _png(im):
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def _fit(data, mode=None):
    im = Image.open(io.BytesIO(data))
    if mode:
        im = im.convert(mode)
    if im.width > TEX_SIZE or im.height > TEX_SIZE:
        im = im.resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
    return im


def textures_from_glb(j, bins):
    imgs = []
    for im in j['images']:
        bv = j['bufferViews'][im['bufferView']]
        off = bv.get('byteOffset', 0)
        imgs.append(bins[off:off + bv['byteLength']])
    return [_png(_fit(imgs[0])), _png(_fit(imgs[1])), _png(_fit(imgs[2]))]


def textures_from_fbx(path):
    f = FBX(path)
    d = {}
    for name, data in fbx_images(f):
        key = name.replace('texture_pbr_', '').replace('.png', '')
        d[key] = data
    base = next(v for k, v in d.items() if k.count('_') == 0)
    normal = d.get('normal') or next(v for k, v in d.items() if 'normal' in k)
    rough = d.get('roughness') or next(v for k, v in d.items() if 'roughness' in k)
    metal = d.get('metallic') or next(v for k, v in d.items() if 'metallic' in k)
    r = _fit(rough, 'L')
    m = _fit(metal, 'L')
    mr = Image.merge('RGB', (Image.new('L', r.size, 255), r, m))
    return [_png(_fit(normal)), _png(_fit(base)), _png(mr)]


# ------------------------------------------------------------------ malla ---
def build_mesh(fbx_path, donor):
    f = FBX(fbx_path)
    _, V, F, uv, corner_uv = fbx_meshes(f)[0]
    assert uv is not None and corner_uv is not None, 'Sin capa UV: ' + fbx_path

    s = TARGET_HEIGHT / (V[:, 1].max() - V[:, 1].min())
    Vs = V * s
    DP = donor['P']
    for ax in (0, 2):
        Vs[:, ax] -= ((Vs[:, ax].min() + Vs[:, ax].max()) / 2
                      - (DP[:, ax].min() + DP[:, ax].max()) / 2)
    Vs[:, 1] -= Vs[:, 1].min() - DP[:, 1].min()

    flat = F.reshape(-1)
    pos = Vs[flat].astype(np.float32)

    U, _ = uv
    uvs = U[corner_uv].astype(np.float32).copy()
    uvs[:, 1] = 1.0 - uvs[:, 1]  # FBX V-up -> glTF V-down

    tri = Vs[flat].reshape(-1, 3, 3)
    face_n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    vn = np.zeros_like(Vs)
    corners3 = flat.reshape(-1, 3)
    for k in range(3):
        np.add.at(vn, corners3[:, k], face_n)
    ln = np.linalg.norm(vn, axis=1)
    ln[ln == 0] = 1
    vn /= ln[:, None]
    normals = vn[flat].astype(np.float32)

    # Transferencia de pesos: media ponderada de los 4 vertices donantes mas
    # cercanos. Evita costuras duras en las uniones de las extremidades.
    dist, nn = donor['tree'].query(pos.astype(np.float64), k=4, workers=-1)
    kernel = 1.0 / (dist + 1e-3)
    kernel /= kernel.sum(axis=1, keepdims=True)
    acc = np.zeros((len(pos), 32), dtype=np.float32)
    rows = np.arange(len(pos))
    for k in range(4):
        for slot in range(4):
            ji = donor['J'][nn[:, k], slot].astype(np.int64)
            wv = donor['W'][nn[:, k], slot] * kernel[:, k]
            np.add.at(acc, (rows, ji), wv)
    top = np.argsort(acc, axis=1)[:, -4:]
    weights = np.take_along_axis(acc, top, axis=1)
    total = weights.sum(axis=1, keepdims=True)
    total[total == 0] = 1
    weights = (weights / total).astype(np.float32)
    joints = top.astype(np.uint8)

    return {
        'POSITION': pos, 'NORMAL': normals, 'TEXCOORD_0': uvs,
        'JOINTS_0': joints, 'WEIGHTS_0': weights,
        'indices': np.arange(len(pos), dtype=np.uint32).reshape(-1, 1),
    }


def replace_mesh(builder, mesh, prim):
    spec = {
        'POSITION':   (5126, 'VEC3', True),
        'NORMAL':     (5126, 'VEC3', False),
        'TEXCOORD_0': (5126, 'VEC2', False),
        'JOINTS_0':   (5121, 'VEC4', False),
        'WEIGHTS_0':  (5126, 'VEC4', False),
        'indices':    (5125, 'SCALAR', False),
    }
    for key, (ctype, typ, bounds) in spec.items():
        arr = mesh[key]
        ai = prim['attributes'][key] if key in prim['attributes'] else prim['indices']
        bvi = builder.j['accessors'][ai]['bufferView']
        builder.set_bv(bvi, arr.tobytes())
        acc = {k: v for k, v in builder.j['accessors'][ai].items()
               if k not in ('min', 'max', 'byteOffset')}
        acc.update(componentType=ctype, count=len(arr), type=typ,
                   bufferView=bvi)
        if bounds or key == 'indices':
            acc['min'] = arr.min(axis=0).tolist()
            acc['max'] = arr.max(axis=0).tolist()
        builder.j['accessors'][ai] = acc


# ------------------------------------------------------------------ motor ---
def main():
    os.makedirs(OUT, exist_ok=True)
    base_j, base_bins = load_glb(os.path.join(SRC, BASE))
    robot_j, robot_bins = load_glb(os.path.join(SRC, ROBOT))
    prim = base_j['meshes'][0]['primitives'][0]

    dp = accessor(base_j, base_bins, prim['attributes']['POSITION'])
    dj = accessor(base_j, base_bins, prim['attributes']['JOINTS_0'])
    dw = accessor(base_j, base_bins, prim['attributes']['WEIGHTS_0'])
    donor = {'P': dp.astype(np.float64), 'J': dj, 'W': dw,
             'tree': cKDTree(dp.astype(np.float64))}

    jobs = [
        ('arquero', None, None),
        ('barbaro', 'Barbaro modelo.fbx', 'Barbaro modelo.fbx'),
        ('bruja',   'Mago modelo.fbx',   'Mago modelo.fbx'),
        ('vampiro', 'Vampiro.fbx',       'Vampiro.fbx'),
    ]

    for name, mesh_fbx, tex_fbx in jobs:
        b = Builder(base_j, base_bins)
        j = b.j

        if mesh_fbx:
            mesh = build_mesh(os.path.join(SRC, mesh_fbx), donor)
            replace_mesh(b, mesh, prim)
            pngs = textures_from_fbx(os.path.join(SRC, tex_fbx))
        else:
            pngs = textures_from_glb(base_j, base_bins)

        for im, data in zip(j['images'], pngs):
            b.set_bv(im['bufferView'], data)

        # Filtro pixelart: texel nitido al ampliar, mipmaps suaves al alejar.
        for smp in j.get('samplers', []):
            smp['magFilter'] = NEAREST
            smp['minFilter'] = LINEAR_MIPMAP_LINEAR

        # El GLB original trae specularColorFactor=[2,2,2], fuera de rango.
        for mat in j['materials']:
            mat.pop('extensions', None)
            mat.setdefault('pbrMetallicRoughness', {})['metallicFactor'] = 1
            mat['pbrMetallicRoughness']['roughnessFactor'] = 1
        ext = j.get('extensionsUsed', [])
        j['extensionsUsed'] = [e for e in ext if e != 'KHR_materials_specular']
        if not j['extensionsUsed']:
            j.pop('extensionsUsed', None)

        add_animation(b, robot_j, robot_bins, 'Boxing_Practice')
        j['asset'] = dict(j.get('asset', {}))
        j['asset']['generator'] = 'Neon Revenant character rigger'

        path = os.path.join(OUT, name + '.glb')
        size = b.build(path)
        print('%-9s %6.1f MB  verts=%s  clips=%s' % (
            name, size / 1048576,
            len(mesh['POSITION']) if mesh_fbx else base_j['accessors'][0]['count'],
            [a['name'] for a in j['animations']]))


if __name__ == '__main__':
    main()
