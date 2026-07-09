/* Combat resolution, equipment stats, loot pickups, class abilities, and monster AI. */

/* ---- Aim helpers ---- */
function getForward(){ return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }
function getRight(){ return new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)); }

/* ---- Equipment stats ---- */
function getEquipStat(stat){
  let total = 0;
  for (const slot of ['weapon','armor','accessory']){
    const it = player.equipment[slot];
    if (!it) continue;
    if (it.primaryStat===stat) total += it.primaryValue;
    for (const af of it.affixes) if (af.stat===stat) total += af.value;
  }
  return total;
}
function recomputeMaxHp(){
  const cls = CLASSES[player.classId];
  const newMax = cls.hp + getEquipStat('hp');
  const ratio = player.maxHp>0 ? player.hp/player.maxHp : 1;
  player.maxHp = newMax;
  player.hp = Math.min(newMax, Math.max(1, Math.round(newMax*ratio)));
}
function equipItem(item){
  const prev = player.equipment[item.slot];
  player.equipment[item.slot] = item;
  player.inventory = player.inventory.filter(i=>i.uid!==item.uid);
  if (prev) player.inventory.push(prev);
  recomputeMaxHp();
  updateViewModel();
  log('Equipped '+item.name+'.', rarityCss(item.rarity));
  saveGame();
}
function unequipItem(slot){
  const item = player.equipment[slot];
  if (!item) return;
  player.equipment[slot] = null;
  player.inventory.push(item);
  recomputeMaxHp();
  updateViewModel();
  log('Unequipped '+item.name+'.', 'var(--muted)');
  saveGame();
}

/* ---- Loot pickups ---- */
function spawnPickup(item, x, z){
  const color = RARITIES[item.rarity].color;
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28,0), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.6}));
  mesh.position.set(x, 0.6, z);
  scene.add(mesh);
  if (level && level.disposables) level.disposables.push(mesh);
  pickups.push({mesh, item, baseY:0.6, born:performance.now()});
}
function updatePickups(dt){
  if (pickups.length===0) return;
  const now = performance.now();
  pickups = pickups.filter(pk=>{
    pk.mesh.rotation.y += dt*2.2;
    pk.mesh.position.y = pk.baseY + Math.sin((now-pk.born)/300)*0.12;
    if (Math.hypot(pk.mesh.position.x-player.x, pk.mesh.position.z-player.z) < 1.0){
      player.inventory.push(pk.item);
      log('Picked up '+pk.item.name+' ('+RARITIES[pk.item.rarity].label+').', rarityCss(pk.item.rarity));
      scene.remove(pk.mesh);
      return false;
    }
    return true;
  });
}

