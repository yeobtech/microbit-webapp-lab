// 원본 페이지로 나눠줄 한 파일 페이지를 만든다.
//   source.html        → index.html   (1·2단계)
//   wiring-source.html → wiring.html  (배선 연습)
//   practice-source.html → practice.html (3단계 활동지 실습)
// - FIRMWARE 표시가 있으면 makecode/공통-makecode.ts 내용을 그 사이에 넣는다.
// - PROMPT 표시가 있으면 prompt/프롬프트_기본HTML없음.md의 [A] 항목, [B] 규칙, 작성 예시를 넣는다.
// - LESSON:CSS / LESSON:JS 표시 자리에 tools/lesson.css, tools/lesson.js(수업 페이지 공통 디자인)를 넣는다.
// - images/ 그림을 data: 주소로 바꿔 페이지 안에 넣는다. (파일 하나만 옮겨도, 미리보기에서도 그림이 보이게)
// 사용: node tools/build.mjs   (원본 페이지, 그림, 공통 코드를 고친 뒤 다시 실행)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const firmwarePath = path.join(root, 'makecode', '공통-makecode.ts');
const promptPath = path.join(root, 'prompt', '프롬프트_기본HTML없음.md');
const MIME = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'};
const PAGES = [['source.html', 'index.html'], ['wiring-source.html', 'wiring.html'], ['practice-source.html', 'practice.html']];

const used = new Set();

function embedFirmware(page) {
  const start = page.indexOf('<!-- FIRMWARE:START');
  if (start < 0) return page;
  const end = page.indexOf('<!-- FIRMWARE:END -->');
  if (end < 0) throw new Error('FIRMWARE:END 표시를 찾지 못했습니다.');
  const code = fs.readFileSync(firmwarePath, 'utf8').replace(/\r\n/g, '\n');
  if (/<\/script/i.test(code)) throw new Error('공통 코드에 </script 문자열이 있어 넣을 수 없습니다.');
  return page.slice(0, page.indexOf('-->', start) + 3) + '\n<script id="firmware" type="text/plain">\n' + code + '</script>\n' + page.slice(end);
}

