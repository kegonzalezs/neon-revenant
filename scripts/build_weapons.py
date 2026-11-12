"""Convierte los 5 FBX de armas de Meshy en GLB autonomos y normalizados.

Cada FBX trae una unica malla con UV y 4 texturas PBR embebidas a 4096 px.
Aqui se:

  * baja la resolucion de las texturas a 1024 (las armas ocupan poco en pantalla),
  * empaqueta roughness/metallic en una sola textura ORM glTF,
  * traslada el punto de empuñadura al origen del nodo,
  * endereza/alinea el modelo para que la punta util mire a -Z (salvo arco,
    hacha y baculo, que se sostienen en vertical),
  * escala a una longitud coherente con un heroe de 2.30 u.,
  * escribe un GLB con un unico mesh + material PBR sin dependencias externas.

Uso: python scripts/build_weapons.py
"""
import io
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbx_glb import FBX, fbx_meshes, fbx_images, save_glb

SRC = 'C:/Users/kjgs2/Desktop/Material Neon Revenant/Material armas'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'assets', 'weapons')
TEX_SIZE = 1024

# grip = punto de la empuñadura en coordenadas FBX; rot = enderezado previo;
# length = longitud final en unidades del rig logico; tip = punto util ya
# normalizado (lo consume src/weapons.js como ancla de proyectiles/VFX).
JOBS = [
    dict(key='arco',   file='Arco.fbx',   grip=(.025, .09, 0.),   rot=('x', -90.),
         length=1.30, tip=(0., .05, -.24)),
    dict(key='hacha',  file='Hacha.fbx',  grip=(-.11, .20, 0.),  rot=('y', 90.),
         length=1.28, tip=(0., .82, -.28)),
    dict(key='baculo', file='Baculo.fbx', grip=(0., 0., .502),    rot=('x', 48.6),
         length=1.55, tip=(0., 1.40, 0.)),
    dict(key='fusil',  file='Fusil.fbx',  grip=(0., .12, .02),    rot=None,
         length=1.22, tip=(0., .14, -.64)),
    dict(key='daga',   file='Daga.fbx',   grip=(0., .048, .35),   rot=None,
         length=.96,  tip=(0., 0., -.88)),
]


def rot_matrix(spec):
    if not spec:
        return np.eye(3)
    axis, deg = spec
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    if axis == 'x':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)
    if axis == 'y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)


def png(im):
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def fit(data, mode=None):
    im = Image.open(io.BytesIO(data))
    if mode:
        im = im.convert(mode)
    if im.width > TEX_SIZE or im.height > TEX_SIZE:
        im = im.resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
    return im


def weapon_textures(f):
    d = {}
    for name, data in fbx_images(f):
        key = name.replace('texture_pbr_', '').replace('.png', '')
        d[key] = data
    base = next(v for k, v in d.items() if k.count('_') == 0)
    normal = next(v for k, v in d.items() if 'normal' in k)
    rough = next(v for k, v in d.items() if 'roughness' in k)
    metal = next(v for k, v in d.items() if 'metallic' in k)
    r = fit(rough, 'L')
    m = fit(metal, 'L')
    orm = Image.merge('RGB', (Image.new('L', r.size, 255), r, m))
    return [png(fit(base, 'RGB')), png(fit(normal, 'RGB')), png(orm)]


def align4(b):
    return b + b'\0' * ((4 - len(b) % 4) % 4)


