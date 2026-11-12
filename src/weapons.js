// NEON//REVENANT — arsenal único de los cinco héroes.
//
// Cada personaje tiene UN arma fija, un modelo GLB propio (convertido desde los
// FBX de Meshy por scripts/build_weapons.py) y un ancla de disparo real. Ya no
// existe el arma por defecto compartida, ni el intercambio con F, ni las armas
// especiales de botín, ni el modelo cuerpo a cuerpo en la mano izquierda.
//
// El GLB llega por IPC (el renderer aislado no puede hacer fetch de file://) y
// se parsea con GLTFLoader.parseAsync(). Solo hay una instancia viva por arma:
// cambiar de héroe reparenta el grafo, no lo clona ni recarga texturas.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Los campos numéricos (damage/fireRate/ammo/pellets/spread/pierce/kick/color)
// mantienen el contrato del bucle de combate de game.js, pero ahora describen
// el arma única del héroe en vez de un arma intercambiable.
export const WEAPON_DEFS = {
  seraph: {
    id: 'arco', character: 'seraph', key: 'arco', glb: 'arco.glb',
    name: 'ARCO DORADO', sub: 'FLECHAS DE LUZ',
    damage: .64, fireRate: 1.8, ammo: 1.45, pellets: 3, spread: .045,
    pierce: 1, kick: .09, color: 0xffd45e, special: false,
    projectile: 'arrow', projectileSpeed: 92,
    mount: { pos: [-.04, .02, -.12], rot: [.10, .18, .08], scale: .88, tip: [0, .05, -.24] },
    // El oro de Meshy llegaba con baseColor y especular al límite: con las tres
    // luces que acompañan al héroe el arco saturaba a blanco. Se atenúa solo
    // este GLB, sin tocar las texturas ni la iluminación del resto del roster.
    material: { brightness: .58, emissive: .28, envMap: .5, metalness: .5, roughness: .7, specular: .2 },
    vfx: {
      flash: ['star_04.png', 'muzzle_01.png'], trail: ['trace_01.png'],
      impact: ['spark_02.png'], color: 0xffd45e, color2: 0xfff6d0,
      // Firma de impacto propia del héroe (se emite SOLO al acertar).
      hit: ['star_01.png', 'spark_03.png'],
      hitStyle: { count: 6, size: .5, life: .46, speed: 3.2, gravity: -1.6, spin: 2.4, color: 0xffe08a, color2: 0xfff8dc }
    },
    sfx: { shoot: ['rpg/cloth2.ogg', 'rpg/cloth1.ogg'], impact: ['rpg/metalClick.ogg'] },
    how: 'Arco de madera con detalles de oro. Dispara tres flechas luminosas por tiro.'
  },
  ronin: {
    id: 'hacha', character: 'ronin', key: 'hacha', glb: 'hacha.glb',
    name: 'HACHA RÚNICA', sub: 'GOLPE SALVAJE',
    damage: 1.65, fireRate: 1.85, ammo: .85, pellets: 1, spread: .055,
    pierce: 2, kick: .3, color: 0xff7a2f, special: false,
    projectile: null, projectileSpeed: 0, range: 4.2,
    mount: { pos: [-.02, -.06, -.04], rot: [.28, 0, -.14], scale: .88, tip: [0, .82, -.28] },
    vfx: {
      flash: ['slash_01.png', 'slash_02.png'], wave: ['circle_05.png'],
      // Ataque primario (clic): tajo ancho delante del héroe, no en la boca
      // del arma. Es la razón por la que antes apenas se veían partículas.
      melee: ['slash_01.png', 'slash_02.png', 'slash_04.png'],
      impact: ['spark_04.png'], color: 0xff6a20, color2: 0xffcf6a,
      hit: ['spark_04.png', 'circle_05.png'],
      hitStyle: { count: 8, size: .72, life: .5, speed: 4.4, gravity: -3.2, spin: 1.2, color: 0xff8a24, color2: 0xffd06a }
    },
    sfx: { shoot: ['rpg/chop.ogg'], impact: ['rpg/metalPot1.ogg'] },
    how: 'Hacha de guerra con runa roja. Cada tajo abre una onda de choque en abanico.'
  },
  glitch: {
    id: 'baculo', character: 'glitch', key: 'baculo', glb: 'baculo.glb',
    name: 'BÁCULO VIOLETA', sub: 'TORMENTA MÁGICA',
    damage: .92, fireRate: 1.75, ammo: 1.3, pellets: 2, spread: .075,
    pierce: 1, kick: .12, color: 0xb56bff, special: false,
    projectile: 'orb', projectileSpeed: 74,
    mount: { pos: [-.02, -.16, .02], rot: [.12, 0, -.08], scale: .82, tip: [0, 1.40, 0] },
    vfx: {
      flash: ['magic_03.png', 'spark_05.png'], trail: ['magic_03.png', 'spark_05.png'],
      impact: ['twirl_01.png', 'star_07.png'], color: 0xb56bff, color2: 0xff5ce6,
      hit: ['magic_01.png', 'star_07.png'],
      hitStyle: { count: 6, size: .62, life: .55, speed: 2.8, gravity: -.8, spin: 3.2, color: 0xc07bff, color2: 0xff7ce8 }
    },
    sfx: { shoot: ['scifi/forceField_002.ogg', 'scifi/forceField_000.ogg'], impact: ['scifi/explosionCrunch_002.ogg'] },
    how: 'Báculo con cristal púrpura. Lanza orbes arcanos que estallan en magenta.'
  },
  vanta: {
    id: 'fusil', character: 'vanta', key: 'fusil', glb: 'fusil.glb',
    name: 'FUSIL DE NÚCLEO', sub: 'RAYO LÁSER',
    damage: .82, fireRate: .78, ammo: 1.6, pellets: 1, spread: .006,
    pierce: 2, kick: .06, color: 0x49e6ff, special: false,
    projectile: 'laser', projectileSpeed: 210,
    mount: { pos: [0, -.04, .04], rot: [0, 0, 0], scale: 1.26, tip: [0, .14, -.64] },
    vfx: {
      flash: ['muzzle_04.png'], trail: ['trace_05.png'],
      impact: ['spark_06.png', 'light_01.png'], color: 0x49e6ff, color2: 0xd8ffff,
      hit: ['spark_06.png', 'muzzle_05.png'],
      hitStyle: { count: 7, size: .48, life: .38, speed: 5.2, gravity: -2.4, spin: 1.4, color: 0x67efff, color2: 0xe6ffff }
    },
    sfx: { shoot: ['scifi/laserSmall_000.ogg', 'scifi/laserSmall_003.ogg'], impact: ['scifi/impactMetal_001.ogg'] },
    how: 'Rifle futurista con núcleo azul. Dispara un haz de neón que perfora la fila.'
  },
  kira: {
    id: 'daga', character: 'kira', key: 'daga', glb: 'daga.glb',
    name: 'ESPADA CARMESÍ', sub: 'ROBO DE VIDA',
    damage: 1.15, fireRate: .8, ammo: 1.25, pellets: 1, spread: .03,
    pierce: 1, kick: .14, color: 0xe8434f, special: false,
    projectile: null, projectileSpeed: 0, range: 3.4,
    // Escala NO uniforme: el GLB original es una daga de .96 u. en -Z.
    // Estirar el eje de la hoja (y algo el ancho) la convierte en un filo
    // largo de ~1.8 u., con la empuñadura intacta. La ligera inclinación
    // en X la saca de la postura horizontal de puñal.
    mount: { pos: [0, -.02, .06], rot: [-.16, 0, .22], scale: [1.12, 1.28, 1.9], tip: [0, 0, -.88] },
    vfx: {
      flash: ['slash_03.png'], smoke: ['smoke_07.png'],
      // Tres tajos + onda circular: con el color2 antiguo (0x7a0b18, rojo
      // casi negro) las partículas aditivas desaparecían sobre el cielo.
      melee: ['slash_03.png', 'slash_04.png', 'slash_01.png'],
      wave: ['circle_03.png'], meleeBoost: 1.4,
      impact: ['circle_01.png'], color: 0xe8434f, color2: 0xff9aa5,
      hit: ['circle_02.png', 'star_09.png'],
      hitStyle: { count: 6, size: .58, life: .6, speed: 2.4, gravity: -1.2, spin: -2.2, color: 0xff2f45, color2: 0x8d0d1e }
    },
    sfx: { shoot: ['rpg/knifeSlice2.ogg', 'rpg/knifeSlice.ogg'], impact: ['rpg/drawKnife1.ogg'], lifesteal: ['rpg/handleCoins2.ogg'] },
    how: 'Filo carmesí alargado como una espada. Sus tajos arrancan vida de los enemigos derrotados.'
  }
};