// 프롬프트 문서를 나눠 페이지가 쓸 자료로 만든다
function readPrompt() {
  const md = fs.readFileSync(promptPath, 'utf8').replace(/\r\n/g, '\n');
  const section = title => {
    const i = md.indexOf('\n## ' + title);
    if (i < 0) throw new Error('프롬프트 문서에서 「## ' + title + '」 제목을 찾지 못했습니다.');
    const body = md.slice(md.indexOf('\n', i + 1) + 1);
    const end = body.search(/\n---\s*\n|\n## /);
    return (end < 0 ? body : body.slice(0, end)).trim();
  };
  const A = section('[A]'), B = section('[B]'), ex = section('작성 예시');
  const line = /^([①-⑧]) ([^:]+):\s*(.*)$/;
  const fields = A.split('\n').map(l => l.match(line)).filter(Boolean).map(m => ({n: m[1], label: m[2].trim(), hint: m[3].replace(/^\((.*)\)$/, '$1').trim()}));
  const examples = Object.fromEntries(ex.split('\n').map(l => l.match(line)).filter(Boolean).map(m => [m[1], m[3].trim()]));
  fields.forEach(f => { f.example = examples[f.n] || ''; });
  const intro = A.split('\n').find(l => l.trim() && !line.test(l));
  if (fields.length !== 8 || !intro || !B.startsWith('[')) throw new Error('프롬프트 문서 형식이 예상과 다릅니다 (①~⑧ 항목 ' + fields.length + '개).');
  return {intro: intro.trim(), fields, rules: B};
}

function embedPrompt(page) {
  const start = page.indexOf('<!-- PROMPT:START');
  if (start < 0) return page;
  const end = page.indexOf('<!-- PROMPT:END -->');
  if (end < 0) throw new Error('PROMPT:END 표시를 찾지 못했습니다.');
  const json = JSON.stringify(readPrompt()).replace(/</g, '\u003c');
  return page.slice(0, page.indexOf('-->', start) + 3) + '\n<script id="promptData" type="application/json">' + json + '</script>\n' + page.slice(end);
}

function embedLesson(page) {
  if (!page.includes('<!-- LESSON:CSS -->')) return page;
  const css = fs.readFileSync(path.join(root, 'tools', 'lesson.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'tools', 'lesson.js'), 'utf8');
  const font = '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">';
  return page.replace('<!-- LESSON:CSS -->', () => (page.includes('pretendardvariable') ? '' : font + '\n') + '<style>\n' + css + '</style>')
             .replace('<!-- LESSON:JS -->', () => '<script>\n' + js + '</script>');
}

// 그림을 data: 주소로 바꿔 페이지 안에 넣는다.
// 한 번만 쓰는 그림은 그 자리에 바로 넣고, 여러 번 쓰는 그림은 페이지 앞쪽의 window.__IMG에 한 번만 넣어 돌려 쓴다.
//   - 스크립트 안의 'images/x.webp' → __IMG["x.webp"]
//   - 태그 속성 src="images/x.webp" → 빈 값 + data-img, 페이지 스크립트보다 먼저 도는 작은 스크립트가 채운다.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function dataUri(name) {
  const file = path.join(root, 'images', name);
  const mime = MIME[path.extname(name).toLowerCase()];
  if (!fs.existsSync(file) || !mime) throw new Error('그림을 찾지 못했습니다: images/' + name);
  used.add(name);
  return `data:${mime};base64,` + fs.readFileSync(file).toString('base64');
}
function inlineImages(page) {
  const RE = /(["'])images\/([\w.-]+)\1/g;
  const count = {};
  for (const m of page.matchAll(RE)) count[m[2]] = (count[m[2]] || 0) + 1;
  const shared = Object.keys(count).filter(n => count[n] > 1);
  // 실행되는 <script> 구간 (type이 json·text/plain인 자료 상자는 제외)
  const scripts = [...page.matchAll(/<script(?![^>]*type="(?:application\/json|text\/plain)")[^>]*>[\s\S]*?<\/script>/g)].map(m => [m.index, m.index + m[0].length]);
  const inScript = i => scripts.some(([a, b]) => i > a && i < b);
  let out = page.replace(RE, (m, q, name, offset, whole) => {
    if (!shared.includes(name)) return q + dataUri(name) + q;
    if (inScript(offset)) {
      const ref = `__IMG[${JSON.stringify(name)}]`;
      // 객체의 키 자리({ 'images/x': … })에서는 계산된 키 [__IMG["x"]]로 쓴다
      const isKey = /[{,]\s*$/.test(whole.slice(Math.max(0, offset - 20), offset)) && /^\s*:/.test(whole.slice(offset + m.length));
      return isKey ? `[${ref}]` : ref;
    }
    const attr = whole.slice(Math.max(0, offset - 40), offset).match(/\s([\w-]+)=$/);
    if (!attr) throw new Error('여러 번 쓰는 그림이 스크립트·속성이 아닌 곳에 있습니다: ' + name);
    return q + (attr[1] === 'src' ? BLANK : '') + q + ` data-img=${q}${name}${q} data-img-attr=${q}${attr[1]}${q}`;
  });
  if (shared.length) {
    const table = '<script>window.__IMG = {' + shared.map(n => `${JSON.stringify(n)}: "${dataUri(n)}"`).join(',\n') + '};</script>\n';
    const fill = '<script>document.querySelectorAll("[data-img]").forEach(function (el) { el.setAttribute(el.dataset.imgAttr, window.__IMG[el.dataset.img]); });</script>\n';
    out = out.replace(/<body[^>]*>\n?/, m => m + table);
    const first = out.search(/<script(?![^>]*type="(?:application\/json|text\/plain)")[^>]*>(?!window\.__IMG)/);
    if (first < 0) throw new Error('그림을 채울 스크립트 자리를 찾지 못했습니다.');
    out = out.slice(0, first) + fill + out.slice(first);
  }
  if (/images\//.test(out.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('data: 주소로 바꾸지 못한 images/ 경로가 남아 있습니다.');
  return out;
}

for (const [src, dst] of PAGES) {
  const page = inlineImages(embedLesson(embedPrompt(embedFirmware(fs.readFileSync(path.join(root, src), 'utf8')))));
  fs.writeFileSync(path.join(root, dst), page);
  console.log(`${dst} 완성: ${(page.length / 1024).toFixed(0)}KB`);
}
const unused = fs.readdirSync(path.join(root, 'images')).filter(n => !used.has(n));
console.log(`그림 ${used.size}개 사용` + (unused.length ? ` · 쓰지 않는 그림: ${unused.join(', ')}` : ''));
