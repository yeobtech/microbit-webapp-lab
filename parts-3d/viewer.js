import {pins,notes,pinDescription} from './pins.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {catalog,createPart} from './parts.js';
const stage=document.querySelector('#stage'),grid=document.querySelector('#grid');
let renderer,controls,active,span;const camera=new T.PerspectiveCamera(32,1,.0001,2),scene=new T.Scene();
scene.background=new T.Color(0xe7ece8);
scene.add(new T.HemisphereLight(0xffffff,0xbbc5be,2));
for(const [x,y,z,intensity] of [[2,4,3,2],[-2,2,-2,1.7]]){const light=new T.DirectionalLight(0xffffff,intensity);light.position.set(x,y,z);scene.add(light)}
try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});stage.append(renderer.domElement);renderer.setPixelRatio(Math.min(devicePixelRatio,2));controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.addEventListener('change',draw)}catch{stage.innerHTML='<img alt="부품 미리보기" style="width:100%;height:100%;object-fit:contain">';document.querySelector('#reset').disabled=true}
function draw(){if(renderer)renderer.render(scene,camera)}
function reset(){
 if(!active||!renderer)return;
 const size=new T.Box3().setFromObject(active).getBoundingSphere(new T.Sphere());span=size.radius;
 camera.aspect=stage.clientWidth/stage.clientHeight;
 const d=span*1.09/Math.sin(Math.atan(Math.tan(16*Math.PI/180)*Math.min(1,camera.aspect)));
 controls.target.copy(size.center);camera.position.set(.46,1.28,1.08).normalize().multiplyScalar(d).add(size.center);
 controls.minDistance=span*.8;controls.maxDistance=span*8;camera.updateProjectionMatrix();controls.update();draw();
}
function select(item){
 const [id,title,type,desc]=item;
 if(active){scene.remove(active);const mats=new Set();active.traverse(m=>{if(m.isMesh){m.geometry.dispose();mats.add(m.material)}});mats.forEach(m=>{m.map?.dispose();m.dispose()})}
 active=createPart(id);scene.add(active);document.querySelector('#title').textContent=title;document.querySelector('#type').textContent=type;document.querySelector('#desc').textContent=desc;
 const list=document.querySelector('#pins');list.replaceChildren();
 for(const p of pins[id]){const li=document.createElement('li'),b=document.createElement('b');b.dataset.role=p.role;b.textContent=p.label;li.append(b,' '+pinDescription(p));list.append(li)}
 document.querySelector('#pinNote').textContent=notes[id]||'';
 document.querySelector('#download').href='./models/'+id+'.glb';for(const b of grid.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.id===id));
 if(!renderer)stage.querySelector('img').src='./previews/'+id+'.png';reset();
}
for(const [i,item] of catalog.entries()){
 if(i===0||i===1||i===10){const h=document.createElement('h3');h.textContent=i===0?'메인보드':i===1?'센서 · 입력 부품':'출력 부품';grid.append(h)}
 const b=document.createElement('button');b.dataset.id=item[0];const img=document.createElement('img');img.src='./previews/'+item[0]+'.png';img.alt='';const name=document.createElement('span');name.textContent=item[1];b.append(img,name);grid.append(b);b.onclick=()=>select(item);
}
document.querySelector('#reset').onclick=reset;
new ResizeObserver(()=>{if(renderer){renderer.setSize(stage.clientWidth,stage.clientHeight,false);reset()}}).observe(stage);
select(catalog[0]);
