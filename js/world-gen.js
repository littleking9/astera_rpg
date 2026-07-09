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
    uid:itemUid++, typeId:type.id, name:type.name, color:type.color, spriteH:type.spriteH, tier:type.tier, barY:type.barY,
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

/* ---- Monster sprites: billboarded 2D icons, one canvas texture per type (cached) ---- */
const MONSTER_SPRITE_CACHE = {};
function shadeHex(color, amt){
  const r = clamp(((color>>16)&255) * (1+amt), 0, 255);
  const g = clamp(((color>>8)&255) * (1+amt), 0, 255);
  const b = clamp((color&255) * (1+amt), 0, 255);
  return 'rgb('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+')';
}
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function makeMonsterSpriteTexture(typeId, color){
  if (MONSTER_SPRITE_CACHE[typeId]) return MONSTER_SPRITE_CACHE[typeId];
  const W=64, H=80;
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const ctx = c.getContext('2d');
  const hex = '#'+color.toString(16).padStart(6,'0');
  const dark = shadeHex(color,-0.55);
  const cx = W/2;
  ctx.lineJoin = 'round';
  ctx.fillStyle = hex; ctx.strokeStyle = dark; ctx.lineWidth = 3;

  const blob = (x,y,rx,ry)=>{ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); };
  const tri = (x1,y1,x2,y2,x3,y3)=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  const rrect = (x,y,w,h,r)=>{ roundRectPath(ctx,x,y,w,h,r); ctx.fill(); ctx.stroke(); };

  switch(typeId){
    case 'rat':
      blob(cx-2, 58, 22, 13);
      blob(cx+18, 48, 10, 9);
      tri(cx+11,40, cx+16,27, cx+21,39);
      tri(cx+21,41, cx+28,31, cx+30,41);
      ctx.beginPath(); ctx.moveTo(cx-22,55); ctx.quadraticCurveTo(cx-38,60,cx-32,71); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx+21,47,1.8,0,Math.PI*2); ctx.fill();
      break;
    case 'goblin':
      ctx.fillStyle = hex;
      rrect(cx-11, 42, 22, 26, 4);
      blob(cx, 30, 13, 13);
      tri(cx-13,25, cx-22,14, cx-8,21);
      tri(cx+13,25, cx+22,14, cx+8,21);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx-5,29,1.7,0,Math.PI*2); ctx.arc(cx+5,29,1.7,0,Math.PI*2); ctx.fill();
      break;
    case 'skeleton':
      ctx.fillStyle = hex;
      rrect(cx-9, 40, 18, 24, 3);
      ctx.fillStyle = dark;
      for (let i=0;i<3;i++) ctx.fillRect(cx-9, 45+i*6, 18, 3);
      ctx.fillStyle = hex;
      blob(cx, 28, 11, 11);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx-4,27,1.6,0,Math.PI*2); ctx.arc(cx+4,27,1.6,0,Math.PI*2); ctx.fill();
      break;
    case 'orc':
      rrect(cx-17, 38, 34, 30, 5);
      blob(cx, 24, 15, 14);
      tri(cx-7,32, cx-10,41, cx-2,34);
      tri(cx+7,32, cx+10,41, cx+2,34);
      ctx.fillStyle = dark;
      rrect(cx-23,36,11,9,3); rrect(cx+12,36,11,9,3);
      break;
    case 'wraith':
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(cx, 18);
      ctx.quadraticCurveTo(cx+23,42, cx+17,72);
      ctx.lineTo(cx-17,72);
      ctx.quadraticCurveTo(cx-23,42, cx, 18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      blob(cx, 22, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx-4,22,1.8,0,Math.PI*2); ctx.arc(cx+4,22,1.8,0,Math.PI*2); ctx.fill();
      break;
    case 'warden':
      rrect(cx-20, 36, 40, 32, 6);
      blob(cx, 22, 15, 14);
      tri(cx-8,12, cx-12,2, cx-3,8);
      tri(cx+8,12, cx+12,2, cx+3,8);
      ctx.fillStyle = dark;
      rrect(cx-28,34,14,10,3); rrect(cx+14,34,14,10,3);
      break;
    default:
      rrect(cx-10, 40, 20, 24, 4);
      blob(cx, 30, 11, 11);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  MONSTER_SPRITE_CACHE[typeId] = tex;
  return tex;
}
function makeMonsterMesh(m){
  const tex = makeMonsterSpriteTexture(m.typeId, m.color);
  const mat = new THREE.SpriteMaterial({map:tex, transparent:true});
  const sprite = new THREE.Sprite(mat);
  const height = m.spriteH||1.5;
  const width = height * (64/80);
  sprite.scale.set(width, height, 1);
  sprite.position.set(m.x, height/2, m.z);
  sprite.userData.mat = mat;
  sprite.userData.baseScale = {x:width, y:height};
  sprite.userData.uid = m.uid;
  return sprite;
}
