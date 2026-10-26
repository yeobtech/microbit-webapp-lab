import * as THREE from 'three';

// Only presentation lives here. The lesson's existing judge()/send() owns the rules.
const byId = id => document.getElementById(id);
const host = byId('lanternViewport');
const toggle = byId('lantern3d');
const insideButton = byId('lanternInside');
const resetButton = byId('lanternReset');
const turnButton = byId('lanternTurn');
const hint = byId('lanternHint');
const flat = document.querySelector('.lantern-scene svg');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, scene, camera, lid, shell, leds, lamp, ambient;
let active = false, visible = false, inside = false, failed = false, frame = 0, previous = 0;
let azimuth = .65, elevation = .35, currentAngle = 0;
let state = window.getLanternState();

function cameraPosition() {
  const radius = Math.max(10.5, 7 / (camera.aspect || 1));
  camera.position.set(radius * Math.sin(azimuth) * Math.cos(elevation), 2.4 + radius * Math.sin(elevation), radius * Math.cos(azimuth) * Math.cos(elevation));
  camera.lookAt(0, 2.4, 0);
}
function mesh(geometry, color, parent, position, materialOptions = {}) {
  const material = new THREE.MeshStandardMaterial({color, roughness:.7, ...materialOptions});
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  parent.add(object);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({color:0x34382f, transparent:true, opacity:.65}));
  object.add(edges);
  return object;
}
function box(w, h, d, color, parent, pos, options) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, parent, pos, options);
}
function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
function fallback(message) {
  failed = true; active = false; stop();
  host.hidden = true; flat.hidden = false; flat.style.display = '';
  toggle.disabled = true; toggle.setAttribute('aria-pressed', 'false');
  insideButton.disabled = resetButton.disabled = turnButton.disabled = true;
  hint.textContent = message;
  renderer?.dispose();
}
function init() {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xeee9dc);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D 등불. 좌우 방향키로 회전, 위아래 방향키로 높이 조절. 슬라이더로 덮개와 LED를 조작하세요.');
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); fallback('3D 화면을 사용할 수 없어 그림으로 전환했습니다. 센서 체험은 계속할 수 있어요.');
  });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
  ambient = new THREE.HemisphereLight(0xffffff, 0x666044, 2.4); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(3, 7, 5); scene.add(sun);
  const model = new THREE.Group(); scene.add(model);
  mesh(new THREE.CylinderGeometry(2.35, 2.35, .12, 64), 0xd8d0ba, model, [0,-.1,0]);
  box(2.35,.22,1.8,0xb88045,model,[0,.08,0]);
  // Open frame, with a translucent enclosure that can be removed for inspection.
  for (const x of [-1,1]) for (const z of [-.7,.7]) box(.12,2.7,.12,0xad7541,model,[x,1.5,z]);
  shell = box(1.95,2.5,1.35,0xf9dca0,model,[0,1.5,0],{transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  box(1.65,.12,1.1,0x344e42,model,[0,.42,0]);
  leds = [];
  for (let i=0; i<6; i++) {
    const angle = i * Math.PI / 3;
    const led = mesh(new THREE.CylinderGeometry(.16,.16,.12,16),0xf5f0dc,model,[Math.cos(angle)*.55,.54,Math.sin(angle)*.36],{emissive:0x000000});
    leds.push(led);
  }
  const servo = box(.42,.65,.5,0x3561b2,model,[-.72,2.4,0]);
  servo.name = 'SG90';
  box(.12,.55,.12,0xf2eee2,model,[-1.03,2.7,0]);
  // Hinge at the left edge; rotate the lid around that edge, not its centre.
  lid = new THREE.Group(); lid.position.set(-1.1,2.9,0); model.add(lid);
  box(2.2,.18,1.75,0xb88045,lid,[1.1,0,0]);
  lamp = new THREE.PointLight(0xffd68a,0,6,2); lamp.position.set(0,1,0); scene.add(lamp);
  const grid = new THREE.GridHelper(12,24,0xc5bca6,0xdfd7c5); grid.position.y=-.18; scene.add(grid);
  cameraPosition();
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if(e.pointerType === 'touch') return; // Preserve vertical page scrolling on phones; use buttons/keys there.
    drag = {x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if(!drag) return;
    azimuth -= (e.clientX-drag.x)*.01;
    elevation = THREE.MathUtils.clamp(elevation+(e.clientY-drag.y)*.008,-.1,1.15);
    drag = {x:e.clientX,y:e.clientY}; cameraPosition(); start();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{drag=null;});
  canvas.addEventListener('keydown', e => {
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    azimuth += e.key==='ArrowLeft' ? .15 : e.key==='ArrowRight' ? -.15 : 0;
    elevation = THREE.MathUtils.clamp(elevation+(e.key==='ArrowUp' ? .1 : e.key==='ArrowDown' ? -.1 : 0),-.1,1.15);
    cameraPosition(); start();
  });
  new ResizeObserver(()=>{ if(active) { resize(); start(); } }).observe(host);
}
function resize() {
  const width = host.clientWidth, height = host.clientHeight;
  if(!width || !height) return;
  renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); cameraPosition();
}
function render(time) {
  frame = 0;
  if(!active || !visible || document.hidden) return;
  const dt = previous ? Math.min((time-previous)/1000,.05) : 1/60; previous=time;
  const target = THREE.MathUtils.degToRad(state.servo);
  currentAngle = reduced.matches ? target : THREE.MathUtils.damp(currentAngle,target,9,dt);
  if(Math.abs(target-currentAngle)<.001) currentAngle=target;
  lid.rotation.z=currentAngle;
  shell.visible=!inside;
  let lit=0;
  state.pixels.forEach((rgb,i)=>{
    const on=rgb.some(v=>v>0); if(on) lit++;
    const color = new THREE.Color(`rgb(${rgb.join(',')})`);
    leds[i].material.color.set(on ? color : 0xe2dfd2);
    leds[i].material.emissive.copy(color); leds[i].material.emissiveIntensity=on ? 1.7 : 0;
  });
  lamp.intensity=lit ? 5 : 0;
  lamp.color.set(state.pixels.every(rgb=>rgb[1]===0 && rgb[2]===0) ? 0xff3333 : 0xffd68a);
  ambient.intensity=lit ? 1.25 : 2.4;
  renderer.setClearColor(lit ? 0x555d6a : 0xeee9dc);
  renderer.render(scene,camera);
  if(currentAngle!==target) start();
}
function start() { if(active && visible && !document.hidden && !frame) frame=requestAnimationFrame(render); }
toggle.addEventListener('click',()=>{
  if(failed) return;
  try {
    if(!renderer) init();
    active=!active;
    host.hidden=!active; flat.style.display=active?'none':'';
    toggle.setAttribute('aria-pressed',String(active)); toggle.textContent=active?'그림으로 보기':'3D 보기';
    insideButton.disabled=resetButton.disabled=turnButton.disabled=!active;
    hint.textContent=active?'마우스로 돌리거나 화면을 선택한 뒤 방향키를 눌러 보세요. 내부 보기로 LED와 파란 서보모터를 관찰하세요.':'그림으로 보고 있어요. 센서값과 판단 규칙은 같습니다.';
    if(active) { resize(); start(); } else stop();
  } catch(error) { console.warn('Lantern 3D unavailable',error); fallback('이 기기에서는 3D를 열 수 없어 그림을 유지합니다. 센서 체험은 계속할 수 있어요.'); }
});
insideButton.addEventListener('click',()=>{inside=!inside;insideButton.setAttribute('aria-pressed',String(inside));start();});
resetButton.addEventListener('click',()=>{azimuth=.65;elevation=.35;cameraPosition();start();});
turnButton.addEventListener('click',()=>{azimuth+=Math.PI/2;cameraPosition();start();});
window.addEventListener('lantern-state',e=>{state=e.detail;start();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(host);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
reduced.addEventListener('change',start);
