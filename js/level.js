/* Level build/teardown: the Hearth hub and generated dungeons, plus walkability checks. */
function addObj(lvl, obj){ scene.add(obj); lvl.disposables.push(obj); return obj; }

function isWalkable(lvl, wx, wz){
  if (lvl.type==='hub') return Math.abs(wx-lvl.centerX) < lvl.size/2 && Math.abs(wz-lvl.centerZ) < lvl.size/2;
  const cx = Math.floor(wx/lvl.cell), cz = Math.floor(wz/lvl.cell);
  if (cz<0||cz>=lvl.h||cx<0||cx>=lvl.w) return false;
  return lvl.grid[cz][cx]===1;
}
function canStandAt(lvl, wx, wz){
  const r = PLAYER_R;
  return isWalkable(lvl,wx+r,wz+r) && isWalkable(lvl,wx-r,wz+r) && isWalkable(lvl,wx+r,wz-r) && isWalkable(lvl,wx-r,wz-r);
}
function canStandAtMonster(x,z){
  const r=0.4;
  return isWalkable(level,x+r,z) && isWalkable(level,x-r,z) && isWalkable(level,x,z+r) && isWalkable(level,x,z-r);
}
function disposeLevel(lvl){
  if (!lvl) return;
  for (const obj of lvl.disposables){
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material){ if (Array.isArray(obj.material)) obj.material.forEach(m=>m.dispose()); else obj.material.dispose(); }
  }
  for (const hb of hpBars){ scene.remove(hb.bg); scene.remove(hb.fg); }
  hpBars = [];
  for (const p of projectiles){ scene.remove(p.mesh); }
  projectiles = [];
  for (const pk of pickups){ scene.remove(pk.mesh); }
  pickups = [];
}

function buildHubLevel(){
  const lvl = {type:'hub', size:44, centerX:0, centerZ:0, disposables:[]};
  scene.background = new THREE.Color(0x6a4fc9);
  scene.fog = new THREE.Fog(0x6a4fc9, 20, 70);

  const groundMat = new THREE.MeshStandardMaterial({color:0x4ec96b, map:makeNoiseTexture(22,22)});
  const ground = addObj(lvl, new THREE.Mesh(new THREE.PlaneGeometry(lvl.size, lvl.size), groundMat));
  ground.rotation.x = -Math.PI/2;

  addObj(lvl, new THREE.HemisphereLight(0xfff2d9, 0x2a1a44, 1.0));
  const dirLight = addObj(lvl, new THREE.DirectionalLight(0xfff2d9, 0.6));
  dirLight.position.set(10,20,10);

  lvl.portalX = 0; lvl.portalZ = -14;
  const portal = addObj(lvl, new THREE.Mesh(new THREE.TorusGeometry(1.4,0.22,12,24), new THREE.MeshStandardMaterial({color:0x8b5cf6, emissive:0x8b5cf6, emissiveIntensity:0.7})));
  portal.position.set(lvl.portalX, 1.6, lvl.portalZ);
  const portalLight = addObj(lvl, new THREE.PointLight(0x8b5cf6, 1.2, 12));
  portalLight.position.set(lvl.portalX, 1.6, lvl.portalZ);

  lvl.shopX = -9; lvl.shopZ = -6;
  const stallBase = addObj(lvl, new THREE.Mesh(new THREE.BoxGeometry(2.6,1.3,1.8), new THREE.MeshStandardMaterial({color:0x6b4423})));
  stallBase.position.set(lvl.shopX, 0.65, lvl.shopZ);
  const counter = addObj(lvl, new THREE.Mesh(new THREE.BoxGeometry(2.8,0.15,0.5), new THREE.MeshStandardMaterial({color:0x4a2f1a})));
  counter.position.set(lvl.shopX, 1.35, lvl.shopZ+0.9);
  const roof = addObj(lvl, new THREE.Mesh(new THREE.ConeGeometry(2.3,1.3,4), new THREE.MeshStandardMaterial({color:0x4ade80})));
  roof.position.set(lvl.shopX, 2.15, lvl.shopZ);
  roof.rotation.y = Math.PI/4;
  const shopLight = addObj(lvl, new THREE.PointLight(0x4ade80, 1.2, 11));
  shopLight.position.set(lvl.shopX, 2.2, lvl.shopZ);

  shopStock = generateShopStock();
  lvl.spawnX = 0; lvl.spawnZ = 8;
  return lvl;
}
function generateShopStock(){
  const rng = mulberry32(hashSeed('shop-'+Math.random()+'-'+Date.now()));
  const stock = [];
  const slots = ['weapon','armor','accessory'];
  const refDepth = Math.max(1, player.maxDepth);
  for (let i=0;i<6;i++){
    const slot = slots[i%3];
    const rarityKey = weightedPick(rng, {common:25,uncommon:38,rare:26,epic:10,legendary:1});
    const item = generateItem(rng, slot, rarityKey, refDepth);
    item.price = Math.round(SHOP_PRICE_BASE[rarityKey]*(0.85+rng()*0.3));
    stock.push(item);
  }
  return stock;
}

