const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const base=pathToFileURL(path.resolve(__dirname,'../wiring.html')).href;
const w3pin=(page,id)=>page.locator(`[data-w3-pin="${id}"]`);

test('step 2 compares correct and reversed micro:bit insertion with a check quiz',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());await page.goto(base+'#step2');
  await expect(page.locator('.orient figure.ok')).toContainText('바른 방향');
  await expect(page.locator('.orient figure.no')).toContainText('거꾸로');
  await expect(page.locator('.checks3').first()).toContainText('USB 단자가 맨 위');
  const quiz=page.locator('[data-quiz="orient"]');
  await quiz.getByRole('button',{name:'작은 부품과 글씨가 있는 뒷면'}).click();
  await expect(quiz.locator('.feedback')).toBeVisible();
  await quiz.getByRole('button',{name:'LED 25개와 A·B 버튼이 있는 앞면'}).click();
  await expect(quiz.locator('.feedback')).toContainText('거꾸로');
  expect(errors).toEqual([]);
});

test('step 4 explains G·V·S roles and maps every part pin to a board row',async({page})=>{
  await page.route('https://**/*',r=>r.abort());await page.goto(base+'#step4');
  await expect(page.locator('#gvs article')).toHaveCount(3);
  await expect(page.locator('#gvs')).toContainText('접지');
  await expect(page.locator('.gvs-rule')).toContainText('G는 G, V는 V, S는 S');
  await expect(page.locator('.gvs-map tbody tr')).toHaveCount(3);
  await expect(page.locator('.gvs-map')).toContainText('Trig → P14, Echo → P13');
  await expect(page.locator('.gvs-warn')).toContainText('G와 V를 바꿔 꽂지 않아요');
});

test('step 5 names the next two pins in text and in 3D, and advances after each wire',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());await page.goto(base+'#step5');
  const card=page.locator('#nextCard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 / 10');
  await expect(card).toContainText('① 초음파센서 GND');
  await expect(card).toContainText('② 확장보드 P14 열의 GND');
  await expect(page.locator('#w3Toggle')).toHaveText('3D로 확인하기');
  await page.locator('#w3Toggle').click();
  await expect(page.locator('#w3Viewport canvas')).toBeVisible();
  await expect(page.locator('#w3Next')).toBeEnabled();
  await page.locator('#w3Next').click();
  await w3pin(page,'ultra.g').click();await w3pin(page,'ultraBoard.g').click();
  await expect(card).toContainText('2 / 10');
  await expect(card).toContainText('① 초음파센서 VCC');
  await page.locator('[data-mode="solo"]').click();
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});