/* ---- Damage resolution ---- */
function flashHit(m){
  const mesh = level.monsterMeshes && level.monsterMeshes.get(m.uid);
  if (!mesh || !mesh.userData.baseScale) return;
  const base = mesh.userData.baseScale;
  mesh.scale.set(base.x*1.25, base.y*1.25, 1);
  setTimeout(()=>{ mesh.scale.set(base.x, base.y, 1); }, 100);
}
function dealDamageToMonster(m, dmg){
  if (!m.alive) return;
  m.hp -= dmg;
  flashHit(m);
  const ls = getEquipStat('lifesteal');
  if (ls>0 && player.hp<player.maxHp) player.hp = Math.min(player.maxHp, player.hp + Math.max(1,Math.round(dmg*ls/100)));
  if (m.hp<=0) killMonster(m);
}
function killMonster(m){
  m.alive = false;
  const mesh = level.monsterMeshes.get(m.uid);
  if (mesh) scene.remove(mesh);
  const hb = hpBars.find(h=>h.monster===m);
  if (hb){ scene.remove(hb.bg); scene.remove(hb.fg); hpBars = hpBars.filter(h=>h!==hb); }
  player.xp += m.xp;
  const goldGain = Math.round(randInt(Math.random,2,6) * (m.isBoss?12:1) * (1+depth*0.3) * (1+getEquipStat('goldFind')/100));
  player.gold += goldGain;
  checkLevelUp();
  const rngKey = mulberry32((depth*7919 + m.uid*104729) >>> 0);
  const drop = rollDrop(rngKey, m.isBoss ? 'boss' : m.tier, depth);
  if (drop) spawnPickup(drop, m.x, m.z);
  log((m.isBoss?'The ':'')+m.name+' is slain. (+'+m.xp+' xp, +'+goldGain+'g)', 'var(--good)');
  saveGame();
}
function checkLevelUp(){
  while (player.xp >= player.xpNext){
    player.xp -= player.xpNext;
    player.level++;
    player.xpNext = Math.round(player.xpNext*1.35);
    player.maxHp += 8;
    player.hp = player.maxHp;
    log('Level up! Now level '+player.level+'.', 'var(--accent2)');
  }
}
function dealAoeDamage(cx, cz, radius, dmg){
  let hits = 0;
  for (const m of (level.monsters||[])){
    if (!m.alive) continue;
    if (Math.hypot(m.x-cx, m.z-cz) <= radius){ dealDamageToMonster(m, dmg); hits++; }
  }
  return hits;
}
function dealConeDamage(range, halfAngle, dmg){
  const fwd = getForward();
  let hits = 0;
  for (const m of (level.monsters||[])){
    if (!m.alive) continue;
    const dx=m.x-player.x, dz=m.z-player.z;
    const dist = Math.hypot(dx,dz);
    if (dist>range) continue;
    const toM = new THREE.Vector3(dx,0,dz).normalize();
    const ang = Math.acos(clamp(fwd.dot(toM),-1,1));
    if (ang <= halfAngle){ dealDamageToMonster(m, dmg); hits++; }
  }
  return hits;
}
function fireProjectile(dmg, color, speed, spreadRad){
  const fwd = getForward();
  if (spreadRad){
    const c=Math.cos(spreadRad), s=Math.sin(spreadRad);
    const nx = fwd.x*c - fwd.z*s, nz = fwd.x*s + fwd.z*c;
    fwd.x = nx; fwd.z = nz;
  }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8), new THREE.MeshBasicMaterial({color}));
  mesh.position.set(player.x+fwd.x*0.6, EYE_H*0.7, player.z+fwd.z*0.6);
  scene.add(mesh);
  projectiles.push({mesh, dir:fwd.clone(), speed:speed||16, dmg, born:performance.now()});
}
function updateProjectiles(dt){
  if (projectiles.length===0) return;
  const now = performance.now();
  projectiles = projectiles.filter(p=>{
    p.mesh.position.x += p.dir.x*p.speed*dt;
    p.mesh.position.z += p.dir.z*p.speed*dt;
    if (now-p.born>1800 || !isWalkable(level, p.mesh.position.x, p.mesh.position.z)){
      scene.remove(p.mesh); return false;
    }
    for (const m of (level.monsters||[])){
      if (!m.alive) continue;
      if (Math.hypot(m.x-p.mesh.position.x, m.z-p.mesh.position.z) < 0.55){
        dealDamageToMonster(m, p.dmg);
        scene.remove(p.mesh);
        return false;
      }
    }
    return true;
  });
}
function checkRiposte(m){
  if (player.riposteEnd && performance.now() < player.riposteEnd){
    player.riposteEnd = 0;
    const dmg = getScaledDmg(14,3);
    dealDamageToMonster(m, dmg);
    log('Riposte! You counter '+m.name+' for '+dmg+'.', 'var(--accent2)');
    return true;
  }
  return false;
}