export const UNIQUE_WEAPONS = Object.values(WEAPON_DEFS);
export const weaponFor = id => WEAPON_DEFS[id] || WEAPON_DEFS.vanta;

const templates = Object.create(null);   // key -> THREE.Group (gltf.scene)
const diag = { ok: false, loaded: [], active: null, error: null };
let loadPromise = null;
let attached = null;

function cleanMaterials(scene, tune) {
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || !m.isMeshStandardMaterial) continue;
      // Los PBR de Meshy vienen con un especular fuera de rango: se contiene
      // para que el oro y el cristal no saturen a blanco con la luz del héroe.
      // Valores por defecto mate (coherentes con WorldManager): antes
      // envMap .85 / metalness .85 / specular .55 deslumbraban con ACES.
      m.envMapIntensity = tune?.envMap ?? .42;
      m.metalness = Math.min(tune?.metalness ?? .45, m.metalness ?? .8);
      m.roughness = Math.max(tune?.roughness ?? .55, Math.min(.92, m.roughness ?? .8));
      if (m.specularIntensity != null) m.specularIntensity = Math.min(tune?.specular ?? .30, m.specularIntensity);
      if (m.specularColor) m.specularColor.setRGB(.35, .35, .35);
      // Etalonaje por arma (por ahora solo el arco): oscurece baseColor y
      // emisivo SIN regenerar el GLB ni compartir el ajuste con los demás.
      if (tune?.brightness != null) {
        m.color.multiplyScalar(tune.brightness);
        if (m.emissive) m.emissive.multiplyScalar(tune.brightness);
        m.emissiveIntensity = Math.min(m.emissiveIntensity ?? 1, tune.emissive ?? .3);
      }
      m.needsUpdate = true;
    }
  });
}

