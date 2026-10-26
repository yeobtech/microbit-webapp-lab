const {test,expect} = require('@playwright/test');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href;
async function open(page) {
  await page.route('https://**/*',route=>route.abort()); // Distributed HTML must work offline.
  await page.goto(url);
  await page.locator('.cv-start').click();
  await page.locator('#lantern3d').scrollIntoViewIfNeeded();
}
async function slider(page,id,value) {
  await page.locator(id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
}
test('offline 3D, sensor rules, view controls and 2D preserve state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  await page.locator('#lantern3d').click();
  await expect(page.locator('#lanternViewport canvas')).toBeVisible();
  await slider(page,'#inBright',49);
  await expect(page.locator('#demoServo')).toHaveText('90°');
  await slider(page,'#inBright',65);
  await expect(page.locator('#demoServo')).toHaveText('90°');
  await page.locator('#lanternInside').click();
  await expect(page.locator('#lanternInside')).toHaveAttribute('aria-pressed','true');
  await page.locator('#lanternTurn').click();
  await page.locator('#lanternReset').click();
  await slider(page,'#inBright',20);
  await slider(page,'#inShake',700);
  await expect(page.locator('#demoLog')).toContainText('T');
  await slider(page,'#inShake',0);
  await page.locator('#inBtnA').focus();
  await page.keyboard.down('Space');
  await expect(page.locator('#demoMsg')).toHaveText('경고!');
  expect(await page.evaluate(()=>window.getLanternState().pixels)).toEqual(Array(6).fill([255,0,0]));
  await page.keyboard.up('Space');
  await expect(page.locator('#demoMsg')).toHaveText('안전하게 걸어요');
  await page.locator('#lantern3d').click();
  await expect(page.locator('.lantern-scene svg')).toBeVisible();
  await slider(page,'#inBright',81);
  await expect(page.locator('#demoServo')).toHaveText('0°');
  await page.locator('#inBtnA').focus();
  await page.keyboard.down('Space');
  await expect(page.locator('#demoServo')).toHaveText('90°');
  await page.keyboard.up('Space');
  await expect(page.locator('#demoServo')).toHaveText('0°');
  await page.locator('#lantern3d').click();
  await slider(page,'#inBright',20);
  await page.locator('#lanternViewport').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.locator('.demo').screenshot({path:'test-results/lantern-desktop.png'});
  expect(errors).toEqual([]);
});
test('mobile layout, reduced motion, touch-friendly rotation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page);await page.locator('#lantern3d').click();
  await page.locator('#lanternTurn').click();
  await slider(page,'#inBright',20);
  await expect(page.locator('#lanternViewport canvas')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.waitForTimeout(800);
  await page.locator('.lantern-scene').screenshot({path:'test-results/lantern-mobile.png'});
});
test('WebGL failure leaves working flat simulator',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};});
  await open(page);await page.locator('#lantern3d').click();
  await expect(page.locator('#lanternHint')).toContainText('그림을 유지');
  await expect(page.locator('.lantern-scene svg')).toBeVisible();
  await slider(page,'#inBright',20);
  await expect(page.locator('#demoServo')).toHaveText('90°');
});
