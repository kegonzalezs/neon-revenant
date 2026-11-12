"""Herramientas de lectura/escritura para el pipeline de personajes.

Lee FBX binario 7400 (geometria, UV, texturas embebidas) y GLB/glTF 2.0
(accessors, skins, animaciones) sin dependencias nativas. Se usa para
transferir el esqueleto Mixamo del arquero animado a los modelos estaticos.
"""
import json
import struct
import zlib
import numpy as np

# ------------------------------------------------------------------ FBX ----

def _array_values(buf, p, t):
    count, enc, clen = struct.unpack_from('<III', buf, p)
    p += 12
    raw = buf[p:p + clen]
    p += clen
    if enc == 1:
        raw = zlib.decompress(raw)
    fmt = {'f': 'f', 'd': 'd', 'i': 'i', 'l': 'q', 'b': 'b'}[t]
    return np.frombuffer(raw, dtype='<' + fmt, count=count), p


def _props(buf, n):
    out, p = [], 0
    for _ in range(n):
        t = chr(buf[p]); p += 1
        if t == 'Y':
            out.append(struct.unpack_from('<h', buf, p)[0]); p += 2
        elif t == 'C':
            out.append(buf[p] != 0); p += 1
        elif t == 'I':
            out.append(struct.unpack_from('<i', buf, p)[0]); p += 4
        elif t == 'F':
            out.append(struct.unpack_from('<f', buf, p)[0]); p += 4
        elif t == 'D':
            out.append(struct.unpack_from('<d', buf, p)[0]); p += 8
        elif t == 'L':
            out.append(struct.unpack_from('<q', buf, p)[0]); p += 8
        elif t in 'SR':
            ln = struct.unpack_from('<I', buf, p)[0]; p += 4
            val = buf[p:p + ln]; p += ln
            out.append(val.decode('utf8', 'replace') if t == 'S' else val)
        elif t in 'bifdl':
            val, p = _array_values(buf, p, t)
            out.append(val)
        else:
            raise ValueError('tipo de propiedad FBX desconocido %r en %d' % (t, p))
    return out


class FBX:
    def __init__(self, path):
        self.data = open(path, 'rb').read()
        if not self.data.startswith(b'Kaydara FBX Binary'):
            raise ValueError('No es FBX binario: ' + path)
        self.version = struct.unpack_from('<I', self.data, 23)[0]
        self.wide = self.version >= 7500
        self.hdr = 25 if self.wide else 13
        self.nodes = []
        p = 27
        while p + self.hdr <= len(self.data):
            if all(b == 0 for b in self.data[p:p + self.hdr]):
                break
            node, end = self._node(p)
            if end <= p:
                raise ValueError('Registro FBX invalido en %d (end=%d)' % (p, end))
            self.nodes.append(node)
            p = end

    def _node(self, pos):
        if self.wide:
            end, nprop, plen = struct.unpack_from('<QQQ', self.data, pos)
            nl = self.data[pos + 24]
            p = pos + 25
        else:
            end, nprop, plen = struct.unpack_from('<III', self.data, pos)
            nl = self.data[pos + 12]
            p = pos + 13
        name = self.data[p:p + nl].decode('utf8', 'replace')
        p += nl
        pend = p + plen
        props = _props(self.data[p:pend], nprop)
        children = []
        q = pend
        limit = end - self.hdr
        while q <= limit:
            if all(b == 0 for b in self.data[q:q + self.hdr]):
                break
            child, nxt = self._node(q)
            children.append(child)
            q = nxt
            if q >= end:
                break
        return {'name': name, 'props': props, 'children': children}, end

    def top(self, name):
        for n in self.nodes:
            if n['name'] == name:
                return n
        return None

    def objects(self):
        t = self.top('Objects')
        out = {}
        for c in (t['children'] if t else []):
            out.setdefault(c['name'], []).append(c)
        return out


def _prop(node, key):
    for c in node['children']:
        if c['name'] == key:
            return c['props'][0] if c['props'] else None
    return None


