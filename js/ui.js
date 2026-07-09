/* HUD, log, and the shop/inventory modal UIs. */
function updateHpBars(){
  for (const hb of hpBars){
    const m = hb.monster;
    if (!m.alive) continue;
    const yOff = (m.barY||1.9)*m.scaleV;
    hb.bg.position.set(m.x, yOff, m.z);
    hb.fg.position.set(m.x, yOff, m.z);
    hb.bg.quaternion.copy(camera.quaternion);
    hb.fg.quaternion.copy(camera.quaternion);
    hb.fg.scale.x = clamp(m.hp/m.maxHp,0,1);
  }
}
function log(msg, color){
  const panel = document.getElementById('logPanel');
  const div = document.createElement('div');
  div.className = 'logEntry';
  div.style.color = color || 'var(--muted)';
  div.textContent = msg;
  panel.appendChild(div);
  while (panel.children.length > 6) panel.removeChild(panel.firstChild);
}
function updateHud(){
  document.getElementById('hpText').textContent = Math.max(0,Math.round(player.hp))+' / '+player.maxHp;
  document.getElementById('hpBar').style.width = (clamp(player.hp/player.maxHp,0,1)*100)+'%';
  document.getElementById('xpText').textContent = player.xp+' / '+player.xpNext;
  document.getElementById('xpBar').style.width = (clamp(player.xp/player.xpNext,0,1)*100)+'%';
  document.getElementById('lvlText').textContent = player.level;
  document.getElementById('goldText').textContent = player.gold;
  const cls = CLASSES[player.classId];
  const now = performance.now();
  ['F','Q','E','R'].forEach(slot=>{
    const el = document.getElementById('cd'+slot);
    if (!el) return;
    const endKey = slot==='F'?'fCdEnd':slot==='Q'?'qCdEnd':slot==='E'?'eCdEnd':'rCdEnd';
    const remain = Math.max(0, player[endKey]-now);
    const pct = cls.cd[slot] ? remain/cls.cd[slot] : 0;
    el.style.height = (pct*100)+'%';
  });
}
function checkInteractables(){
  const hint = document.getElementById('interactHint');
  if (level.type==='hub' && level.shopX!==undefined){
    const d = Math.hypot(player.x-level.shopX, player.z-level.shopZ);
    if (d < 3){ hint.style.display='block'; hint.textContent="Press G to browse Old Marrow's wares"; }
    else hint.style.display='none';
  } else {
    hint.style.display='none';
  }
}
function buildAbilityBar(cls){
  const bar = document.getElementById('abilityBar');
  bar.innerHTML = '';
  ['F','Q','E','R'].forEach(slot=>{
    const div = document.createElement('div');
    div.className = 'abilitySlot';
    div.innerHTML = '<span class="key">'+slot+'</span><div class="cd" id="cd'+slot+'"></div><span class="label">'+cls.abilities[slot]+'</span>';
    bar.appendChild(div);
  });
}

/* ---- Shop ---- */
function closeAllModals(){
  document.getElementById('shopModal').classList.remove('show');
  document.getElementById('inventoryModal').classList.remove('show');
  uiOpen = false;
}
function openShop(){
  uiOpen = true;
  keysDown.clear();
  document.exitPointerLock();
  shopTab = 'buy';
  document.getElementById('shopModal').classList.add('show');
  renderShop();
}
function setShopTab(tab){
  shopTab = tab;
  renderShop();
}
function renderShop(){
  document.getElementById('shopGoldText').textContent = player.gold;
  document.getElementById('shopTabBuy').classList.toggle('tabActive', shopTab==='buy');
  document.getElementById('shopTabSell').classList.toggle('tabActive', shopTab==='sell');
  const box = document.getElementById('shopList');
  box.innerHTML = '';
  if (shopTab==='sell'){
    if (player.inventory.length===0){
      box.innerHTML = '<div class="emptyNote">Nothing to sell.</div>';
      return;
    }
    player.inventory.forEach(item=>{
      const price = getSellPrice(item);
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML = itemRowHtml(item);
      const btn = document.createElement('button');
      btn.textContent = 'Sell — '+price+'g';
      btn.addEventListener('click', ()=>sellItem(item.uid));
      row.appendChild(btn);
      box.appendChild(row);
    });
    return;
  }
  shopStock.forEach((item, idx)=>{
    const row = document.createElement('div');
    row.className = 'shopItem';
    row.innerHTML = itemRowHtml(item);
    const btn = document.createElement('button');
    btn.textContent = 'Buy — '+item.price+'g';
    btn.disabled = player.gold < item.price;
    btn.addEventListener('click', ()=>buyItem(idx));
    row.appendChild(btn);
    box.appendChild(row);
  });
  if (shopStock.length===0) box.innerHTML += '<div class="emptyNote">Sold out. Come back after a haul.</div>';
}
function buyItem(idx){
  const item = shopStock[idx];
  if (!item || player.gold < item.price) return;
  player.gold -= item.price;
  player.inventory.push(item);
  shopStock.splice(idx,1);
  log('Bought '+item.name+' for '+item.price+'g.', rarityCss(item.rarity));
  renderShop();
  saveGame();
}
function sellItem(uid){
  const idx = player.inventory.findIndex(i=>i.uid===uid);
  if (idx<0) return;
  const item = player.inventory[idx];
  const price = getSellPrice(item);
  player.gold += price;
  player.inventory.splice(idx,1);
  log('Sold '+item.name+' for '+price+'g.', rarityCss(item.rarity));
  if (document.getElementById('shopModal').classList.contains('show')) renderShop();
  if (document.getElementById('inventoryModal').classList.contains('show')) renderInventory();
  saveGame();
}

/* ---- Inventory ---- */
function openInventory(){
  uiOpen = true;
  keysDown.clear();
  document.exitPointerLock();
  document.getElementById('inventoryModal').classList.add('show');
  renderInventory();
}
function renderInventory(){
  const eq = document.getElementById('invEquipped');
  eq.innerHTML = '<div class="sectionLabel">Equipped</div>';
  ['weapon','armor','accessory'].forEach(slot=>{
    const item = player.equipment[slot];
    const row = document.createElement('div');
    row.className = 'shopItem';
    if (item){
      row.innerHTML = itemRowHtml(item);
      const btn = document.createElement('button');
      btn.textContent = 'Unequip';
      btn.addEventListener('click', ()=>{ unequipItem(slot); renderInventory(); });
      row.appendChild(btn);
    } else {
      row.innerHTML = '<div class="icon">—</div><div class="info"><div class="nm" style="color:var(--muted)">Empty</div><div class="sub">'+slot+'</div></div>';
    }
    eq.appendChild(row);
  });
  const list = document.getElementById('invList');
  list.innerHTML = '<div class="sectionLabel">Inventory</div>';
  if (player.inventory.length===0){
    list.innerHTML += '<div class="emptyNote">Nothing carried — go hunt.</div>';
    return;
  }
  player.inventory.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'shopItem';
    row.innerHTML = itemRowHtml(item);
    const btn = document.createElement('button');
    btn.textContent = 'Equip';
    btn.addEventListener('click', ()=>{ equipItem(item); renderInventory(); });
    row.appendChild(btn);
    list.appendChild(row);
  });
}