/* ---- Class abilities ---- */
function getScaledDmg(base, perLevel){
  let dmg = (base + player.level*perLevel) * player.dmgMult + getEquipStat('dmg');
  const critChance = 5 + getEquipStat('crit');
  if (Math.random()*100 < critChance) dmg *= 1.6;
  return Math.max(1, Math.round(dmg));
}
const ABILITY_FN = {
  wizard: {
    F: ()=>{ fireProjectile(getScaledDmg(6,9), 0xc084fc, 17); log('You loose a bolt of ash.', 'var(--muted)'); },
    Q: ()=>{ const dmg=getScaledDmg(9,3); const hits=dealAoeDamage(player.x,player.z,3.2,dmg); log(hits?('Ashen Burst scorches '+hits+' foe(s).'):'Ashen Burst crackles through empty air.', 'var(--accent)'); },
    E: ()=>{ const fwd=getForward(); const nx=player.x+fwd.x*3.2, nz=player.z+fwd.z*3.2; if (canStandAt(level,nx,nz)){ player.x=nx; player.z=nz; log('You blink through the dark.', 'var(--accent2)'); } },
    R: ()=>{ const dmg=getScaledDmg(26,6); const hits=dealAoeDamage(player.x,player.z,4.5,dmg); log(hits?('Meteor obliterates '+hits+' foe(s)!'):'The meteor falls on empty stone.', 'var(--legendary)'); },
  },
  berserker: {
    F: ()=>{ const dmg=getScaledDmg(9,2); const hits=dealConeDamage(1.6, Math.PI/3.2, dmg); log(hits?'Cleave rends the nearest foe.':'Cleave hits empty air.', 'var(--muted)'); },
    Q: ()=>{ const dmg=getScaledDmg(7,2); const hits=dealAoeDamage(player.x,player.z,1.9,dmg); log(hits?('Whirlwind hits '+hits+' foe(s).'):'Whirlwind finds nothing.', 'var(--danger)'); },
    E: ()=>{ const fwd=getForward(); const nx=player.x+fwd.x*3.5, nz=player.z+fwd.z*3.5; const dmg=getScaledDmg(11,2); dealConeDamage(3.5, Math.PI/6, dmg); if (canStandAt(level,nx,nz)){ player.x=nx; player.z=nz; } log('You charge forward!', 'var(--danger)'); },
    R: ()=>{ player.rampageEnd = performance.now()+6000; log('Rampage! Your blows grow savage.', 'var(--danger)'); },
  },
  swordsman: {
    F: ()=>{ const dmg=getScaledDmg(7,2); const hits=dealConeDamage(1.9, Math.PI/4, dmg); log(hits?'Your thrust connects.':'Thrust hits empty air.', 'var(--muted)'); },
    Q: ()=>{ player.guardEnd = performance.now()+3000; log('You raise your guard.', 'var(--accent2)'); },
    E: ()=>{ player.riposteEnd = performance.now()+2500; log('You ready a riposte stance.', 'var(--accent2)'); },
    R: ()=>{ const heal=Math.round(player.maxHp*0.35); player.hp=Math.min(player.maxHp, player.hp+heal); log('Second Wind restores '+heal+' HP.', 'var(--good)'); },
  },
  ranger: {
    F: ()=>{ fireProjectile(getScaledDmg(5,2), 0x86efac, 22); },
    Q: ()=>{ for (let i=-1;i<=1;i++) fireProjectile(getScaledDmg(4,1), 0x86efac, 22, i*0.16); log('You loose a volley of arrows.', 'var(--good)'); },
    E: ()=>{ const fwd=getForward(); const nx=player.x+fwd.x*4.2, nz=player.z+fwd.z*4.2; player.invulnEnd=performance.now()+350; if (canStandAt(level,nx,nz)){ player.x=nx; player.z=nz; } log('You roll clear.', 'var(--accent2)'); },
    R: ()=>{ for (let i=0;i<6;i++) setTimeout(()=>{ const dmg=getScaledDmg(8,2); dealAoeDamage(player.x,player.z,4,dmg); }, i*140); log('You call down a barrage of arrows.', 'var(--good)'); },
  },
};
function useAbility(slot){
  if (!player.classId || !level) return;
  if (level.type!=='dungeon'){ log('Nothing to act on in the Hearth.', 'var(--muted)'); return; }
  const cls = CLASSES[player.classId];
  const now = performance.now();
  const endKey = slot==='F'?'fCdEnd':slot==='Q'?'qCdEnd':slot==='E'?'eCdEnd':'rCdEnd';
  if (now < player[endKey]) return;
  player[endKey] = now + cls.cd[slot];
  ABILITY_FN[cls.id][slot]();
}

/* ---- Monster AI ---- */
function updateMonsters(dt){
  if (!level || level.type!=='dungeon') return;
  const now = performance.now();
  for (const m of level.monsters){
    if (!m.alive) continue;
    const mesh = level.monsterMeshes.get(m.uid);
    const dx = player.x-m.x, dz = player.z-m.z;
    const dist = Math.hypot(dx,dz);
    if (dist < 9 && dist > 0.9){
      const nx = m.x + (dx/dist)*m.speed*dt;
      const nz = m.z + (dz/dist)*m.speed*dt;
      if (canStandAtMonster(nx, m.z)) m.x = nx;
      if (canStandAtMonster(m.x, nz)) m.z = nz;
    }
    if (dist <= 1.1 && now > m.atkCdEnd){
      m.atkCdEnd = now + 1000;
      if (performance.now() > player.invulnEnd && !checkRiposte(m)){
        let dmg = m.dmg;
        if (now < player.guardEnd) dmg = Math.round(dmg*0.4);
        dmg = Math.max(1, dmg - getEquipStat('armor'));
        player.hp -= dmg;
        log(m.name+' strikes you for '+dmg+'.', 'var(--danger)');
        if (player.hp<=0) playerDied();
      }
    }
    if (mesh) mesh.position.set(m.x, mesh.position.y, m.z);
  }
}
