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
const annotations = [];
const powerLeds = [], powerTargets = [];
const usbTargets = [];
let usbCable;
let switchKnob, batteryOff, batteryOn;
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
function ring(radius,tubeRadius,color,pos) {
  const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tubeRadius,10,48),new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.3}));
  m.rotation.x=-Math.PI/2;m.position.set(...pos);world.add(m);return m;
}
function plate(w,d,pos,color) {
  const s=new THREE.Shape(),r=.16;
  s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
  for(const x of [-w/2+.25,w/2-.25])for(const z of [-d/2+.25,d/2-.25]){const h=new THREE.Path();h.absarc(x,z,.11,0,Math.PI*2,true);s.holes.push(h);}
  const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false}),new THREE.MeshStandardMaterial({color,roughness:.6}));
  m.rotation.x=-Math.PI/2;m.position.set(...pos);world.add(m);
  for(const x of [-w/2+.25,w/2-.25])for(const z of [-d/2+.25,d/2-.25])ring(.13,.025,0xb5ad87,[pos[0]+x,pos[1]+.13,pos[2]+z]);
}
function silk(text,pos,width=1) {
  const canvas=document.createElement('canvas');canvas.width=Math.max(128,text.length*36);canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f1db';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,32);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width*64/canvas.width),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(...pos);world.add(m);return m;
}
function label(text,pos,width=2,color='#294658') {
  const device=pos[0]<0?'board':pos[2]<-2?'ultra':pos[2]>2?'neo':'servo';
  const palette={board:['#e2f2e9','#b7d7c6'],ultra:['#e3effb','#b9d1e8'],servo:['#fff0dc','#e7cfad'],neo:['#eee9f8','#d1c5e7']}[device];
  const canvas=document.createElement('canvas'); canvas.width=Math.max(180,text.length*36+60); canvas.height=96;
  const ctx=canvas.getContext('2d');
  ctx.beginPath();ctx.roundRect(3,3,canvas.width-6,90,32);ctx.fillStyle=palette[0];ctx.fill();ctx.strokeStyle=palette[1];ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='44px "Jua", sans-serif';ctx.fillText(text,canvas.width/2,49,canvas.width-36);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
  sprite.position.set(...pos);sprite.scale.set(width,width*96/canvas.width,1);
  sprite.userData.device=device;
  annotations.push(sprite);world.add(sprite);return sprite;
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
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,8,24),new THREE.MeshBasicMaterial({color:0xf2b705}));
  halo.rotation.x=-Math.PI/2;halo.position.copy(point);halo.position.y+=.06;world.add(halo);
  // Larger invisible hit targets make the small sockets usable without changing their visual size.
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({visible:false}));
  hit.position.copy(point); hit.userData.pin=id;world.add(hit);pinMeshes.push(hit);
  pinViews.set(id,{halo,socket});
}
function createModels() {
  box(17,.15,11,0xdad5c6,world,[0,-.2,0]);
  plate(7.5,5.4,[-3.3,0,0],0x222c28);
  label('Robotbit 확장보드',[-3.3,.4,-4.0],4);
  const columns=[...['P0','P1','P2','P8','P12','P13','P14','P15'].map((name,i)=>[name,-6.3+i*.38]),...Array.from({length:8},(_,i)=>['S'+(i+1),-2.5+i*.38])];
  for(const [name,x] of columns) {
    pinLabels.push(silk(name,[x,.14,-.17],.31));
    for(const [kind,z] of [['ground',-1.8],['power',-1.15],['signal',-.5]]) {
      box(.32,.18,.32,colors[kind],world,[x,.18,z]);
      box(.07,.2,.07,0xcdb875,world,[x,.35,z]);
    }
  }
  pinLabels.push(silk('GND',[-6.78,.14,-1.8],.5),silk('3.3V',[-6.78,.14,-1.15],.5),silk('S',[-6.78,.14,-.5],.3),silk('VM',[-2.95,.14,-1.15],.45));
  for(const [prefix,x] of [['ultraBoard',-4.02],['neoBoard',-3.64],['servoBoard',-2.5]]) {
    pin(prefix+'.g',[x,.5,-1.8]);pin(prefix+'.v',[x,.5,-1.15]);
    pin(prefix+(prefix==='ultraBoard'?'.t':'.s'),[x,.5,-.5]);
  }
  pin('ultraBoard.e',[-4.4,.5,-.5]);
  // Terminal block, USB socket, power slide switch, controller and passive components.
  box(.85,.35,.5,0x39854b,world,[-5.8,.3,-2.35]);
  for(const x of [-6,-5.6]) {cylinder(.13,.08,0xb8bfbb,world,[x,.52,-2.35]);box(.18,.015,.025,0x424946,world,[x,.57,-2.35]);}
  box(.6,.25,.42,0xbfc8ca,world,[-2.7,.27,-2.45]);box(.43,.13,.02,0x151b1b,world,[-2.7,.29,-2.67]);
  const chargeHit=box(.65,.4,.5,0xffffff,world,[-2.7,.3,-2.45]);chargeHit.material.visible=false;chargeHit.userData.usb='board';usbTargets.push(chargeHit);
  label('충전용 USB',[-2.7,.4,-3.0],1.8);
  box(.65,.2,.4,0x101615,world,[-1.65,.25,-2.4]);
  switchKnob=box(.22,.16,.32,0xeeeecc,world,[-1.83,.43,-2.4]);
  const switchHit=box(.9,.45,.65,0x222222,world,[-1.65,.4,-2.4]);switchHit.material.visible=false;switchHit.userData.power=true;powerTargets.push(switchHit);
  silk('OFF   ON',[-1.65,.14,-2.06],.85);
  const powerLED=cylinder(.1,.08,0x28443a,world,[-.95,.2,-2.4]);powerLeds.push(powerLED);
  box(.55,.12,.4,0x101715,world,[-3.2,.2,-1.8]);
  for(let i=0;i<6;i++){box(.16,.08,.08,0xbeb89f,world,[-4.95+i*.3,.2,-2.35]);box(.08,.07,.2,0xbdb693,world,[-3.15,.2,-1.2+i*.22]);}
  for(let i=0;i<4;i++)box(.035,.005,.6,0x526d52,world,[-.6+i*.14,.13,-2.15]);
  const battery=cylinder(.46,5.7,0x9d79c3,world,[-3.3,.6,.65]);battery.rotation.z=Math.PI/2;
  box(6.5,.18,1.2,0x151e1a,world,[-3.3,.16,.65]);
  for(const x of [-6.25,-.35])box(.18,.95,1.15,0x171e1b,world,[x,.6,.65]);
  for(const x of [-6.1,-.5]){const cap=cylinder(.34,.08,0xbfc3be,world,[x,.6,.65]);cap.rotation.z=Math.PI/2;}
  const coilPoints=Array.from({length:100},(_,i)=>new THREE.Vector3(-6.08+i*.002,.6+.25*Math.cos(i/99*Math.PI*8),.65+.25*Math.sin(i/99*Math.PI*8)));
  world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPoints),100,.025,6,false),new THREE.MeshStandardMaterial({color:0xc8c9bf,metalness:.8,roughness:.3})));
  silk('−',[-5.7,1.08,.65],.3);silk('+',[-.9,1.08,.65],.3);
  batteryOff=label('18650 · OFF',[-3.3,1.25,.8],2.5);
  batteryOn=label('18650 · ON',[-3.3,1.25,.8],2.5,'#147844');
  box(4.8,.3,.42,0x101715,world,[-3.3,.25,2.1]);
  box(4.4,1.6,.16,0x1f2727,world,[-3.3,1.05,2.1]);
  box(.58,.22,.36,0xc8d0d3,world,[-3.3,1.91,2.1]);
  box(.4,.025,.24,0x182629,world,[-3.3,2.03,2.1]);
  const microHit=box(.75,.4,.55,0xffffff,world,[-3.3,2,2.1]);microHit.material.visible=false;microHit.userData.usb='microbit';usbTargets.push(microHit);
  label('PC 연결 · 위쪽 USB',[-3.3,.3,3.3],3);
  usbCable=new THREE.Group();world.add(usbCable);
  box(.43,.46,.28,0x40546c,usbCable,[-3.3,2.25,2.1]);
  usbCable.add(tube(new THREE.Vector3(-3.3,2.48,2.1),new THREE.Vector3(-7.5,.25,3.6),0x40546c,1.5,.075));
  box(.65,.25,.45,0xaab7c5,usbCable,[-7.5,.25,3.6]);
  label('PC',[-7.5,.35,4.2],.8);
  for(let row=0;row<5;row++) for(let col=0;col<5;col++) {const led=box(.1,.1,.05,0x482424,world,[-3.7+col*.2,1.5-row*.2,2.21]);if((row===1&&(col===1||col===3))||(row===3&&col>0&&col<4))powerLeds.push(led);}
  box(.35,.35,.1,0xaaaaaa,world,[-4.8,1.1,2.25]);box(.35,.35,.1,0xaaaaaa,world,[-1.8,1.1,2.25]);
  label('micro:bit',[-3.3,.25,2.7],2);
  // HC-SR04: twin transducers and four accessible terminals.
  plate(3.5,1.8,[4,.1,-3.2],0x206d8c);
  for(const x of [3.05,4.95]) {
    cylinder(.62,.62,0xadb9bd,world,[x,.52,-3.35]);
    cylinder(.52,.04,0x151f24,world,[x,.84,-3.35]);
    ring(.56,.055,0xd6dcdc,[x,.88,-3.35]);
    cylinder(.23,.025,0x596367,world,[x,.87,-3.35]);
    // Fine grille across each recessed transducer face.
    for(let i=-6;i<=6;i++){const offset=i*.075,length=2*Math.sqrt(.49*.49-offset*offset);box(.012,.012,length,0x566365,world,[x+offset,.9,-3.35]);box(length,.012,.012,0x566365,world,[x,.905,-3.35+offset]);}
  }
  box(.45,.13,.22,0xc4bc9d,world,[4,.29,-3.85]);silk('4.000',[4,.365,-3.85],.4);
  silk('HC-SR04',[4,.235,-3.1],.7);silk('T',[2.65,.235,-2.65],.2);silk('R',[5.35,.235,-2.65],.2);
  for(let i=0;i<4;i++){box(.15,.06,.09,0xd8caa5,world,[3.65+i*.22,.26,-2.8]);}
  label('HC-SR04 · 초음파센서',[4,.6,-4.65],3.7);
  for(const [id,x] of [['v',2.95],['t',3.65],['e',4.35],['g',5.05]]) {pin('ultra.'+id,[x,.48,-2.3]);pinLabels.push(silk({v:'VCC',t:'Trig',e:'Echo',g:'GND'}[id],[x,.235,-2.65],.42));box(.075,.075,.35,0xc5b574,world,[x,.25,-2.1]);}
  // SG90 and its three-wire connector.
  box(1.5,1.25,1.2,0x3375c4,world,[4.5,.7,0]);
  cylinder(.35,.4,0x3566a5,world,[4.5,1.5,0]);
  box(1.6,.13,.22,0xe8ece5,world,[4.5,1.76,0]);
  label('SG90 · 서보모터',[4.5,.18,1.55],3);
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
  $('w3Power').setAttribute('aria-pressed',String(state.powered));
  $('w3Power').textContent=state.powered?'배터리 전원 끄기':'배터리 전원 켜기';
  $('w3PowerState').dataset.on=String(state.powered);
  $('w3PowerState').textContent=state.powered
    ? (state.verified?'전원 ON · 배선과 점검 완료. 가상 보드 표시등이 켜졌어요.':`전원 ON · ${state.conns.length}/10개 연결, 최종 점검 전입니다. 전원을 끄고 배선을 마무리하세요.`)
    :state.usbConnected?'배터리 OFF · USB 연결 중입니다. 배선을 바꾸려면 USB도 빼 주세요.':state.verified?'전원 OFF · 최종 확인 완료. 배선을 다시 바꾸려면 처음부터를 누르세요.':'전원 OFF · 선을 연결할 수 있어요. 보드의 스위치도 눌러 보세요.';
  const hints=state.hint===null?[]:[data.wires[state.hint].from,data.wires[state.hint].to];
  const wired=new Set(state.conns.flatMap(i=>[data.wires[i].from,data.wires[i].to]));
  for(const [id,{button,text,p,index}] of buttons) {
    text.textContent=(wired.has(id)?'✓ ':'')+(state.mode==='solo'?'핀 '+(index+1):p.label);
    button.disabled=state.verified||state.powered||state.usbConnected;button.setAttribute('aria-pressed',String(state.selected===id));button.dataset.hint=String(hints.includes(id));button.dataset.wired=String(wired.has(id));
  }
  if(!world) return;
  usbCable.visible=state.usbConnected;
  switchKnob.position.x=state.powered?-1.47:-1.83;
  batteryOn.visible=state.powered;batteryOff.visible=!state.powered;
  powerLeds.forEach((led,i)=>{const on=state.powered||(i>0&&state.usbConnected);led.material.color.set(on?(i===0?0x39e58c:0xf33c2a):(i===0?0x28443a:0x482424));led.material.emissive.set(on?(i===0?0x16aa55:0xe52a15):0x000000);led.material.emissiveIntensity=on?1.3:0;});
  pinLabels.forEach(label=>{label.visible=state.mode!=='solo';});
  for(const [id,{halo}] of pinViews) {
    halo.visible=!state.powered&&(state.selected===id||hints.includes(id)||wired.has(id));
    halo.material.color.set(state.selected===id?0x287fe0:wired.has(id)?0x299866:0xf0ae00);
  }
  const signature=state.conns.join(',');
  if(signature!==wireSignature) {
    disposeWires();
    state.conns.forEach(i=>{const w=data.wires[i];wireGroup.add(tube(positions.get(w.from),positions.get(w.to),w.color,1.4+i*.13));});
    wireSignature=signature;
  }
  updateAnnotations();requestDraw();
}
function updateAnnotations() {
  const focus=$('w3Focus').value;
  annotations.forEach(label=>{label.visible=(focus==='all'||label.userData.device===focus)&&(label!==batteryOn||state.powered)&&(label!==batteryOff||!state.powered);});
}
function frameScene(focus='all',top=false) {
  const target=focus==='all'?new THREE.Vector3(0,0,0):deviceCenters[focus];
  const distance=focus==='all'?Math.max(16,13/camera.aspect):focus==='board'?Math.max(12,12/camera.aspect):Math.max(7,5/camera.aspect);
  orbit.target.copy(target);
  camera.position.copy(target).add(top?new THREE.Vector3(0,distance,.01):new THREE.Vector3(distance*.3,distance*.85,distance*.8));
  orbit.update();updateAnnotations();requestDraw();
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
    if(!down||dragged){if(!pointers.size)down=null;return;}
    down=null;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...pinMeshes,...powerTargets,...usbTargets],false)[0];
    if(hit?.object.userData.usb)api.chooseUSB(hit.object.userData.usb);
    else if(hit?.object.userData.power)api.togglePower();
    else if(hit&&!state.verified&&!state.powered)api.activate(hit.object.userData.pin);
  });
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;dragged=true;});
  new ResizeObserver(()=>{if(active)resize();}).observe(host);
}
makeButtons();sync();
$('w3Power').addEventListener('click',()=>api.togglePower());
toggle.addEventListener('click',async()=>{
  if(failed)return;
  try {
    toggle.disabled=true;
    await document.fonts.load('44px "Jua"');
    if(!renderer)init();active=!active;panel.hidden=!active;photo.hidden=active;$('zoom').disabled=active;
    toggle.textContent=active?'사진으로 보기':'3D 작업대 열기';toggle.setAttribute('aria-pressed',String(active));controlsUI.forEach(el=>el.disabled=!active);
    $('w3Help').textContent=active?'핀 두 개를 차례로 눌러 연결해 보세요. 작은 핀은 부품을 확대하거나 아래 이름표로 선택할 수 있어요.':'사진 작업대로 돌아왔어요. 3D에서 연결한 선도 그대로입니다.';
    if(active){resize();sync();}else{cancelAnimationFrame(frame);frame=0;window.dispatchEvent(new Event('resize'));}
  }catch(error){console.warn('3D wiring unavailable',error);fail();}
  finally { if(!failed)toggle.disabled=false; }
});
$('w3Reset').addEventListener('click',()=>{$('w3Focus').value='all';frameScene();});
$('w3Top').addEventListener('click',()=>frameScene($('w3Focus').value,true));
$('w3Focus').addEventListener('change',e=>frameScene(e.target.value));
window.addEventListener('wiring-state',sync);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else{cancelAnimationFrame(frame);frame=0;}}).observe(host);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else requestDraw();});
