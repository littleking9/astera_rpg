/* Procedural dungeon layout (BSP) + monster instance data + monster 3D models. */
function makeGrid(w,h,fill){ const g=[]; for(let y=0;y<h;y++) g.push(new Array(w).fill(fill)); return g; }
function carveRoomRect(grid,room){ for(let y=room.y;y<room.y+room.h;y++) for(let x=room.x;x<room.x+room.w;x++) grid[y][x]=1; }
function carveH(grid,x1,x2,y){ const a=Math.min(x1,x2), b=Math.max(x1,x2); for(let x=a;x<=b;x++) if(grid[y]) grid[y][x]=1; }
function carveV(grid,y1,y2,x){ const a=Math.min(y1,y2), b=Math.max(y1,y2); for(let y=a;y<=b;y++) if(grid[y]) grid[y][x]=1; }
function splitBSP(node,rng,minSize,depthLeft){
  if (depthLeft<=0) return;
  const canH = node.h >= minSize*2, canW = node.w >= minSize*2;
  if (!canH && !canW) return;
  const splitH = canH && canW ? rng()<0.5 : canH;
  if (splitH){
    const sy = randInt(rng, minSize, node.h-minSize);
    node.a = {x:node.x,y:node.y,w:node.w,h:sy};
    node.b = {x:node.x,y:node.y+sy,w:node.w,h:node.h-sy};
  } else {
    const sx = randInt(rng, minSize, node.w-minSize);
    node.a = {x:node.x,y:node.y,w:sx,h:node.h};
    node.b = {x:node.x+sx,y:node.y,w:node.w-sx,h:node.h};
  }
  splitBSP(node.a,rng,minSize,depthLeft-1);
  splitBSP(node.b,rng,minSize,depthLeft-1);
}
function anyRoom(node,rng){
  if (node.room) return node.room;
  if (!node.a && !node.b) return null;
  return rng()<0.5 ? (anyRoom(node.a,rng)||anyRoom(node.b,rng)) : (anyRoom(node.b,rng)||anyRoom(node.a,rng));
}
function buildRooms(node,rng,grid,roomsOut){
  if (node.a || node.b){
    if (node.a) buildRooms(node.a,rng,grid,roomsOut);
    if (node.b) buildRooms(node.b,rng,grid,roomsOut);
    const ra=anyRoom(node.a,rng), rb=anyRoom(node.b,rng);
    if (ra && rb){
      const cx1=Math.floor(ra.x+ra.w/2), cy1=Math.floor(ra.y+ra.h/2);
      const cx2=Math.floor(rb.x+rb.w/2), cy2=Math.floor(rb.y+rb.h/2);
      if (rng()<0.5){ carveH(grid,cx1,cx2,cy1); carveV(grid,cy1,cy2,cx2); }
      else { carveV(grid,cy1,cy2,cx1); carveH(grid,cx1,cx2,cy2); }
    }
  } else {
    const pad=1;
    const maxW=Math.max(3,node.w-2*pad), maxH=Math.max(3,node.h-2*pad);
    const rw=randInt(rng, Math.min(4,maxW), maxW), rh=randInt(rng, Math.min(4,maxH), maxH);
    const rx=node.x+pad+randInt(rng,0,Math.max(0,node.w-2*pad-rw));
    const ry=node.y+pad+randInt(rng,0,Math.max(0,node.h-2*pad-rh));
    node.room={x:rx,y:ry,w:rw,h:rh};
    carveRoomRect(grid,node.room);
    roomsOut.push(node.room);
  }
}
function roomDist(a,b){ const cx1=a.x+a.w/2,cy1=a.y+a.h/2,cx2=b.x+b.w/2,cy2=b.y+b.h/2; return Math.hypot(cx1-cx2,cy1-cy2); }