/** Carga y parsea los cinco GLB en paralelo al arranque de la app. */
export function initWeapons() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (!window.desktop?.loadWeaponGLBs) throw new Error('puente IPC de armas no disponible');
      const bank = await window.desktop.loadWeaponGLBs();
      const loader = new GLTFLoader();
      for (const [file, bytes] of Object.entries(bank || {})) {
        const key = file.replace(/\.glb$/i, '');
        const def = UNIQUE_WEAPONS.find(d => d.key === key);
        if (!def) continue;
        const ab = new Uint8Array(bytes).buffer;
        const gltf = await loader.parseAsync(ab, '');
        cleanMaterials(gltf.scene, def.material);
        gltf.scene.userData.weaponKey = key;
        templates[key] = gltf.scene;
        diag.loaded.push(key);
      }
      diag.ok = diag.loaded.length === 5;
      if (!diag.ok) diag.error = 'solo ' + diag.loaded.length + '/5 GLB de arma';
    } catch (err) {
      diag.error = String(err && err.message || err);
      console.log('WEAPON_LOAD_ERROR: ' + diag.error);
    }
    window.__NR_WEAPONS = diag;
    return diag;
  })();
  return loadPromise;
}

/**
 * Cuelga el arma única en la mano derecha del héroe.
 * `weaponCarrier` lo mueve cada frame hasta el hueso mixamorigRightHand;
 * el `mount` conserva la posición lógica (.34, 1.5, -.48) que usa updatePlayer
 * para el retroceso y la inclinación de recarga.
 */
