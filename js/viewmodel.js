/* First-person weapon view model. A small rig attached to the camera itself,
   so it moves and rotates with the player's view for free. */
scene.add(camera);
const viewModelGroup = new THREE.Group();
viewModelGroup.position.set(0.32, -0.32, -0.55);
viewModelGroup.rotation.set(0, 0.15, 0.05);
camera.add(viewModelGroup);

function buildWeaponMesh(item){
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({color:0x3a2a1a});
  if (!item){
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12), new THREE.MeshStandardMaterial({color:0xd8a06e}));
    group.add(fist);
    return group;
  }
  const rarity = RARITIES[item.rarity];
  const mat = new THREE.MeshStandardMaterial({color:rarity.color, emissive:rarity.color, emissiveIntensity: item.rarity==='legendary'?0.6:item.rarity==='epic'?0.35:0});
  switch(item.baseId){
    case 'blade': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.55,0.05), mat);
      blade.position.y = 0.32;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.03,0.03), new THREE.MeshStandardMaterial({color:0x9a9aa2}));
      guard.position.y = 0.03;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.16,8), woodMat);
      hilt.position.y = -0.06;
      group.add(blade, guard, hilt);
      break;
    }
    case 'axe': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.55,8), woodMat);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.15,0.24,4), mat);
      head.rotation.z = Math.PI/2; head.position.set(0.08,0.22,0);
      group.add(handle, head);
      break;
    }
    case 'staff': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.032,0.68,8), woodMat);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.085,10,10), mat);
      orb.position.y = 0.38;
      group.add(shaft, orb);
      break;
    }
    case 'bow': {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.26,0.02,6,12,Math.PI*1.15), mat);
      arc.rotation.z = Math.PI/2 - 0.1;
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.48,4), new THREE.MeshStandardMaterial({color:0xe8e4d8}));
      string.position.x = 0.02;
      group.add(arc, string);
      break;
    }
    default: {
      const generic = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.4,0.08), mat);
      generic.position.y = 0.2;
      group.add(generic);
    }
  }
  return group;
}
function updateViewModel(){
  while (viewModelGroup.children.length) viewModelGroup.remove(viewModelGroup.children[0]);
  viewModelGroup.add(buildWeaponMesh(player.equipment.weapon));
}
