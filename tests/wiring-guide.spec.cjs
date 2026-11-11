const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const base=pathToFileURL(path.resolve(__dirname,'../wiring.html')).href;
const w3pin=(page,id)=>page.locator(`[data-w3-pin="${id}"]`);
// 선을 연결할 때마다 뜨는 「진짜로 꽂기」 팝업은 다음 동작 전에 닫음
test.beforeEach(async({page})=>{await page.addLocatorHandler(page.locator('#realDlg[open]'),async()=>{await page.locator('#realClose').click();});});

test('a centered popup shows where to plug the real wire after each screen connection, and X closes it',async({page})=>{
  await page.removeLocatorHandler(page.locator('#realDlg[open]'));
  await page.setViewportSize({width:1280,height:720});
  await page.route('https://**/*',r=>r.abort());await page.goto(base+'#step5');
  const dlg=page.locator('#realDlg');
  await expect(dlg).toBeHidden();
  await page.locator('#stage [data-pin="ultra.g"]').first().click();await page.locator('#stage [data-pin="ultraBoard.g"]').first().click();
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('이제 진짜 점퍼선을 꽂아요');
  await expect(page.locator('#realFrom')).toHaveText('① 초음파센서 GND');
  await expect(page.locator('#realTo')).toHaveText('② 확장보드 P14 열의 GND');
  await expect(page.locator('#realColor')).toContainText('검정');
  const box=await dlg.boundingBox();
  expect(Math.abs(box.x+box.width/2-640)).toBeLessThan(4);
  expect(Math.abs(box.y+box.height/2-360)).toBeLessThan(40);
  await page.locator('#realClose').click();
  await expect(dlg).toBeHidden();
  await page.locator('#stage [data-pin="ultra.v"]').first().click();await page.locator('#stage [data-pin="ultraBoard.v"]').first().click();
  await expect(page.locator('#realTo')).toHaveText('② 확장보드 P14 열의 3.3V');
  await page.locator('#realDone').click();
  await expect(dlg).toBeHidden();
});

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

test('step 5 fits the whole bench in one Surface Go landscape screen and says to copy each wire for real',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.route('https://**/*',r=>r.abort());await page.goto(base+'#step5');
  await expect(page.locator('#howto li')).toHaveCount(3);
  await expect(page.locator('#howto li.real')).toContainText('진짜 점퍼선을 똑같이 꽂아요');
  const stage=await page.locator('#stage').boundingBox();
  const status=await page.locator('#status').boundingBox();
  expect(stage.y+stage.height-status.y).toBeLessThan(720-75);   // 상태 줄부터 작업대 끝까지 한 화면(위 단계 막대 제외)
  const boxes=await page.locator('.device').evaluateAll(ds=>ds.map(d=>d.getBoundingClientRect().bottom));
  expect(Math.max(...boxes)).toBeLessThanOrEqual(stage.y+stage.height+1);
  await page.locator('[data-pin="ultra.g"]').first().click();await page.locator('[data-pin="ultraBoard.g"]').first().click();
  await expect(page.locator('#msg')).toContainText('진짜 점퍼선을 똑같이 꽂아요');
  await expect(page.locator('#nextCard')).toContainText('2 / 10');
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