export function attachWeapon(root, characterId) {
  if (!root) return null;
  detachWeapon();
  const def = weaponFor(characterId);
  const carrier = root.userData.weaponCarrier;
  if (!carrier) return def;

  // buildPlayerRig() ya creó el soporte lógico (posición de retroceso + ancla
  // de boca de fuego de reserva). Se reutiliza: así updatePlayer() nunca ve
  // un `gun` nulo y las armas no dejan grupos huérfanos al cambiar de héroe.
  let mount = root.userData.weaponMount;
  if (!mount) {
    mount = new THREE.Group();
    mount.name = 'UniqueWeaponMount';
    mount.position.copy(root.userData.gunBase || new THREE.Vector3(.34, 1.5, -.48));
    root.userData.weaponMount = mount;
    root.userData.fallbackGun = mount;
  }
  // El soporte lógico es persistente: si un dispose anterior lo separó del
  // portador, se vuelve a colgar en vez de crear un segundo grupo huérfano.
  if (mount.parent !== carrier) carrier.add(mount);

  const holder = new THREE.Group();
  holder.name = 'UniqueWeaponVisual';
  holder.position.fromArray(def.mount.pos);
  holder.rotation.fromArray(def.mount.rot);
  // `scale` admite un escalar (proporción original) o un vector [x,y,z] para
  // estirar una hoja sin deformar la empuñadura del mismo modo (vampiro).
  const s = def.mount.scale;
  if (Array.isArray(s)) holder.scale.set(s[0], s[1], s[2]);
  else holder.scale.setScalar(s);
  mount.add(holder);

  const tip = new THREE.Object3D();
  tip.name = 'WeaponTip';
  tip.position.fromArray(def.mount.tip);
  holder.add(tip);

  const scene = templates[def.key];
  if (scene) holder.add(scene);

  root.userData.gun = mount;
  root.userData.muzzle = tip;
  root.userData.bolt = null;
  root.userData.barrels = null;
  root.userData.weaponDef = def;
  attached = { root, mount, holder, scene };
  diag.active = def.key;
  return def;
}

/** Separa el grafo del arma ANTES de disposePlayerRig(): si quedara colgado,
 *  disposeSubtree() liberaría las texturas compartidas de la plantilla. */
export function detachWeapon() {
  if (!attached) return;
  const { root, holder, scene } = attached;
  // Solo se separa el VISUAL (plantilla GLB compartida) y su contenedor.
  // El soporte lógico `mount` sigue vivo: updatePlayer() escribe en él el
  // retroceso y la recarga, y disposing el rig no debe liberar las texturas
  // de la plantilla compartida por los cinco héroes.
  if (scene && scene.parent) scene.parent.remove(scene);
  if (holder && holder.parent) holder.parent.remove(holder);
  if (root && root.userData) {
    root.userData.gun = root.userData.fallbackGun || root.userData.weaponMount || null;
    root.userData.muzzle = root.userData.fallbackMuzzle || null;
    root.userData.weaponDef = null;
  }
  attached = null;
  diag.active = null;
}

export function activeWeapon() {
  return attached ? attached.root.userData.weaponDef : null;
}

export function weaponDiagnostics() {
  return { ...diag, attached: !!attached, keys: Object.keys(templates) };
}

export function disposeWeapons() {
  detachWeapon();
  for (const key of Object.keys(templates)) {
    const scene = templates[key];
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (!m) continue;
        for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
          if (m[slot]) m[slot].dispose();
        }
        m.dispose();
      }
    });
    delete templates[key];
  }
  diag.ok = false; diag.loaded = []; diag.active = null;
  loadPromise = null;
}