function makeMonsterData(type,gx,gz,depthN,isBoss){
  const scaleUp = 1+depthN*0.18;
  return {
    uid:itemUid++, typeId:type.id, name:type.name, color:type.color, scaleV:type.scale, tier:type.tier, barY:type.barY,
    x:(gx+0.5)*CELL, z:(gz+0.5)*CELL, speed:type.speed,
    hp:Math.round(type.hp*scaleUp), maxHp:Math.round(type.hp*scaleUp),
    dmg:Math.round(type.dmg*scaleUp), xp:Math.round(type.xp*(1+depthN*0.12)),
    alive:true, isBoss:!!isBoss, atkCdEnd:0,
  };
}
function generateDungeonData(seedStr, depthN){
  const rng = mulberry32(hashSeed(seedStr+':'+depthN));
  const W=26, H=26;
  const grid = makeGrid(W,H,0);
  const root = {x:1,y:1,w:W-2,h:H-2};
  splitBSP(root, rng, 5, 4);
  const rooms = [];
  buildRooms(root, rng, grid, rooms);
  const entrance = rooms[0];
  const bossCandidates = rooms.length>1 ? rooms.filter(r=>r!==entrance) : rooms;
  let boss = bossCandidates[0], bestDist=-1;
  for (const r of bossCandidates){ const d=roomDist(entrance,r); if (d>bestDist){ bestDist=d; boss=r; } }
  const normalRooms = rooms.filter(r=>r!==entrance && r!==boss);

  const monsters = [];
  const spawnX = Math.floor(entrance.x+entrance.w/2), spawnZ = Math.floor(entrance.y+entrance.h/2);
  for (const room of normalRooms){
    const count = randInt(rng,1,3);
    for (let i=0;i<count;i++){
      const mx = room.x + randInt(rng,0,room.w-1), mz = room.y + randInt(rng,0,room.h-1);
      if (mx===spawnX && mz===spawnZ) continue;
      const roll = rng();
      const type = roll<0.5?MONSTER_TYPES[0]:roll<0.75?MONSTER_TYPES[1]:roll<0.9?MONSTER_TYPES[2]:roll<0.97?MONSTER_TYPES[3]:MONSTER_TYPES[4];
      monsters.push(makeMonsterData(type, mx, mz, depthN, false));
    }
  }
  const bossX = Math.floor(boss.x+boss.w/2), bossZ = Math.floor(boss.y+boss.h/2);
  monsters.push(makeMonsterData(BOSS_TYPE, bossX, bossZ, depthN, true));
  const stairX = clamp(bossX+1, boss.x, boss.x+boss.w-1);
  const stairZ = clamp(bossZ+1, boss.y, boss.y+boss.h-1);

  return {
    type:'dungeon', grid, w:W, h:H, cell:CELL, rooms, depth:depthN, seedStr,
    monsters, spawnX:(spawnX+0.5)*CELL, spawnZ:(spawnZ+0.5)*CELL,
    stairX:(stairX+0.5)*CELL, stairZ:(stairZ+0.5)*CELL,
    biome: BIOMES[(depthN-1)%BIOMES.length],
  };
}

