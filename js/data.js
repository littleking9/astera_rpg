/* RNG helpers + all static game data tables + item generation. */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
function randInt(rng,min,max){ if(max<min){const t=min;min=max;max=t;} return Math.floor(rng()*(max-min+1))+min; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function weightedPick(rng, table){
  const keys = Object.keys(table);
  const total = keys.reduce((s,k)=>s+Math.max(0,table[k]),0);
  let r = rng()*total;
  for (const k of keys){ r -= Math.max(0,table[k]); if (r<=0) return k; }
  return keys[keys.length-1];
}

/* ---- Classes ---- */
const CLASSES = {
  wizard:{
    id:'wizard', name:'Wizard', tag:'Ranged · Fragile',
    desc:'Fires ashen bolts and blinks through danger. Low health, high burst.',
    hp:55, speed:4.6, dmgMult:0.85, color:0x8b5cf6,
    abilities:{F:'Bolt',Q:'Ashen Burst',E:'Blink',R:'Meteor'},
    cd:{F:450,Q:3500,E:4000,R:9000},
  },
  berserker:{
    id:'berserker', name:'Berserker', tag:'Melee · Tanky',
    desc:'Cleaves and whirls through crowds. High health, reckless offense.',
    hp:95, speed:4.8, dmgMult:1.4, color:0xef4444,
    abilities:{F:'Cleave',Q:'Whirlwind',E:'Charge',R:'Rampage'},
    cd:{F:550,Q:2600,E:5000,R:10000},
  },
  swordsman:{
    id:'swordsman', name:'Swordsman', tag:'Melee · Balanced',
    desc:'A trained blade and shield. Solid offense with defensive stances.',
    hp:75, speed:4.6, dmgMult:1.05, color:0x3b82f6,
    abilities:{F:'Thrust',Q:'Guard',E:'Riposte',R:'Second Wind'},
    cd:{F:500,Q:4500,E:6000,R:9000},
  },
  ranger:{
    id:'ranger', name:'Ranger', tag:'Ranged · Mobile',
    desc:'Peppers foes with arrows and darts out of harm\'s way. Fast and evasive.',
    hp:65, speed:5.3, dmgMult:0.95, color:0x22c55e,
    abilities:{F:'Shot',Q:'Volley',E:'Roll',R:'Barrage'},
    cd:{F:350,Q:3000,E:3200,R:8000},
  },
};

/* ---- Monsters ---- */
const MONSTER_TYPES = [
  {id:'rat',name:'Cave Rat',hp:9,dmg:2,xp:5,speed:2.6,scale:0.65,color:0x8b7355,tier:'trash',barY:0.55},
  {id:'goblin',name:'Goblin',hp:16,dmg:4,xp:8,speed:2.3,scale:0.85,color:0x4ade80,tier:'trash',barY:1.55},
  {id:'skeleton',name:'Skeleton',hp:24,dmg:6,xp:14,speed:2.0,scale:1.0,color:0xe5e7eb,tier:'normal',barY:1.35},
  {id:'orc',name:'Orc Brute',hp:38,dmg:9,xp:22,speed:1.7,scale:1.25,color:0xf97316,tier:'normal',barY:1.9},
  {id:'wraith',name:'Wraith',hp:30,dmg:11,xp:32,speed:2.9,scale:1.0,color:0xa78bfa,tier:'elite',barY:1.6},
];
const BOSS_TYPE = {id:'warden',name:'The Ash Warden',hp:150,dmg:15,xp:150,speed:1.9,scale:2.0,color:0xf43f5e,tier:'boss',barY:2.7};

const BIOMES = [
  {name:'Candy Crypt', floor:0x6a4bc9, wall:0x2f1c5c, ceil:0x1c1140},
  {name:'Mint Caverns', floor:0x1fae8e, wall:0x0f6b56, ceil:0x0a3d31},
  {name:'Bubblegum Halls', floor:0xd94fa8, wall:0x7a1f5c, ceil:0x4a1240},
  {name:'Sky Frostvault', floor:0x2f8fc9, wall:0x1f5f7e, ceil:0x123044},
];

/* ---- Items / loot ---- */
const RARITIES = {
  common:{label:'Common', color:0xc9d4e8, mult:1.0, affixRange:[0,0]},
  uncommon:{label:'Uncommon', color:0x5eead4, mult:1.3, affixRange:[1,1]},
  rare:{label:'Rare', color:0x5eb8ff, mult:1.7, affixRange:[1,2]},
  epic:{label:'Epic', color:0xe879f9, mult:2.2, affixRange:[2,3]},
  legendary:{label:'Legendary', color:0xffd23f, mult:3.0, affixRange:[3,4]},
};
function rarityCss(key){ return '#'+RARITIES[key].color.toString(16).padStart(6,'0'); }
const ITEM_BASES = {
  weapon: [
    {id:'blade', name:'Blade', icon:'⚔️', primaryStat:'dmg', baseRange:[2,5]},
    {id:'axe', name:'Axe', icon:'🪓', primaryStat:'dmg', baseRange:[3,7]},
    {id:'staff', name:'Staff', icon:'🪄', primaryStat:'dmg', baseRange:[2,4]},
    {id:'bow', name:'Bow', icon:'🏹', primaryStat:'dmg', baseRange:[2,5]},
  ],
  armor: [
    {id:'plate', name:'Plate', icon:'🛡️', primaryStat:'armor', baseRange:[2,5]},
    {id:'robe', name:'Robe', icon:'🥋', primaryStat:'armor', baseRange:[1,3]},
    {id:'leather', name:'Leather Vest', icon:'🦺', primaryStat:'armor', baseRange:[1,4]},
  ],
  accessory: [
    {id:'ring', name:'Ring', icon:'💍', primaryStat:'crit', baseRange:[2,5]},
    {id:'amulet', name:'Amulet', icon:'📿', primaryStat:'lifesteal', baseRange:[2,5]},
    {id:'charm', name:'Charm', icon:'🍀', primaryStat:'goldFind', baseRange:[8,18]},
  ],
};
const AFFIX_POOL = [
  {stat:'dmg', label:'Sharp', range:[1,4]},
  {stat:'armor', label:'Sturdy', range:[1,3]},
  {stat:'crit', label:'Keen', range:[2,5]},
  {stat:'lifesteal', label:'Vampiric', range:[2,6]},
  {stat:'speed', label:'Swift', range:[1,2]},
  {stat:'goldFind', label:'Fortunate', range:[8,20]},
  {stat:'hp', label:'Vital', range:[5,15]},
];
const STAT_LABEL = {dmg:'Dmg', armor:'Armor', crit:'Crit%', lifesteal:'Lifesteal%', speed:'Speed', goldFind:'Gold Find%', hp:'Max HP'};
const DROP_TABLES = {
  trash:{nothing:60,common:30,uncommon:8,rare:1.7,epic:0.28,legendary:0.02},
  normal:{nothing:45,common:35,uncommon:15,rare:4,epic:0.9,legendary:0.1},
  elite:{nothing:20,common:28,uncommon:30,rare:16,epic:5,legendary:1},
  boss:{nothing:0,common:5,uncommon:20,rare:35,epic:28,legendary:12},
};
const SHOP_PRICE_BASE = {common:15,uncommon:40,rare:95,epic:230,legendary:520};

function generateItem(rng, slot, rarityKey, depthN){
  const rarity = RARITIES[rarityKey];
  const bases = ITEM_BASES[slot];
  const base = bases[Math.floor(rng()*bases.length)];
  const [minA,maxA] = rarity.affixRange;
  const affixCount = randInt(rng, minA, maxA);
  const used = new Set();
  const affixes = [];
  for (let i=0;i<affixCount;i++){
    let opt = AFFIX_POOL[Math.floor(rng()*AFFIX_POOL.length)];
    let guard=0;
    while ((used.has(opt.stat) || opt.stat===base.primaryStat) && guard<10){ opt = AFFIX_POOL[Math.floor(rng()*AFFIX_POOL.length)]; guard++; }
    used.add(opt.stat);
    const value = randInt(rng, opt.range[0], opt.range[1]) + Math.floor(depthN*0.4);
    affixes.push({stat:opt.stat, value, label:opt.label});
  }
  const primaryValue = Math.round((base.baseRange[0] + rng()*(base.baseRange[1]-base.baseRange[0])) * rarity.mult + depthN*0.5);
  const prefixLabel = affixes[0] ? affixes[0].label+' ' : '';
  return {
    uid:itemUid++, slot, baseId:base.id, name:prefixLabel+base.name, icon:base.icon,
    rarity:rarityKey, primaryStat:base.primaryStat, primaryValue, affixes,
  };
}
function rollDrop(rng, tier, depthN){
  const table = Object.assign({}, DROP_TABLES[tier]);
  const bonus = Math.min(depthN*1.2, 18);
  table.nothing = Math.max(0, table.nothing-bonus);
  table.rare += bonus*0.5; table.epic += bonus*0.3; table.legendary += bonus*0.2;
  const rarityKey = weightedPick(rng, table);
  if (rarityKey==='nothing') return null;
  const slots = ['weapon','armor','accessory'];
  return generateItem(rng, slots[randInt(rng,0,2)], rarityKey, depthN);
}
function getSellPrice(item){ return Math.round((SHOP_PRICE_BASE[item.rarity]||SHOP_PRICE_BASE.common) * 0.4); }
function statSummary(item){
  const parts = [];
  if (item.primaryStat) parts.push('+'+item.primaryValue+' '+STAT_LABEL[item.primaryStat]);
  for (const af of item.affixes) parts.push('+'+af.value+' '+STAT_LABEL[af.stat]);
  return parts.join(', ');
}
function itemRowHtml(item){
  const r = RARITIES[item.rarity];
  return '<div class="icon">'+item.icon+'</div><div class="info"><div class="nm" style="color:'+rarityCss(item.rarity)+'">'+item.name+'</div>'+
    '<div class="sub">'+r.label+' · '+item.slot+'</div><div class="stats">'+statSummary(item)+'</div></div>';
}