function buildDungeonLevel(data){
  const lvl = data;
  lvl.disposables = [];
  const biome = lvl.biome;
  scene.background = new THREE.Color(biome.ceil);
  scene.fog = new THREE.Fog(biome.ceil, 6, 28);

  const floorMat = new THREE.MeshStandardMaterial({color:biome.floor, map:makeNoiseTexture(lvl.w,lvl.h)});
  const wallMat = new THREE.MeshStandardMaterial({color:biome.wall, map:makeNoiseTexture(2,2)});
  const ceilMat = new THREE.MeshStandardMaterial({color:biome.ceil});

  const floorCells = [], wallCells = [];
  for (let z=0; z<lvl.h; z++){
    for (let x=0; x<lvl.w; x++){
      if (lvl.grid[z][x]===1){
        floorCells.push([x,z]);
      } else {
        const n = (lvl.grid[z-1]&&lvl.grid[z-1][x]===1) || (lvl.grid[z+1]&&lvl.grid[z+1][x]===1) || (lvl.grid[z][x-1]===1) || (lvl.grid[z][x+1]===1);
        if (n) wallCells.push([x,z]);
      }
    }
  }
  const dummy = new THREE.Object3D();

  const floorGeo = new THREE.PlaneGeometry(lvl.cell, lvl.cell);
  const floorMesh = addObj(lvl, new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1,floorCells.length)));
  floorCells.forEach(([x,z],i)=>{
    dummy.position.set(x*lvl.cell+lvl.cell/2, 0, z*lvl.cell+lvl.cell/2);
    dummy.rotation.set(-Math.PI/2,0,0);
    dummy.updateMatrix();
    floorMesh.setMatrixAt(i, dummy.matrix);
  });

  const wallGeo = new THREE.BoxGeometry(lvl.cell, WALL_H, lvl.cell);
  const wallMesh = addObj(lvl, new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1,wallCells.length)));
  wallCells.forEach(([x,z],i)=>{
    dummy.position.set(x*lvl.cell+lvl.cell/2, WALL_H/2, z*lvl.cell+lvl.cell/2);
    dummy.rotation.set(0,0,0);
    dummy.updateMatrix();
    wallMesh.setMatrixAt(i, dummy.matrix);
  });
  if (wallCells.length===0) wallMesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0,0,0));

  const ceilMesh = addObj(lvl, new THREE.Mesh(new THREE.PlaneGeometry(lvl.w*lvl.cell, lvl.h*lvl.cell), ceilMat));
  ceilMesh.position.set(lvl.w*lvl.cell/2, WALL_H, lvl.h*lvl.cell/2);
  ceilMesh.rotation.x = Math.PI/2;

  addObj(lvl, new THREE.AmbientLight(0x554477, 0.55));
  for (const room of lvl.rooms){
    const torch = addObj(lvl, new THREE.PointLight(0xffb347, 0.9, 11));
    torch.position.set((room.x+room.w/2)*lvl.cell, 2.4, (room.y+room.h/2)*lvl.cell);
  }

  const stairs = addObj(lvl, new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.3,20), new THREE.MeshStandardMaterial({color:0x38bdf8, emissive:0x38bdf8, emissiveIntensity:0.6})));
  stairs.position.set(lvl.stairX, 0.15, lvl.stairZ);
  const stairsLight = addObj(lvl, new THREE.PointLight(0x38bdf8, 1.0, 9));
  stairsLight.position.set(lvl.stairX, 1.5, lvl.stairZ);

  const retPortal = addObj(lvl, new THREE.Mesh(new THREE.TorusGeometry(1.2,0.2,12,24), new THREE.MeshStandardMaterial({color:0x8b5cf6, emissive:0x8b5cf6, emissiveIntensity:0.6})));
  retPortal.position.set(lvl.spawnX, 1.4, lvl.spawnZ);
  lvl.retPortalX = lvl.spawnX; lvl.retPortalZ = lvl.spawnZ;
  lvl.retArmed = false;

  lvl.monsterMeshes = new Map();
  for (const m of lvl.monsters){
    const mesh = addObj(lvl, makeMonsterMesh(m));
    lvl.monsterMeshes.set(m.uid, mesh);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.13), new THREE.MeshBasicMaterial({color:0x1a0f2b, side:THREE.DoubleSide}));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.09), new THREE.MeshBasicMaterial({color:0x4fe1ad, side:THREE.DoubleSide}));
    scene.add(bg); scene.add(fg);
    hpBars.push({monster:m, bg, fg});
  }
  return lvl;
}
