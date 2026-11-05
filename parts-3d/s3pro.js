import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Approximate exterior from the supplied photograph.
// Pin markings cross-checked against the manufacturer's KS5034 pin-out.
export function createS3Pro(){
 const board=new T.Group();board.name='Keyestudio S3 Pro';
 const yellow=0xe9ba35, red=0xb92d36, black=0x20282b, silver=0xc5ced0;
 const materials=new Map();
 function mesh(geometry,color,x,y,z){
  if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.43,metalness:color===silver?.7:.1}));
  const m=new T.Mesh(geometry,materials.get(color));m.position.set(x,y,z);board.add(m);return m;
 }
 function box(x,y,z,w,h,d,c,r=0){return mesh(r?new RoundedBoxGeometry(w,h,d,2,r):new T.BoxGeometry(w,h,d),c,x,y,z)}
 function cylinder(x,y,z,r,h,c){return mesh(new T.CylinderGeometry(r,r,h,28),c,x,y,z)}
 function text(label,x,z,w,h=1.5,y=1.66,color='#d4c677'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
  const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,40,500);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x,y,z);board.add(m);m.name=label;
 }
 const outline=new T.Shape([[-34.5,-27],[31,-27],[34.5,-23],[34.5,23],[31,27],[-34.5,27]].map(([x,z])=>new T.Vector2(x,-z)));outline.closePath();
 for(const [x,z] of [[-19,-24],[31,-13],[31,21],[-19,24]]){
  const hole=new T.Path();hole.absarc(x,-z,1.65,0,Math.PI*2,true);outline.holes.push(hole);
  const ring=mesh(new T.RingGeometry(1.65,2.1,32),silver,x,1.62,z);ring.rotation.x=-Math.PI/2;
 }
 const geometry=new T.ExtrudeGeometry(outline,{depth:1.6,bevelEnabled:false});geometry.rotateX(-Math.PI/2);mesh(geometry,0x171f22,0,0,0);
 function socket(x,z,labels,alongZ=false){
  const length=labels.length*2.54;
  box(x,5,z,alongZ?2.7:length,6.8,alongZ?length:2.7,yellow,.3);
  labels.forEach((label,i)=>{
   const d=(i-(labels.length-1)/2)*2.54;
   const px=x+(alongZ?0:d),pz=z+(alongZ?d:0);
   box(px,8.43,pz,1.25,.1,1.25,0x5c451c);
   box(px,8.5,pz,.68,.11,.68,black);
   if(label)text(label,px,pz+(alongZ?0:2.8),2.35,.95,alongZ?8.55:1.67);
  });
 }
 function pin(x,z,c){
  box(x,2.8,z,2.45,2.4,2.45,c,.15);box(x,5,z,.62,5.1,.62,silver);
  box(x,-.65,z,.62,1.4,.62,silver);
 }
 // Arduino-shaped outer female sockets, in the orientation of the photograph.
 socket(-5.5,-24,['SCL','SDA','V','G','12','13','11','10','48','47']);
 socket(20.1,-24,['42','41','40','38','21','20','TX','RX']);
 socket(3.5,24,['NC','V','RST','3V3','V','G','G','VIN']);
 socket(23,24,['2','3','14','19','SDA','SCL']);
 socket(22,-7,['G','V','20','21','38','40','41','42']);
 const digital=[12,13,11,10,48,47,42,41,40,38,21,20];
 digital.forEach((number,i)=>{
  const x=-8+i*2.54+(i>=6?1.7:0);
  [-17,-14.46,-11.92].forEach((z,j)=>pin(x,z,[yellow,red,black][j]));
  text(String(number),x,-19.1,2.1,1.1);
 });
 ['S','V','G'].forEach((label,i)=>text(label,-11.1,-17+i*2.54,1.4,1.5));
 socket(29.4,-14.5,['','',''],true);
 [-17,-14.46,-11.92].forEach(z=>pin(32.5,z,0x256f9c));
 // I2C repeats SCL, SDA, V and G across three columns.
 [white(),yellow,red,black].forEach((color,row)=>{
  for(let col=0;col<3;col++)pin(-9+col*2.54,1+row*2.54,color);
 });
 function white(){return 0xe4e0cf}
 text('I2C BUS',-5.5,-1.4,10,1.7);
 socket(.2,4.8,['','','',''],true);
 ['SCL','SDA','V','G'].forEach((name,i)=>text(name,3.2,1+i*2.54,2.8,1.05));
 [19,14,3,2].forEach((number,i)=>{
  const z=13+i*2.54;[black,red,yellow].forEach((c,j)=>pin(-9+j*2.54,z,c));
  text(String(number),-.8,z,2.3,1.2);
 });
 text('G 3V3 S',-6.5,22,7.5,1.1);
 // Side expansion rows, blue in the supplied board.
 for(const [start,labels] of [[.5,['G','3V3','6','4','5']],[14,['G','3V3','15','16','7']]]){
  labels.forEach((label,i)=>{pin(-15,start+i*1.9,0x246c9b);text(label,-18,start+i*1.9,2.4,1)});
 }
 // ESP32-S3-WROOM module and antenna.
 box(22,2.3,8.4,19.5,1.3,23,0x31413c,.3);
 box(19.5,3.35,7.6,17.5,1.4,18.5,silver,.5);
 box(31.1,3.05,8.3,5.5,1.2,22,black);
 for(let z=-1;z<17;z+=1.35){
  box(9.2,2.4,z,1.1,.65,.6,silver);box(29.3,2.4,z,1.1,.65,.6,silver);
 }
 text('ESP32-S3',19.5,6.5,14,2,4.08,'#687476');
 text('WROOM-1',19.5,10,11,1.4,4.08,'#687476');
 text('keyestudio S3 Pro',19,-9.4,24,1.8);
 // Both USB-C openings face the left edge.
 for(const z of [-15,-3.5]){
  box(-32.5,3.4,z,8,3.6,8,silver,.7);box(-36.55,3.4,z,.12,2.5,6.7,black,.75);
  box(-36.65,3.35,z,.15,.65,4.5,0x59606b);
 }
 text('USB PROG',-29,-20.7,10,1.3);text('OTG',-30,-8.8,5,1.3);
 for(const [x,label] of [[-31,'RESET'],[-26,'BOOT']]){
  box(x,2.5,-23,3.8,1.8,4,silver,.3);cylinder(x,3.9,-23,1.4,1.2,0xd8d9ce);text(label,x,-26.2,4,1.1);
 }
 // DC barrel connector, with visible hollow socket.
 box(-31,5.3,17,10,7.4,9,yellow,.8);
 cylinder(-36.2,5.4,17,3.8,2,black).rotation.z=Math.PI/2;
 cylinder(-37.25,5.4,17,2.8,.2,0x080c0e).rotation.z=Math.PI/2;
 cylinder(-37.45,5.4,17,.65,1,silver).rotation.z=Math.PI/2;
 text('DC 7-12V',-29,23,10,1.4);
 // Regulator, USB bridge, capacitors, RGB LED and small SMD components.
 box(-25,2.6,-14.5,4,2,9,black,.3);
 for(let i=0;i<8;i++)for(const x of [-27.5,-22.5])box(x,2.3,-18+i,.9,.6,.45,silver);
 box(-25,3,2,5.7,3,5.7,0x606870,.4);text('4R7',-25,2,4,2,4.55);
 box(-24,2.6,8,5,2,3.4,black);text('R02',-24,8,4,1.6,3.65);
 for(const x of [-20.5,-17.5]){cylinder(x,3.4,2.2,1.25,3.6,silver);box(x,5.25,2.2,1.5,.1,.4,black)}
 box(-18.5,2.4,-4,2,1.6,2,0xf3efda,.2);text('IO45',-18,-6.2,3,1);
 for(let i=0;i<8;i++){
  const z=-8+i*2.7;box(-29.5,2,z,2.4,.8,.85,i%2?0x9a8654:black);
  for(const x of [-30.5,-28.5])box(x,2.1,z,.5,.9,.9,silver);
 }
 box(-20,3.1,18,4.8,3,4.5,black);text('V=5V',-19,24.7,6,1.2);
 // Underside SD-card cage and solder pads.
 box(26,-1.3,-16,10,2.4,10,silver,.35);box(26,-2.55,-12,7.8,.15,3,black);
 for(const x of [-9,-6.46,-3.92])for(let z=0;z<=20;z+=2.54)cylinder(x,-.3,z,.8,.5,silver);
 board.userData.reference='https://docs.keyestudio.com/projects/KS5034/en/latest/docs/KS5034%20Keyestudio%20ESP32%20S3%20PRO%20Development%20Board.html';
 return board;
}

