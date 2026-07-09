/* Player movement, scene transitions (Hearth <-> dungeon), and input handling. */
function isPlayerMoving(){
  return !uiOpen && (keysDown.has('w')||keysDown.has('s')||keysDown.has('a')||keysDown.has('d')||
    keysDown.has('ArrowUp')||keysDown.has('ArrowDown')||keysDown.has('ArrowLeft')||keysDown.has('ArrowRight'));
}
function updatePlayerMovement(dt){
  let ix=0, iz=0;
  if (keysDown.has('w')||keysDown.has('ArrowUp')) iz -= 1;
  if (keysDown.has('s')||keysDown.has('ArrowDown')) iz += 1;
  if (keysDown.has('a')||keysDown.has('ArrowLeft')) ix -= 1;
  if (keysDown.has('d')||keysDown.has('ArrowRight')) ix += 1;
  if (ix===0 && iz===0) return;
  const len = Math.hypot(ix,iz)||1; ix/=len; iz/=len;
  const fwd = getForward(), right = getRight();
  let spd = player.speed + getEquipStat('speed')*0.15;
  if (performance.now() < player.rampageEnd) spd *= 1.1;
  const mx = (fwd.x*(-iz) + right.x*ix) * spd * dt;
  const mz = (fwd.z*(-iz) + right.z*ix) * spd * dt;
  const nx = player.x+mx, nz = player.z+mz;
  if (canStandAt(level, nx, player.z)) player.x = nx;
  if (canStandAt(level, player.x, nz)) player.z = nz;
}

/* ---- Transitions ---- */
function fadeAnd(cb){
  transitioning = true;
  const overlay = document.getElementById('fadeOverlay');
  overlay.style.opacity = 1;
  setTimeout(()=>{
    cb();
    transitioning = false;
    requestAnimationFrame(()=>{ overlay.style.opacity = 0; });
  }, 260);
}
function transitionTo(buildLevelFn, newDepth, msg, msgColor){
  if (transitioning) return;
  fadeAnd(()=>{
    disposeLevel(level);
    level = buildLevelFn();
    depth = newDepth;
    if (depth>0) player.maxDepth = Math.max(player.maxDepth, depth);
    player.x = level.spawnX; player.z = level.spawnZ;
    player.yaw = 0; player.pitch = 0;
    transitionLockUntil = performance.now()+900;
    document.getElementById('depthText').textContent = depth===0 ? 'Hearth' : 'Depth '+depth+' · '+level.biome.name;
    log(msg, msgColor);
    saveGame();
  });
}
function goToHub(){
  transitionTo(buildHubLevel, 0, 'You step back into the warm light of the Hearth.', 'var(--muted)');
}
function enterDungeon(){
  transitionTo(()=>buildDungeonLevel(generateDungeonData(seedBase, 1)), 1, 'You descend into the ruins.', 'var(--accent)');
}
function descend(){
  const nextDepth = depth+1;
  transitionTo(()=>buildDungeonLevel(generateDungeonData(seedBase, nextDepth)), nextDepth, 'The stairs plunge you deeper — depth '+nextDepth+'.', 'var(--accent)');
}
function playerDied(){
  const lost = Math.floor(player.gold*0.4);
  player.gold -= lost;
  player.hp = player.maxHp;
  log('You fall... and wake at the Hearth, '+lost+' gold lighter.', 'var(--danger)');
  goToHub();
}
function checkTriggers(){
  const now = performance.now();
  if (now < transitionLockUntil || transitioning) return;
  if (level.type==='hub'){
    const d = Math.hypot(player.x-level.portalX, player.z-level.portalZ);
    if (d < 1.6) enterDungeon();
  } else if (level.type==='dungeon'){
    const ds = Math.hypot(player.x-level.stairX, player.z-level.stairZ);
    if (ds < 1.4) descend();
    else {
      const dr = Math.hypot(player.x-level.retPortalX, player.z-level.retPortalZ);
      if (!level.retArmed && dr > 2.5) level.retArmed = true;
      if (level.retArmed && dr < 1.4) goToHub();
    }
  }
}

/* ---- Input ---- */
window.addEventListener('keydown', e=>{
  const k = e.key.length===1 ? e.key.toLowerCase() : e.key;
  keysDown.add(k);
  if (k==='Escape' && uiOpen){ closeAllModals(); return; }
  if (k==='i' && uiOpen && document.getElementById('inventoryModal').classList.contains('show')){ closeAllModals(); return; }
  if (uiOpen) return;
  if (!player.classId || !level) return;
  if (['f','q','e','r'].includes(k)) useAbility(k.toUpperCase());
  else if (k==='i') openInventory();
  else if (k==='g' && level.type==='hub' && Math.hypot(player.x-level.shopX, player.z-level.shopZ) < 3) openShop();
});
window.addEventListener('keyup', e=>{
  const k = e.key.length===1 ? e.key.toLowerCase() : e.key;
  keysDown.delete(k);
});
canvas.addEventListener('click', ()=>{
  if (player.classId && !uiOpen && document.pointerLockElement!==canvas) canvas.requestPointerLock().catch(()=>{});
});
document.addEventListener('pointerlockchange', ()=>{
  locked = document.pointerLockElement===canvas;
  document.getElementById('lockHint').style.display = locked ? 'none' : 'block';
});
document.addEventListener('mousemove', e=>{
  if (!locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = clamp(player.pitch, -1.3, 1.3);
});
canvas.addEventListener('mousedown', e=>{
  if (locked && !uiOpen && e.button===0 && player.classId) useAbility('F');
});