def fbx_meshes(f):
    """Devuelve [(nombre, V Nx3, F Mx3, (UV, UVIndex), corner_uv_idx)].

    corner_uv_idx esta alineado con F.reshape(-1) y referencia el array UV;
    permite reconstruir las UV despues de triangular quads.
    """
    out = []
    for g in f.objects().get('Geometry', []):
        if not g['props'] or not g['children']:
            continue
        verts = _prop(g, 'Vertices')
        poly = _prop(g, 'PolygonVertexIndex')
        if verts is None or poly is None:
            continue
        V = np.asarray(verts, dtype=np.float64).reshape(-1, 3)
        P = np.asarray(poly, dtype=np.int64)
        # FBX indexa con complemento (~i) en el ultimo vertice de cada cara.
        faces, corner_pos, cur, cpos = [], [], [], []
        for pos, i in enumerate(P):
            if i < 0:
                cur.append(~i); cpos.append(pos)
                if len(cur) == 3:
                    faces.append(cur); corner_pos.append(cpos)
                elif len(cur) > 3:  # triangulacion en abanico
                    for k in range(1, len(cur) - 1):
                        faces.append([cur[0], cur[k], cur[k + 1]])
                        corner_pos.append([cpos[0], cpos[k], cpos[k + 1]])
                cur, cpos = [], []
            else:
                cur.append(i); cpos.append(pos)
        F = np.asarray(faces, dtype=np.int64).reshape(-1, 3)
        corners = np.asarray([c for row in corner_pos for c in row], dtype=np.int64)
        uv = None
        corner_uv = None
        for layer in g['children']:
            if layer['name'] == 'LayerElementUV':
                arr = _prop(layer, 'UV')
                idx = _prop(layer, 'UVIndex')
                if arr is not None:
                    U = np.asarray(arr, dtype=np.float64).reshape(-1, 2)
                    if idx is not None:
                        I = np.asarray(idx, dtype=np.int64)
                        uv = (U, I)
                        corner_uv = I[corners] if len(I) > corners.max() else corners
                    else:
                        uv = (U, None)
                        corner_uv = F.reshape(-1)
                break
        out.append((str(g['props'][0]).split('\x00')[0], V, F, uv, corner_uv))
    return out


def fbx_images(f):
    """Texturas embebidas: [(nombre_archivo, bytes)]."""
    out = []
    for v in f.objects().get('Video', []):
        content = _prop(v, 'Content')
        if content is None:
            continue
        name = str(_prop(v, 'RelativeFilename') or _prop(v, 'Filename') or 'texture.png')
        if isinstance(content, str):
            import base64
            content = base64.b64decode(content)
        out.append((name.split('\\')[-1].split('/')[-1], bytes(content)))
    return out


# ------------------------------------------------------------------ GLB ----

COMP = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    data = open(path, 'rb').read()
    magic, ver, total = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and ver == 2
    p, js, bins = 12, None, b''
    while p < total:
        clen, ctype = struct.unpack_from('<I4s', data, p)
        chunk = data[p + 8:p + 8 + clen]
        if ctype == b'JSON':
            js = json.loads(chunk.decode('utf8').rstrip(' \t\r\n\0'))
        elif ctype.startswith(b'BIN'):
            bins = chunk
        p += 8 + clen
    return js, bins


def accessor(j, bins, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    dtype = np.dtype('<' + COMP[a['componentType']])
    n = NCOMP[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or dtype.itemsize * n
    count = a['count']
    out = np.empty((count, n), dtype=dtype)
    if stride == dtype.itemsize * n:
        out[:] = np.frombuffer(bins, dtype=dtype, count=count * n,
                               offset=off).reshape(count, n)
    else:
        for i in range(count):
            out[i] = np.frombuffer(bins, dtype=dtype, count=n,
                                   offset=off + i * stride)
    return out


def _align4(b):
    return b + b'\0' * ((4 - len(b) % 4) % 4)


def save_glb(path, j, bins):
    """Escribe un GLB con un unico buffer BIN0."""
    j = dict(j)
    j['buffers'] = [{'byteLength': len(_align4(bins))}]
    jb = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode('utf8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bb = _align4(bins)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(jb), b'JSON')); f.write(jb)
        f.write(struct.pack('<I4s', len(bb), b'BIN\0')); f.write(bb)
    return total
