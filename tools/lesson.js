/* 수업 페이지 공통: 구역의 제목·설명·내용이 화면에 들어올 때 차례로 나타납니다. 스크립트가 없으면 처음부터 다 보입니다. */
(function () {
  document.documentElement.classList.add('js');
  const groups = document.querySelectorAll('.stage-head, .head, .card, .quiz, .tip, .stepnav, .next');
  groups.forEach(g => {
    const kids = g.matches('.card') ? g.querySelectorAll(':scope > .card-head, :scope > .sec-head, :scope > .lead, :scope > *:not(.card-head):not(.sec-head):not(.lead)') : [g];
    [...kids].slice(0, 6).forEach((el, i) => { el.setAttribute('data-in', ''); el.style.setProperty('--i', i); });
  });
  const els = document.querySelectorAll('[data-in]');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const t = e.target; io.unobserve(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-in')));
  }), {threshold: 0.08});
  els.forEach(el => io.observe(el));
})();

/* 효과음: 소리 파일 없이 브라우저가 직접 만듭니다.
   start 촤락(종이 넘김) · page 딸깍(단계 이동) · tap 톡(버튼) · ok 띠리링(정답·완료)
   브라우저는 첫 클릭 전에는 소리를 막기 때문에, 소리는 클릭할 때부터 납니다. */
window.Sound = (function () {
  const KEY = 'connectlab-sound';
  let on = true, ctx = null, master = null, noise = null, lastSpecial = 0;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch {}
  function audio() {
    if (!on) return null;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }
  // 걸러 낸 잡음 한 덩어리 (종이·딸깍 소리의 재료)
  function hiss(t, dur, type, f1, f2, vol, q = 0.9) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  // 짧은 음 하나 (톡·띠리링의 재료)
  function tone(t, freq, dur, vol, type = 'sine', glideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const S = {
    start() {           // 촤락: 높은 '촤'에서 낮은 '락'으로 쓸려 내려가는 종이 소리 세 겹
      if (!audio()) return; lastSpecial = performance.now(); const t = ctx.currentTime;
      hiss(t, 0.16, 'bandpass', 6500, 2600, 0.5, 0.7);
      hiss(t + 0.07, 0.14, 'bandpass', 4200, 1800, 0.38, 0.8);
      hiss(t + 0.16, 0.2, 'bandpass', 2400, 900, 0.32, 1.1);
    },
    page() {            // 딸깍: 짧고 단단한 두 번의 걸림
      if (!audio()) return; lastSpecial = performance.now(); const t = ctx.currentTime;
      hiss(t, 0.018, 'highpass', 3200, 2800, 0.55, 0.7);
      tone(t, 1900, 0.02, 0.05, 'square');
      hiss(t + 0.05, 0.028, 'bandpass', 2200, 1600, 0.45, 2);
    },
    tap() {             // 톡: 나무 두드리듯 짧게 떨어지는 음
      if (!audio()) return; const t = ctx.currentTime;
      tone(t, 880, 0.06, 0.16, 'sine', 520);
      hiss(t, 0.012, 'bandpass', 3000, 2500, 0.12, 3);
    },
    ok() {              // 굿~!: 밝게 올라가는 세 음과 반짝이는 끝음
      if (!audio()) return; lastSpecial = performance.now(); const t = ctx.currentTime;
      [[784, 0], [988, 0.08], [1175, 0.16]].forEach(([f, d]) => tone(t + d, f, 0.22, 0.12, 'triangle'));
      tone(t + 0.26, 1568, 0.45, 0.09, 'sine'); tone(t + 0.26, 2093, 0.35, 0.03, 'sine');
    },
    get on() { return on; },
    set(v) { on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch {} render(); if (v) S.tap(); },
    wasSpecial() { return performance.now() - lastSpecial < 120; },
  };

  // 소리 켜기/끄기 버튼: 머리 부분(시작 화면은 위쪽 메뉴)에 하나
  const toggles = [];
  function render() { toggles.forEach(b => { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '소리 켜짐' : '소리 꺼짐'; }); }
  function makeToggle() {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sound-toggle'; b.dataset.sound = 'none';
    b.title = '효과음 켜기/끄기'; b.addEventListener('click', () => S.set(!on)); toggles.push(b); return b;
  }
  const head = document.querySelector('header.top .wrap');
  if (head) head.append(makeToggle());
  const coverNav = document.querySelector('.cv-nav ul');
  if (coverNav) { const li = document.createElement('li'); li.append(makeToggle()); coverNav.append(li); }
  render();

  // 클릭 소리 고르기: 정답 소리처럼 특별한 소리가 이미 났으면 겹치지 않게 건너뜀
  const PAGE = '[data-go], [data-step-go], [data-href], #prevStep, #nextStep, .stepnav button, .next button, a[href$=".html"], a[href*=".html#"]';
  document.addEventListener('click', e => {
    const el = e.target.closest('button, a, summary, [role="button"], input[type="checkbox"], input[type="radio"]');
    if (!el || el.dataset.sound === 'none' || el.disabled) return;
    if (S.wasSpecial()) return;
    if (el.matches('.cv-start')) S.start();
    else if (el.matches(PAGE)) S.page();
    else S.tap();
  });
  // 다른 페이지로 가는 링크는 소리가 끝까지 들리도록 아주 잠깐 기다렸다가 이동
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || !on || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href');
    if (!/\.html(#.*)?$/.test(href)) return;
    e.preventDefault(); setTimeout(() => { location.href = href; }, 170);
  });
  return S;
})();