/* ---- Monster 3D models: one distinct procedural build per type ---- */
function makeMonsterMesh(m){
  const s = m.scaleV;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:m.color});
  const accent = new THREE.MeshStandardMaterial({color:0x1a0f2b});
  const parts = [];
  switch(m.typeId){
    case 'rat': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7*s,0.32*s,0.9*s), mat);
      body.position.y = 0.22*s;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2*s,8,8), mat);
      head.position.set(0,0.3*s,0.5*s);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025*s,0.06*s,0.55*s,6), mat);
      tail.rotation.x = Math.PI/2.3; tail.position.set(0,0.16*s,-0.55*s);
      const earGeo = new THREE.ConeGeometry(0.08*s,0.14*s,6);
      const earL = new THREE.Mesh(earGeo, mat); earL.position.set(-0.11*s,0.42*s,0.55*s);
      const earR = new THREE.Mesh(earGeo, mat); earR.position.set(0.11*s,0.42*s,0.55*s);
      parts.push(body,head,tail,earL,earR);
      break;
    }
    case 'goblin': {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5*s,0.55*s,0.35*s), mat);
      legs.position.y = 0.28*s;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55*s,0.6*s,0.35*s), mat);
      torso.position.y = 0.85*s;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24*s,8,8), mat);
      head.position.y = 1.28*s;
      const earGeo = new THREE.ConeGeometry(0.09*s,0.22*s,6);
      const earL = new THREE.Mesh(earGeo, mat); earL.rotation.z=0.5; earL.position.set(-0.24*s,1.34*s,0);
      const earR = new THREE.Mesh(earGeo, mat); earR.rotation.z=-0.5; earR.position.set(0.24*s,1.34*s,0);
      const armGeo = new THREE.BoxGeometry(0.15*s,0.5*s,0.15*s);
      const armL = new THREE.Mesh(armGeo, mat); armL.position.set(-0.35*s,0.85*s,0);
      const armR = new THREE.Mesh(armGeo, mat); armR.position.set(0.35*s,0.85*s,0);
      parts.push(legs,torso,head,earL,earR,armL,armR);
      break;
    }
    case 'skeleton': {
      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.4*s,0.18*s,0.22*s), mat);
      pelvis.position.y = 0.5*s;
      const legGeo = new THREE.CylinderGeometry(0.05*s,0.05*s,0.5*s,6);
      const legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.12*s,0.25*s,0);
      const legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.12*s,0.25*s,0);
      const ribGeo = new THREE.BoxGeometry(0.42*s,0.06*s,0.24*s);
      const rib1 = new THREE.Mesh(ribGeo, mat); rib1.position.y = 0.65*s;
      const rib2 = new THREE.Mesh(ribGeo, mat); rib2.position.y = 0.78*s;
      const rib3 = new THREE.Mesh(ribGeo, mat); rib3.position.y = 0.91*s;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.04*s,0.04*s,0.5*s,6), mat);
      spine.position.y = 0.75*s;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22*s,8,8), mat);
      head.position.y = 1.15*s;
      const armGeo = new THREE.CylinderGeometry(0.04*s,0.04*s,0.45*s,6);
      const armL = new THREE.Mesh(armGeo, mat); armL.position.set(-0.28*s,0.75*s,0);
      const armR = new THREE.Mesh(armGeo, mat); armR.position.set(0.28*s,0.75*s,0);
      parts.push(pelvis,legL,legR,rib1,rib2,rib3,spine,head,armL,armR);
      break;
    }
    case 'orc': {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6*s,0.5*s,0.45*s), mat);
      legs.position.y = 0.3*s;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78*s,0.75*s,0.45*s), mat);
      torso.position.y = 0.95*s;
      const shoulderGeo = new THREE.BoxGeometry(0.28*s,0.22*s,0.5*s);
      const shL = new THREE.Mesh(shoulderGeo, accent); shL.position.set(-0.48*s,1.28*s,0);
      const shR = new THREE.Mesh(shoulderGeo, accent); shR.position.set(0.48*s,1.28*s,0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3*s,10,10), mat);
      head.position.y = 1.55*s;
      const tuskGeo = new THREE.ConeGeometry(0.05*s,0.2*s,6);
      const tuskL = new THREE.Mesh(tuskGeo, accent); tuskL.rotation.x=Math.PI; tuskL.position.set(-0.1*s,1.42*s,0.28*s);
      const tuskR = new THREE.Mesh(tuskGeo, accent); tuskR.rotation.x=Math.PI; tuskR.position.set(0.1*s,1.42*s,0.28*s);
      parts.push(legs,torso,shL,shR,head,tuskL,tuskR);
      break;
    }
    case 'wraith': {
      const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.1*s,0.55*s,1.3*s,10,1,true), new THREE.MeshStandardMaterial({color:m.color, transparent:true, opacity:0.75, side:THREE.DoubleSide}));
      cloak.position.y = 0.75*s;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.28*s,10,10), mat);
      hood.position.y = 1.35*s;
      const eyeGeo = new THREE.SphereGeometry(0.04*s,6,6);
      const eyeMat = new THREE.MeshBasicMaterial({color:0xffffff});
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.09*s,1.36*s,0.22*s);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.09*s,1.36*s,0.22*s);
      parts.push(cloak,hood,eyeL,eyeR);
      break;
    }
    case 'warden': {
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8*s,0.6*s,0.6*s), mat);
      legs.position.y = 0.35*s;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0*s,1.0*s,0.6*s), mat);
      torso.position.y = 1.2*s;
      const shoulderGeo = new THREE.ConeGeometry(0.3*s,0.4*s,6);
      const shL = new THREE.Mesh(shoulderGeo, accent); shL.position.set(-0.62*s,1.75*s,0); shL.rotation.z = -0.3;
      const shR = new THREE.Mesh(shoulderGeo, accent); shR.position.set(0.62*s,1.75*s,0); shR.rotation.z = 0.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35*s,10,10), mat);
      head.position.y = 2.05*s;
      const hornGeo = new THREE.ConeGeometry(0.06*s,0.35*s,6);
      const hornL = new THREE.Mesh(hornGeo, accent); hornL.position.set(-0.15*s,2.35*s,0); hornL.rotation.z = -0.3;
      const hornR = new THREE.Mesh(hornGeo, accent); hornR.position.set(0.15*s,2.35*s,0); hornR.rotation.z = 0.3;
      parts.push(legs,torso,shL,shR,head,hornL,hornR);
      break;
    }
    default: {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8*s,1.2*s,0.5*s), mat);
      body.position.y = 0.6*s;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32*s,10,10), mat);
      head.position.y = 1.35*s;
      parts.push(body,head);
    }
  }
  parts.forEach(p=>group.add(p));
  group.position.set(m.x, 0, m.z);
  group.userData.mat = mat;
  group.userData.uid = m.uid;
  return group;
}
