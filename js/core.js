/* Three.js setup + shared mutable game state. Loads first: canvas/scene/camera
   and these globals are referenced by every other script. */
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 250);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function makeNoiseTexture(repeatX, repeatY){
  const c = document.createElement('canvas'); c.width=16; c.height=16;
  const cx = c.getContext('2d');
  const img = cx.createImageData(16,16);
  for (let i=0;i<img.data.length;i+=4){
    const v = 150 + Math.floor(Math.random()*90);
    img.data[i]=v; img.data[i+1]=v; img.data[i+2]=v; img.data[i+3]=255;
  }
  cx.putImageData(img,0,0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX||1, repeatY||1);
  return tex;
}

const CELL = 4, WALL_H = 3.2, EYE_H = 1.6, PLAYER_R = 0.35;
let itemUid = 1;

let player = {
  classId:null, hp:0, maxHp:0, xp:0, xpNext:40, level:1, gold:0, maxDepth:0,
  x:0, z:0, yaw:0, pitch:0, speed:4.6, dmgMult:1,
  fCdEnd:0, qCdEnd:0, eCdEnd:0, rCdEnd:0,
  guardEnd:0, rampageEnd:0, riposteEnd:0, invulnEnd:0,
  equipment:{weapon:null, armor:null, accessory:null}, inventory:[],
};
let level = null;
let depth = 0;
let seedBase = 'ash-' + Math.floor(Math.random()*99999);
let projectiles = [];
let hpBars = [];
let pickups = [];
let shopStock = [];
let shopTab = 'buy';
let locked = false;
let uiOpen = false;
let keysDown = new Set();
let transitionLockUntil = 0;
let transitioning = false;
let lastFrame = performance.now();
