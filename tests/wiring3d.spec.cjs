const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../wiring.html')).href+'#step5';
async function open(page){await page.route('https://**/*',r=>r.abort());await page.goto(url);await page.locator('#w3Toggle').click();}
const pin=(page,id)=>page.locator(`[data-w3-pin="${id}"]`);
test('3D shares wrong-pair feedback, all ten wires, removal and verification with photos',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await expect(page.locator('#w3Viewport canvas')).toBeVisible();
  await pin(page,'ultra.g').click();await pin(page,'ultraBoard.v').click();
  await expect(page.locator('#status')).toHaveAttribute('data-tone','error');
  expect(await page.evaluate(()=>wiringLab.getState().conns.length)).toBe(0);
  await pin(page,'ultraBoard.g').click();
  await expect(page.locator('#conns li')).toHaveCount(1);
  await page.locator('#w3Toggle').click();
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('#stage [data-pin="ultra.g"]').first()).toHaveClass(/wired/);
  await page.locator('#w3Toggle').click();
  await page.locator('#conns button').first().click();
  await expect(page.locator('#conns li')).toHaveCount(0);
  const wires=await page.evaluate(()=>wiringLab.getScene().wires);
  for(const w of wires){await pin(page,w.from).click();await pin(page,w.to).click();}
  await expect(page.locator('#conns li')).toHaveCount(10);
  await expect(page.locator('#verifyBtn')).toBeDisabled();
  for(const c of await page.locator('#preflight input').all())await c.check();
  await expect(page.locator('#verifyBtn')).toBeDisabled();
  await page.locator('#usbBoard').click();
  await expect(page.locator('#usbStatus')).toContainText('충전용');
  expect(await page.evaluate(()=>wiringLab.getState().usbConnected)).toBe(false);
  await page.locator('#usbMicrobit').click();
  await expect(page.locator('#usbStatus')).toContainText('USB 연결 완료');
  await page.locator('#verifyBtn').click();
  await expect(pin(page,'neo.s')).toBeDisabled();
  await page.locator('#w3Top').click();
  await page.locator('#w3Viewport').screenshot({path:'test-results/wiring3d-complete.png'});
  await page.locator('#resetBtn').click();
  await expect(page.locator('#conns li')).toHaveCount(0);
  await page.locator('[data-mode="solo"]').click();
  await expect(pin(page,'neo.s')).toHaveText('핀 3');
  await page.locator('#w3Reset').click();
  await page.locator('#w3Viewport').screenshot({path:'test-results/wiring3d-desktop.png'});
  expect(errors).toEqual([]);
});
test('mobile focus and view controls fit viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page);
  await page.locator('#w3Focus').selectOption('board');await page.locator('#w3Top').click();
  await pin(page,'servo.g').click();await pin(page,'servoBoard.g').click();
  await expect(page.locator('#conns li')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#w3Viewport').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-160));
  await page.locator('#w3Viewport').screenshot({path:'test-results/wiring3d-mobile.png'});
});
test('pins can be selected on the 3D canvas and dragging does not connect',async({page})=>{
  await open(page);await page.locator('#w3Top').click();
  const canvas=page.locator('#w3Viewport canvas');
  await canvas.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-150));
  let rect=await canvas.boundingBox();
  // Top camera at y=16, FOV 45 degrees. Socket positions come from the model's design.
  const project=(x,y,z)=>{const scale=rect.height/(2*(16-y)*Math.tan(Math.PI/8));return {x:rect.x+rect.width/2+x*scale,y:rect.y+rect.height/2+z*scale};};
  const first=project(5.05,.48,-2.3);
  await page.mouse.click(first.x,first.y);
  await expect(pin(page,'ultra.g')).toHaveAttribute('aria-pressed','true');
  rect=await canvas.boundingBox();
  const second=project(-4.02,.5,-1.8);
  await page.mouse.click(second.x,second.y);
  await expect(page.locator('#conns li')).toHaveCount(1);
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+50,rect.y+rect.height/2+20,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>wiringLab.getState().selected)).toBe(null);
});
test('unsupported WebGL preserves photo wiring',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};});
  await open(page);await expect(page.locator('#stage')).toBeVisible();await expect(page.locator('#w3Help')).toContainText('사진 작업대를 유지');
  await page.locator('#stage [data-pin="ultra.g"]').last().click();await page.locator('#stage [data-pin="ultraBoard.g"]').last().click();
  await expect(page.locator('#conns li')).toHaveCount(1);
});
test('battery switch locks editing, survives view changes, and resets safely',async({page})=>{
  await open(page);
  await pin(page,'ultra.g').click();await pin(page,'ultraBoard.g').click();
  await page.locator('#w3Power').click();
  await expect(page.locator('#w3Power')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#w3PowerState')).toContainText('1/10개');
  await expect(pin(page,'neo.g')).toBeDisabled();
  await expect(page.locator('#undoBtn')).toBeDisabled();
  await page.locator('#w3Toggle').click();
  await expect(page.locator('#stage [data-pin="ultra.g"]').first()).toBeDisabled();
  await page.locator('#w3Power').click();
  await expect(page.locator('#stage [data-pin="ultra.g"]').first()).toBeEnabled();
  await page.locator('#w3Toggle').click();
  const wires=await page.evaluate(()=>wiringLab.getScene().wires);
  for(const w of wires.slice(1)){await pin(page,w.from).click();await pin(page,w.to).click();}
  for(const c of await page.locator('#preflight input').all())await c.check();
  await page.locator('#usbMicrobit').click();
  await page.locator('#verifyBtn').click();
  await page.locator('#w3Power').click();
  await expect(page.locator('#w3PowerState')).toContainText('배선과 점검 완료');
  await page.locator('#w3Focus').selectOption('board');
  await page.locator('#w3Viewport').screenshot({path:'test-results/realistic-board-on.png'});
  await page.locator('#resetBtn').click();
  await expect(page.locator('#w3Power')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#conns li')).toHaveCount(0);
  await page.locator('#w3Focus').selectOption('ultra');
  await page.locator('#w3Viewport').screenshot({path:'test-results/realistic-ultrasonic.png'});
});
test('3D board switch itself toggles battery power',async({page})=>{
  await open(page);await page.locator('#w3Top').click();
  const canvas=page.locator('#w3Viewport canvas');
  await canvas.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-150));
  for(const expected of ['true','false']) {
    const rect=await canvas.boundingBox();const scale=rect.height/(2*(16-.4)*Math.tan(Math.PI/8));
    await page.mouse.click(rect.x+rect.width/2-1.65*scale,rect.y+rect.height/2-2.4*scale);
    await expect(page.locator('#w3Power')).toHaveAttribute('aria-pressed',expected);
  }
});
test('USB ports reject charging port and connect only after wiring checks; unplug unlocks',async({page})=>{
  await open(page);await page.locator('#w3Top').click();
  const canvas=page.locator('#w3Viewport canvas');
  async function clickPort(x,y,z) {
    await canvas.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-150));
    const rect=await canvas.boundingBox(),scale=rect.height/(2*(16-y)*Math.tan(Math.PI/8));
    await page.mouse.click(rect.x+rect.width/2+x*scale,rect.y+rect.height/2+z*scale);
  }
  await clickPort(-2.7,.3,-2.45);
  await expect(page.locator('#usbStatus')).toContainText('충전용');
  await clickPort(-3.3,2,2.1);
  await expect(page.locator('#usbStatus')).toContainText('점퍼선 10개');
  for(const w of await page.evaluate(()=>wiringLab.getScene().wires)){await pin(page,w.from).click();await pin(page,w.to).click();}
  for(const c of await page.locator('#preflight input').all())await c.check();
  await clickPort(-3.3,2,2.1);
  await expect(page.locator('#usbStatus')).toContainText('USB 연결 완료');
  await expect(pin(page,'neo.g')).toBeDisabled();
  await expect(page.locator('#verifyBtn')).toBeEnabled();
  await canvas.screenshot({path:'test-results/usb-correct-port.png'});
  await page.locator('#w3Toggle').click();
  expect(await page.evaluate(()=>wiringLab.getState().usbConnected)).toBe(true);
  await page.locator('#usbDisconnect').click();
  await expect(page.locator('#verifyBtn')).toBeDisabled();
  await expect(page.locator('#stage [data-pin="neo.g"]').last()).toBeEnabled();
});
