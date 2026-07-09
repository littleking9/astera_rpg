/* Class selection, save/load, main animation loop, and boot sequence. Loads last. */
function startGame(cls){
  document.getElementById('classModal').classList.remove('show');
  buildAbilityBar(cls);
  level = buildHubLevel();
  depth = 0;
  player.x = level.spawnX; player.z = level.spawnZ;
  player.yaw = 0; player.pitch = 0;
  document.getElementById('depthText').textContent = 'Hearth';
}
const STARTER_WEAPON = {wizard:'staff', berserker:'axe', swordsman:'blade', ranger:'bow'};
function chooseClass(id){
  const cls = CLASSES[id];
  player.classId = id;
  player.maxHp = cls.hp; player.hp = cls.hp;
  player.speed = cls.speed; player.dmgMult = cls.dmgMult;
  player.equipment.weapon = makeStarterWeapon(STARTER_WEAPON[id]);
  startGame(cls);
  updateViewModel();
  log('You awaken in the Hearth as a '+cls.name+'. Walk into the violet ring to descend.', 'var(--muted)');
  canvas.requestPointerLock().catch(()=>{});
  saveGame();
}
function loadSavedGame(saved){
  const cls = CLASSES[saved.classId];
  player.classId = saved.classId;
  player.level = saved.level; player.xp = saved.xp; player.xpNext = saved.xpNext;
  player.gold = saved.gold; player.maxDepth = saved.maxDepth||0;
  player.equipment = saved.equipment || {weapon:null, armor:null, accessory:null};
  player.inventory = saved.inventory || [];
  itemUid = Math.max(itemUid, saved.itemUid||1);
  player.speed = cls.speed; player.dmgMult = cls.dmgMult;
  recomputeMaxHp();
  player.hp = player.maxHp;
  startGame(cls);
  updateViewModel();
  log('Welcome back, '+cls.name+'. Your gear and gold are as you left them.', 'var(--muted)');
}
function populateClassModal(){
  const grid = document.getElementById('classGrid');
  grid.innerHTML = '';
  Object.values(CLASSES).forEach(cls=>{
    const card = document.createElement('div');
    card.className = 'classCard';
    card.innerHTML = '<h3>'+cls.name+'</h3><p>'+cls.desc+'</p><span class="tag">'+cls.tag+'</span>';
    card.addEventListener('click', ()=>chooseClass(cls.id));
    grid.appendChild(card);
  });
}

function animate(now){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now-lastFrame)/1000);
  lastFrame = now;
  if (player.classId && level){
    if (!uiOpen){
      updatePlayerMovement(dt);
      updateMonsters(dt);
      updateProjectiles(dt);
      updatePickups(dt);
      updateHpBars();
      checkTriggers();
      checkInteractables();
    }
    camera.position.set(player.x, EYE_H, player.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    updateHud();
  }
  renderer.render(scene, camera);
}

document.getElementById('shopCloseBtn').addEventListener('click', closeAllModals);
document.getElementById('invCloseBtn').addEventListener('click', closeAllModals);
document.getElementById('shopTabBuy').addEventListener('click', ()=>setShopTab('buy'));
document.getElementById('shopTabSell').addEventListener('click', ()=>setShopTab('sell'));
document.getElementById('resetSaveBtn').addEventListener('click', ()=>{
  if (confirm('Reset your saved wanderer and start over?')){
    clearSave();
    location.reload();
  }
});

const savedGame = loadGame();
if (savedGame && CLASSES[savedGame.classId]) loadSavedGame(savedGame);
else populateClassModal();
requestAnimationFrame(animate);
