#!/usr/bin/env python3
"""Importa los 7 paquetes oficiales de Kenney a assets/worlds/.

Uso:
    python scripts/prepare_worlds.py

Extrae cada ZIP en la raiz del proyecto (kenney_src/<kit>/), localiza la
carpeta de modelos GLB y copia los .glb a la estructura canonica:

    assets/worlds/world1_nature/    nature-kit
    assets/worlds/world2_snow/      platformer-kit (solo nieve/hielo + props)
    assets/worlds/world3_shop/      mini-shop
    assets/worlds/world4_suburban/  city-kit-suburban
    assets/worlds/world5_station/   space-station-kit
    assets/worlds/world6_space/     space-kit
    assets/worlds/world7_hexagon/   hexagon-kit

Los GLB de Kenney son autocontenidos (binarios + texturas embebidas), asi que
basta copiar el fichero .glb: no hay .bin ni texturas sueltas que resolver.
El script es idempotente y no toca nada fuera de assets/worlds/ y kenney_src/.
"""
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_ZIPS = Path(r"C:\Users\kjgs2\Desktop\Material Neon Revenant\Material mapas")
EXTRACT_ROOT = ROOT / "kenney_src"
WORLDS = ROOT / "assets" / "worlds"

# id del mundo -> (nombre del zip, carpeta de destino, filtro opcional)
PACKS = [
    ("world1_nature",   "kenney_nature-kit.zip",           None),
    ("world2_snow",     "kenney_platformer-kit.zip",       "snow"),
    ("world3_shop",     "kenney_mini-shop_2.1.zip",        None),
    ("world4_suburban", "kenney_city-kit-suburban_20.zip", None),
    ("world5_station",  "kenney_space-station-kit.zip",    None),
    ("world6_space",    "kenney_space-kit.zip",            None),
    ("world7_hexagon",  "kenney_hexagon-kit.zip",          None),
]

# Mundo 2: solo piezas de nieve/hielo y utileria invernal neutra.
# El Platformer Kit trae 153 GLB, la mitad son variantes de hierba que no
# corresponden a la tundra. Se conservan los bloques snow, las rampas, los
# puentes/escaleras y los props que aparecen en la referencia oficial.
SNOW_KEEP_EXACT = {
    "barrel.glb", "crate.glb", "crate-strong.glb", "crate-item.glb",
    "crate-item-strong.glb", "fence-straight.glb", "fence-corner.glb",
    "fence-low-straight.glb", "fence-low-corner.glb", "fence-rope.glb",
    "flag.glb", "sign.glb", "ladder.glb", "ladder-long.glb",
    "ladder-broken.glb", "platform.glb", "platform-ramp.glb",
    "platform-overhang.glb", "platform-fortified.glb", "poles.glb",
    "rocks.glb", "stones.glb", "tree-snow.glb", "tree-pine-snow.glb",
    "tree-pine-snow-small.glb", "tree-pine.glb", "tree-pine-small.glb",
    "coin-gold.glb", "coin-silver.glb", "coin-bronze.glb",
    "chest.glb", "spring.glb", "star.glb", "jewel.glb", "key.glb",
    "button-round.glb", "button-square.glb", "lever.glb",
    "block-moving.glb", "block-moving-blue.glb", "block-moving-large.glb",
}


def snow_filter(name: str) -> bool:
    n = name.lower()
    if n in SNOW_KEEP_EXACT:
        return True
    if n.startswith("block-snow"):
        return True
    if n.startswith("block-grass-large-slope") or n.startswith("block-grass-overhang-large-slope"):
        # rampas de hielo/macizo reutilizadas bajo la capa de nieve
        return True
    return False


def extract(zip_path: Path, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            target = dest / info.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with z.open(info) as f, open(target, "wb") as out:
                    shutil.copyfileobj(f, out)
    return dest


def find_glb_dir(root: Path) -> Path:
    candidates = []
    for p in root.rglob("*.glb"):
        parent = p.parent
        if "glb" in parent.name.lower() or "gltf" in parent.name.lower():
            candidates.append(parent)
    if not candidates:
        raise RuntimeError(f"sin carpeta de modelos GLB en {root}")
    # la que mas GLB contiene (algun kit tiene una carpeta de previews)
    return max(set(candidates), key=lambda d: len(list(d.glob("*.glb"))))


def main():
    WORLDS.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for world_id, zip_name, filter_name in PACKS:
        zip_path = SRC_ZIPS / zip_name
        if not zip_path.exists():
            raise SystemExit(f"Falta el ZIP: {zip_path}")

        kit = zip_name.replace("kenney_", "").replace(".zip", "")
        staging = extract(zip_path, EXTRACT_ROOT / kit)
        model_dir = find_glb_dir(staging)
        all_glb = sorted(model_dir.glob("*.glb"))
        keep = [p for p in all_glb if filter_name == "snow" and snow_filter(p.name)] \
            if filter_name == "snow" else all_glb

        out_dir = WORLDS / world_id
        out_dir.mkdir(parents=True, exist_ok=True)
        for p in keep:
            target = out_dir / p.name
            if not target.exists() or target.stat().st_size != p.stat().st_size:
                shutil.copy2(p, target)

        # Licencia y preview oficial, utiles como referencia de composicion.
        for extra in staging.rglob("License.txt"):
            shutil.copy2(extra, out_dir / "License.txt")
            break
        for extra in staging.glob("Preview*.png"):
            shutil.copy2(extra, out_dir / extra.name)
            break

        manifest[world_id] = {
            "kit": kit,
            "zip": zip_name,
            "sourceModels": len(all_glb),
            "imported": len(keep),
            "filter": filter_name,
            "path": f"assets/worlds/{world_id}/",
        }
        print(f"{world_id:18s} {len(keep):4d}/{len(all_glb):4d} GLB  <- {kit}")

    (WORLDS / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nTotal: {sum(m['imported'] for m in manifest.values())} GLB en {WORLDS}")
    print(f"Extraccion completa en: {EXTRACT_ROOT}")


if __name__ == "__main__":
    main()
