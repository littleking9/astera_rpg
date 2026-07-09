/* Persistence: save/load player progression via localStorage. */
const SAVE_KEY = 'depthOfAsh.save.v1';
function saveGame(){
  if (!player.classId) return;
  const data = {
    classId: player.classId,
    level: player.level, xp: player.xp, xpNext: player.xpNext,
    gold: player.gold, maxDepth: player.maxDepth,
    equipment: player.equipment, inventory: player.inventory,
    itemUid,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch(e){}
}
function loadGame(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}
function clearSave(){
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
}
window.addEventListener('beforeunload', saveGame);