def build(job):
    f = FBX(os.path.join(SRC, job['file']))
    _, V, F, uv, corner_uv = fbx_meshes(f)[0]
    assert uv is not None and corner_uv is not None, 'sin UV: ' + job['file']

    R = rot_matrix(job['rot'])
    P = (V - np.asarray(job['grip'], dtype=np.float64)) @ R.T
    span = P.max(axis=0) - P.min(axis=0)
    scale = job['length'] / float(span.max())
    P *= scale

    flat = F.reshape(-1)
    pos = P[flat].astype(np.float32)
    U, _ = uv
    uvs = U[corner_uv].astype(np.float32).copy()
    uvs[:, 1] = 1.0 - uvs[:, 1]           # FBX V-up -> glTF V-down

    tri = P[flat].reshape(-1, 3, 3)
    face_n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    vn = np.zeros_like(P)
    corners3 = flat.reshape(-1, 3)
    for k in range(3):
        np.add.at(vn, corners3[:, k], face_n)
    ln = np.linalg.norm(vn, axis=1)
    ln[ln == 0] = 1
    vn /= ln[:, None]
    vn = vn @ R.T
    normals = vn[flat].astype(np.float32)

    idx = np.arange(len(pos), dtype=np.uint32)

    blobs, views, accessors = [], [], []

    def add_accessor(arr, ctype, typ, target=None, bounds=False):
        raw = arr.tobytes()
        blobs.append(raw)
        views.append(dict(buffer=0, byteOffset=0, byteLength=len(raw),
                          **({'target': target} if target else {})))
        a = dict(bufferView=len(views) - 1, componentType=ctype,
                 count=len(arr), type=typ)
        if bounds:
            mn = np.asarray(arr.min(axis=0)).reshape(-1)
            mx = np.asarray(arr.max(axis=0)).reshape(-1)
            a['min'] = mn.tolist()
            a['max'] = mx.tolist()
        accessors.append(a)
        return len(accessors) - 1

    a_pos = add_accessor(pos, 5126, 'VEC3', 34962, True)
    a_nrm = add_accessor(normals, 5126, 'VEC3', 34962)
    a_uv = add_accessor(uvs, 5126, 'VEC2', 34962)
    a_idx = add_accessor(idx, 5125, 'SCALAR', 34963, True)

    images = []
    for data in weapon_textures(f):
        blobs.append(data)
        views.append(dict(buffer=0, byteOffset=0, byteLength=len(data)))
        images.append(dict(bufferView=len(views) - 1, mimeType='image/png'))

    j = {
        'asset': {'version': '2.0', 'generator': 'Neon Revenant weapon converter'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'name': job['key'], 'mesh': 0}],
        'meshes': [{'name': job['key'], 'primitives': [{
            'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm, 'TEXCOORD_0': a_uv},
            'indices': a_idx, 'material': 0
        }]}],
        'materials': [{
            'name': job['key'],
            'pbrMetallicRoughness': {
                'baseColorTexture': {'index': 0},
                'metallicRoughnessTexture': {'index': 2},
                'metallicFactor': 1.0, 'roughnessFactor': 1.0
            },
            'normalTexture': {'index': 1, 'scale': 1.0},
            'emissiveFactor': [0.02, 0.02, 0.02],
            'doubleSided': False
        }],
        'textures': [{'sampler': 0, 'source': i} for i in range(3)],
        'samplers': [{'magFilter': 9728, 'minFilter': 9987,
                      'wrapS': 10497, 'wrapT': 10497}],
        'images': images,
        'accessors': accessors,
        'bufferViews': views
    }

    # Un unico buffer BIN0: cada vista empieza en un offset multiple de 4.
    off, written = 0, []
    for k, b in enumerate(blobs):
        pad = (4 - off % 4) % 4
        off += pad
        views[k]['byteOffset'] = off
        views[k]['byteLength'] = len(b)
        written.append(b'\0' * pad + b)
        off += len(b)
    bins = b''.join(written)

    path = os.path.join(OUT, job['key'] + '.glb')
    total = save_glb(path, j, bins)
    return {
        'key': job['key'], 'file': job['key'] + '.glb',
        'scale': round(scale, 4),
        'length': round(float(span.max() * scale), 3),
        'bbox': {
            'min': P.min(axis=0).round(3).tolist(),
            'max': P.max(axis=0).round(3).tolist()
        },
        'tip': job['tip'], 'tris': int(len(F)),
        'bytes': total
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {'generator': 'Neon Revenant weapon converter', 'weapons': {}}
    for job in JOBS:
        info = build(job)
        manifest['weapons'][info['key']] = info
        print('%-7s %5.2f MB  tris=%5d  scale=%.3f  len=%.2f  bbox=%s' % (
            info['key'], info['bytes'] / 1048576, info['tris'],
            info['scale'], info['length'], info['bbox']))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8') as fh:
        json.dump(manifest, fh, indent=2)
    print('manifest.json escrito')


if __name__ == '__main__':
    main()
