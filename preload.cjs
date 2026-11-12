const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('app:quit'),
  fullscreen: () => ipcRenderer.send('app:fullscreen'),
  // Un binario por héroe: mesh + materiales + texturas + clips Mixamo.
  loadCharacterGLB: (asset) => ipcRenderer.invoke('nr:load-character-glb', asset),
  // Kenney Nature Kit: los GLB del escenario se leen en el proceso principal
  // porque el renderer aislado no puede hacer fetch() de ficheros file://.
  loadNatureGLBs: () => ipcRenderer.invoke('nr:load-nature-glbs'),
  // Arquitectura modular de 7 mundos Kenney: solo se piden los GLB que el
  // builder del mundo activo declara (67 en el Mundo 1, 50 en el Mundo 2),
  // no los 809 del proyecto. worldId y nombres se validan en el proceso
  // principal antes de tocar disco.
  loadWorldGLBs: (worldId, names) => ipcRenderer.invoke('nr:load-world-glbs', worldId, names),
  // Arsenal único: cinco GLB de armas, sprites Kenney y banco de SFX .ogg.
  // Todo se entrega como binario o data URL: cero peticiones de red.
  loadWeaponGLBs: () => ipcRenderer.invoke('nr:load-weapon-glbs'),
  loadVfxSprites: (names) => ipcRenderer.invoke('nr:load-vfx-sprites', names),
  loadSfxBank: () => ipcRenderer.invoke('nr:load-sfx-bank')
});
