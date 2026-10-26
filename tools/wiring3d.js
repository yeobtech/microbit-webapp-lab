import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const api = window.wiringLab, data = api.getScene();
const panel = $('w3Panel'), host = $('w3Viewport'), toggle = $('w3Toggle');
const photo = $('stage').parentElement;
const controlsUI = [$('w3Top'), $('w3Reset'), $('w3Focus')];
const colors = {ground:0x303734, power:0xe84b40, signal:0xf0bf23};
const positions = new Map(), pinMeshes = [], pinViews = new Map(), buttons = new Map();
const pinLabels = [];
const deviceCenters = {board:new THREE.Vector3(-3.3,.3,0),ultra:new THREE.Vector3(4,.3,-3.2),servo:new THREE.Vector3(4,.5,0),neo:new THREE.Vector3(4,.3,3.2)};
let renderer, world, camera, orbit, wireGroup, active=false, visible=false, frame=0, failed=false;
let state=api.getState(), wireSignature='';

function box(w,h,d,color,parent,pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65}));
  m.position.set(...pos); parent.add(m); return m;
}
function cylinder(r,h,color,parent,pos) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.25}));
  m.position.set(...pos); parent.add(m); return m;
}
function label(text,pos,width=2,color='#223830') {
  const canvas=document.createElement('canvas'); canvas.width=Math.max(128,text.length*32); canvas.height=64;
  const ctx=canvas.getContext('2d'); ctx.fillStyle='rgba(250,249,241,.95)';ctx.fillRect(0,0,canvas.width,64);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 40px system-ui, sans-serif';ctx.fillText(text,canvas.width/2,32,canvas.width-8);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
  sprite.position.set(...pos);sprite.scale.set(width,width*64/canvas.width,1);world.add(sprite);return sprite;
}
function tube(a,b,color,lift=.9,radius=.045) {
  const curve = new THREE.CubicBezierCurve3(a,a.clone().add(new THREE.Vector3(0,lift,0)),b.clone().add(new THREE.Vector3(0,lift,0)),b);
  return new THREE.Mesh(new THREE.TubeGeometry(curve,32,radius,8,false),new THREE.MeshStandardMaterial({color,roughness:.6}));
}
function pin(id,position) {
  const p=data.devices.flatMap(d=>d.pins).find(p=>p.id===id);
  const color=id.endsWith('.e')?0x4388cd:colors[p.kind];
  const point=new THREE.Vector3(...position); positions.set(id,point);
  box(.32,.18,.32,color,world,[point.x,point.y-.19,point.z]);
  const socket=cylinder(.115,.11,0xd7ba6a,world,[point.x,point.y-.04,point.z]);
  cylinder(.065,.12,0x171d1c,world,[point.x,point.y-.025,point.z]);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.24,.04,8,24),new THREE.MeshBasicMaterial({color:0xf2b705}));
  halo.rotation.x=-Math.PI/2;halo.position.copy(point);halo.position.y+=.06;world.add(halo);
  // Larger invisible hit targets make the small sockets usable without changing their visual size.
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),new THREE.MeshBasicMaterial({visible:false}));
  hit.position.copy(point); hit.userData.pin=id;world.add(hit);pinMeshes.push(hit);
  pinViews.set(id,{halo,socket});
}
function createModels() {
  box(17,.15,11,0xdad5c6,world,[0,-.2,0]);
  box(7.5,.2,5.4,0x303936,world,[-3.3,0,0]);
  label('Robotbit 확장보드',[-3.3,.4,-3.35],4);
  const columns=[['P13',-5.2],['P14',-4.4],['P15',-3.6],['S1',-.7]];
  for(const [name,x] of columns) {
    pinLabels.push(label(name,[x,.55,-2.35],.75));
    for(const [kind,z] of [['ground',-1.8],['power',-1.15],['signal',-.5]]) box(.45,.18,.45,colors[kind],world,[x,.18,z]);
  }
  pinLabels.push(label('GND',[-6.25,.45,-1.8],.9),label('3.3V',[-6.25,.45,-1.15],.9),label('S',[-6.25,.45,-.5],.9),label('VM',[.05,.45,-1.15],.65));
  for(const [prefix,x] of [['ultraBoard',-4.4],['neoBoard',-3.6],['servoBoard',-.7]]) {
    pin(prefix+'.g',[x,.5,-1.8]);pin(prefix+'.v',[x,.5,-1.15]);
    pin(prefix+(prefix==='ultraBoard'?'.t':'.s'),[x,.5,-.5]);
  }
  pin('ultraBoard.e',[-5.2,.5,-.5]);
  const battery=cylinder(.46,5.7,0x9d79c3,world,[-3.3,.6,.65]);battery.rotation.z=Math.PI/2;
  box(6.5,.18,1.2,0x151e1a,world,[-3.3,.16,.65]);
  label('배터리 · 전원 OFF',[-3.3,1.25,.8],3.2);
  box(4.4,1.6,.16,0x1f2727,world,[-3.3,1.05,2.1]);
  for(let row=0;row<5;row++) for(let col=0;col<5;col++) box(.1,.1,.05,0x8e3030,world,[-3.7+col*.2,1.5-row*.2,2.21]);
  box(.35,.35,.1,0xaaaaaa,world,[-4.8,1.1,2.25]);box(.35,.35,.1,0xaaaaaa,world,[-1.8,1.1,2.25]);
  label('micro:bit',[-3.3,.25,2.7],2);
  // HC-SR04: twin transducers and four accessible terminals.
  box(3.5,.18,1.6,0x287f93,world,[4,.1,-3.2]);
  for(const x of [3.1,4.9]) {cylinder(.52,.65,0xc5cbcc,world,[x,.5,-3.35]);cylinder(.4,.67,0x4d5558,world,[x,.51,-3.35]);}
  label('HC-SR04 · 초음파센서',[4,.6,-4.65],3.7);
  for(const [id,x] of [['v',2.95],['t',3.65],['e',4.35],['g',5.05]]) pin('ultra.'+id,[x,.48,-2.3]);
  // SG90 and its three-wire connector.
  box(1.5,1.25,1.2,0x3375c4,world,[4.5,.7,0]);
  cylinder(.35,.4,0x3566a5,world,[4.5,1.5,0]);
  box(1.6,.13,.22,0xe8ece5,world,[4.5,1.76,0]);
  label('SG90 · 서보모터',[4.3,2.25,0],3);
  for(const [id,z] of [['g',-.65],['v',0],['s',.65]]) {
    pin('servo.'+id,[2.3,.4,z]);world.add(tube(new THREE.Vector3(2.3,.2,z),new THREE.Vector3(3.75,.35,z*.6),id==='g'?0x805734:id==='v'?0xdf3d36:0xe88a31,.2,.035));
  }
  // Six LED module; sockets at its input side, no invented extra LEDs.
  box(5.3,.18,1.35,0x26352f,world,[4.2,.1,3.2]);
  for(let i=0;i<6;i++) {box(.49,.12,.6,0xe9e9d9,world,[2.75+i*.66,.25,3.2]);cylinder(.13,.14,0xd3bd7c,world,[2.75+i*.66,.3,3.2]);}
  for(const [id,z] of [['g',2.7],['v',3.2],['s',3.7]]) pin('neo.'+id,[1.9,.45,z]);
  label('WS2812B · 네오픽셀 6개',[4.3,.5,4.65],4);
}
function makeButtons() {
  for(const d of data.devices) {
    const section=document.createElement('section'), title=document.createElement('h3'), list=document.createElement('div');
    title.textContent=d.name;list.className='w3-pinlist';section.append(title,list);
    d.pins.forEach((p,index)=>{
      const b=document.createElement('button');b.type='button';b.dataset.w3Pin=p.id;b.style.setProperty('--pin-color','#'+colors[p.kind].toString(16).padStart(6,'0'));
      const dot=document.createElement('i'),text=document.createElement('span');b.append(dot,text);
      b.addEventListener('click',()=>api.activate(p.id));list.append(b);buttons.set(p.id,{button:b,text,p,index});
    });$('w3Pins').append(section);
  }
}
function disposeWires() { for(const child of [...wireGroup.children]) {child.geometry.dispose();child.material.dispose();wireGroup.remove(child);} }
function sync() {
  state=api.getState();
  const hints=state.hint===null?[]:[data.wires[state.hint].from,data.wires[state.hint].to];
  const wired=new Set(state.conns.flatMap(i=>[data.wires[i].from,data.wires[i].to]));
  for(const [id,{button,text,p,index}] of buttons) {
    text.textContent=(wired.has(id)?'✓ ':'')+(state.mode==='solo'?'핀 '+(index+1):p.label);
    button.disabled=state.verified;button.setAttribute('aria-pressed',String(state.selected===id));button.dataset.hint=String(hints.includes(id));button.dataset.wired=String(wired.has(id));
  }
  if(!world) return;
  pinLabels.forEach(label=>{label.visible=state.mode!=='solo';});
  for(const [id,{halo}] of pinViews) {
    halo.visible=state.selected===id||hints.includes(id)||wired.has(id);
    halo.material.color.set(state.selected===id?0x287fe0:wired.has(id)?0x299866:0xf0ae00);
  }
  const signature=state.conns.join(',');
  if(signature!==wireSignature) {
    disposeWires();
    state.conns.forEach(i=>{const w=data.wires[i];wireGroup.add(tube(positions.get(w.from),positions.get(w.to),w.color,1.4+i*.13));});
    wireSignature=signature;
  }
  requestDraw();
}
function frameScene(focus='all',top=false) {
  const target=focus==='all'?new THREE.Vector3(0,0,0):deviceCenters[focus];
  const distance=focus==='all'?Math.max(16,13/camera.aspect):focus==='board'?Math.max(12,12/camera.aspect):Math.max(7,5/camera.aspect);
  orbit.target.copy(target);
  camera.position.copy(target).add(top?new THREE.Vector3(0,distance,.01):new THREE.Vector3(distance*.3,distance*.85,distance*.8));
  orbit.update();requestDraw();
}
function resize() {
  if(!host.clientWidth || !host.clientHeight) return;
  renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();frameScene($('w3Focus').value);
}
function requestDraw() {
  if(!active||!visible||document.hidden||frame) return;
  frame=requestAnimationFrame(()=>{frame=0;renderer.render(world,camera);});
}
function fail() {
  active=false;failed=true;cancelAnimationFrame(frame);frame=0;
  panel.hidden=true;photo.hidden=false;$('zoom').disabled=false;
  toggle.disabled=true;toggle.setAttribute('aria-pressed','false');controlsUI.forEach(el=>el.disabled=true);
  $('w3Help').textContent='이 기기에서는 3D를 사용할 수 없어 사진 작업대를 유지합니다. 연결 기록은 그대로예요.';
  orbit?.dispose();renderer?.dispose();
}
function init() {
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0xe9e6dc);
  host.append(renderer.domElement);const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','3D 배선 작업대. 마우스로 핀을 선택하거나 아래 부품별 이름표 버튼을 사용하세요.');
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});
  world=new THREE.Scene();world.add(new THREE.HemisphereLight(0xffffff,0x746f5b,2.7));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-4,12,8);world.add(light);
  camera=new THREE.PerspectiveCamera(45,1,.1,100);
  orbit=new OrbitControls(camera,canvas);orbit.enablePan=false;orbit.minDistance=4;orbit.maxDistance=52;orbit.minPolarAngle=.02;orbit.maxPolarAngle=1.3;orbit.addEventListener('change',requestDraw);
  wireGroup=new THREE.Group();world.add(wireGroup);createModels();
  wireSignature='initial';
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null,dragged=false;const pointers=new Set();
  canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1)dragged=true;else{down={x:e.clientX,y:e.clientY};dragged=false;}});
  canvas.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)dragged=true;});
  canvas.addEventListener('pointerup',e=>{
    pointers.delete(e.pointerId);
    if(!down||dragged||state.verified){if(!pointers.size)down=null;return;}
    down=null;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pinMeshes,false)[0];if(hit)api.activate(hit.object.userData.pin);
  });
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;dragged=true;});
  new ResizeObserver(()=>{if(active)resize();}).observe(host);
}
makeButtons();sync();
toggle.addEventListener('click',()=>{
  if(failed)return;
  try {
    if(!renderer)init();active=!active;panel.hidden=!active;photo.hidden=active;$('zoom').disabled=active;
    toggle.textContent=active?'사진으로 보기':'3D 작업대 열기';toggle.setAttribute('aria-pressed',String(active));controlsUI.forEach(el=>el.disabled=!active);
    $('w3Help').textContent=active?'핀 두 개를 차례로 눌러 연결해 보세요. 작은 핀은 부품을 확대하거나 아래 이름표로 선택할 수 있어요.':'사진 작업대로 돌아왔어요. 3D에서 연결한 선도 그대로입니다.';
    if(active){resize();sync();}else{cancelAnimationFrame(frame);frame=0;window.dispatchEvent(new Event('resize'));}
  }catch(error){console.warn('3D wiring unavailable',error);fail();}
});
$('w3Reset').addEventListener('click',()=>{$('w3Focus').value='all';frameScene();});
$('w3Top').addEventListener('click',()=>frameScene($('w3Focus').value,true));
$('w3Focus').addEventListener('change',e=>frameScene(e.target.value));
window.addEventListener('wiring-state',sync);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else{cancelAnimationFrame(frame);frame=0;}}).observe(host);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else requestDraw();});
