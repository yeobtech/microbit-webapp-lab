# 마이크로비트와 웹앱 연동 교육

마이크로비트의 센서값을 웹앱으로 보내고, 웹앱이 판단해서 서보모터와 네오픽셀을 움직이는 발명품을 만드는 중학교 수업 자료입니다.
학생은 제미나이로 자기 웹앱을 만들고, 크롬의 Web Serial로 실제 장치와 연결합니다.

**사이트 열기:** https://yeobtech.github.io/microbit-webapp-lab/

## 수업 흐름

| 단계 | 페이지 | 내용 |
|---|---|---|
| 1 작품 보기 | `index.html` | 선생님 작품 「안전한 밤길 등불」, 상황별 화면, 체험판, 데이터 흐름 |
| 2 연결하기 | `index.html` | 준비물과 배선, 공통 코드 넣기(메이크코드), 메이크코드 탭 닫기, 연결 시험기 |
| 2-1 배선 연습 | `wiring.html` | 점퍼선, 꽂고 빼는 방법, 내 보드, G·V·S와 핀 번호, 함께 연결(사진 위 배선 연습) |
| 3 활동지 실습 | `practice.html` | 활동지 옮겨 쓰기 → 프롬프트 완성 → 만들고 저장 → 시험하고 고치기 → 공유·설명 → 느낀 점 |
| 기록 | `assessment.html` | 수행평가 과정: 아이디어(구글 폼·활동지) → HTML 웹앱 → 메이크코드, 채점 기준 |

## 준비물

- micro:bit V2, KittenBot Robotbit 확장보드(배터리 포함)
- 서보모터 SG90 (S1), 네오픽셀 6개 모듈 (P15), 초음파센서 HC-SR04 (Trig P14, Echo P13)
- 크롬 브라우저 (Web Serial을 지원하는 Chrome 또는 Edge)
- 마이크로비트에 넣을 공통 코드: [`makecode/공통-makecode.ts`](makecode/공통-makecode.ts) — 메이크코드에서 **robotbit 확장 하나만** 추가하고 JavaScript 탭에 붙여넣습니다.

### 통신 약속

- 마이크로비트 → 웹 (0.2초마다): `D,거리,흔들림,밝기,온도,A,B,앞뒤기울기,좌우기울기`
- 웹 → 마이크로비트: `S,각도` 서보 · `L,r,g,b` 네오픽셀 전체 · `P,번호,r,g,b` 하나 · `B,밝기` · `R` 무지개 · `T` 한 칸 돌리기
- 연결 전에 **메이크코드 탭을 닫아야** 합니다. 열려 있으면 메이크코드가 USB 데이터를 가로채서 숫자가 깨집니다.

## 파일 구조

```
index.html, wiring.html, practice.html, assessment.html   ← 나눠 주는 완성본 (사진이 모두 들어 있어 파일 하나로 열림)
source.html, wiring-source.html, practice-source.html, assessment-source.html   ← 고칠 때 손대는 원본
tools/build.mjs     ← 원본 → 완성본 만들기
tools/lesson.css    ← 수업 페이지 공통 디자인
tools/lesson.js     ← 들어올 때의 움직임, 효과음
makecode/           ← 마이크로비트 공통 코드
prompt/             ← 제미나이 프롬프트 ([A] 내 발명품, [B] 제작 규칙)
images/             ← 사진 원본
examples/           ← 결과물 예시 웹앱 (예시 발명품 ①~⑧로 제미나이가 만든 HTML)
```

## 고치는 방법

1. 원본(`*-source.html`, `tools/`, `makecode/`, `prompt/`)을 고칩니다.
2. Node.js 22 이상으로 완성본을 다시 만듭니다.

   ```bash
   node tools/build.mjs
   ```

3. 완성본(`index.html` 등)은 직접 고치지 않습니다. 다음 빌드 때 덮어써집니다.

## 라이선스

- 코드: [MIT](LICENSE)
- 수업 글과 직접 만든 그림: [CC BY-NC-SA 4.0](LICENSE-CONTENT.md)
- 다른 사람이 만든 사진과 글꼴: 각자의 라이선스 — [CREDITS.md](CREDITS.md)

배선 연습 페이지는 같은 저작자의 [핀랩(PINLAB)](https://github.com/yeobtech/pinlab-physical-computing) 수업을 바탕으로 만들었습니다.
