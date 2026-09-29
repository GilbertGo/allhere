// 다왔나 앱 자동 시험: 에뮬레이터에서 "계획 없이 바로 출발" → 200m 걷기 흉내 → 걸은 길이 기록·그려지는지 확인
// 실행: node app/test/walk-test.mjs   (에뮬레이터 AVD 이름: dawatna_test, 앱 파일: app/dawatna.apk)
// 결과: 콘솔에 PASS/FAIL, 화면 캡처는 app/test/out/*.png
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SDK = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const ADB = join(SDK, 'platform-tools', 'adb.exe');
const EMU = join(SDK, 'emulator', 'emulator.exe');
const APK = join(HERE, '..', 'dawatna.apk');
const PKG = 'io.github.gilbertgo.allhere';
const AVD = 'dawatna_test';
const OUT = join(HERE, 'out'); mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim();
const log = (...a) => console.log('[시험]', ...a);

async function bootEmulator() {
  if (adb('devices').split('\n').some(l => /^emulator-\d+\s+device/.test(l))) return log('에뮬레이터가 이미 켜져 있어요');
  log('에뮬레이터를 켜요…');
  spawn(EMU, ['-avd', AVD, '-no-snapshot-save', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect'], { detached: true, stdio: 'ignore' }).unref();
  adb('wait-for-device');
  for (let i = 0; i < 120; i++) { try { if (adb('shell', 'getprop', 'sys.boot_completed') === '1') break; } catch {} await sleep(2000); }
  await sleep(3000);
  log('에뮬레이터 준비됨');
}
const geo = (lat, lng) => adb('emu', 'geo', 'fix', String(lng), String(lat));   // 경도 먼저
function shot(name) { const png = execFileSync(ADB, ['exec-out', 'screencap', '-p']); writeFileSync(join(OUT, name + '.png'), png); log('캡처', name + '.png'); }

// 앱 웹뷰에 연결(크롬 개발자 도구와 같은 통로)해서 자바스크립트를 실행해요
async function connectWebView() {
  for (let i = 0; i < 30; i++) {
    const socks = adb('shell', 'cat', '/proc/net/unix').split('\n').map(l => (l.match(/@(webview_devtools_remote_\d+)/) || [])[1]).filter(Boolean);
    if (socks.length) {
      adb('forward', 'tcp:9333', 'localabstract:' + socks[socks.length - 1]);
      try {
        const list = await (await fetch('http://127.0.0.1:9333/json')).json();
        const page = list.find(p => p.type === 'page' && /gilbertgo\.github\.io/.test(p.url));
        if (page) return cdp(page.webSocketDebuggerUrl);
      } catch {}
    }
    await sleep(1000);
  }
  throw new Error('앱 웹뷰를 찾지 못했어요');
}
async function cdp(url) {
  const ws = new WebSocket(url); let id = 0; const wait = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'JS 오류');
    return r.result.result.value;
  };
  return { js, close: () => ws.close() };
}
const click = text => `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`;

async function main() {
  if (!existsSync(APK)) throw new Error('앱 파일이 없어요: ' + APK);
  await bootEmulator();
  log('앱 설치'); adb('install', '-r', APK);
  for (const p of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']) { try { adb('shell', 'pm', 'grant', PKG, 'android.permission.' + p); } catch {} }
  adb('shell', 'pm', 'clear', PKG);   // 지난 시험 기록 지우기
  for (const p of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']) { try { adb('shell', 'pm', 'grant', PKG, 'android.permission.' + p); } catch {} }
  const start = [37.5389, 126.6612];
  geo(...start);
  log('앱 실행'); adb('shell', 'am', 'start', '-n', PKG + '/.MainActivity');
  const w = await connectWebView();
  for (let i = 0; i < 40 && !(await w.js(`!!document.body && document.body.innerText.includes('계획 없이 바로 출발')`)); i++) await sleep(1000);
  log('버전', await w.js(`(document.body.innerText.match(/버전 [^\\n]*/) || [''])[0]`));
  await w.js(click('계획 없이 바로 출발')); await sleep(1500);
  await w.js(`document.querySelector('#ql').value = '에뮬레이터'`);
  await w.js(click('지금 출발'));
  await sleep(6000);
  const w2 = await connectWebView();   // 인솔자 화면으로 넘어가며 새 페이지
  for (let i = 0; i < 30 && !(await w2.js(`document.body.innerText.includes('걸은 거리')`)); i++) await sleep(1000);
  shot('1-출발');
  // 북동쪽으로 약 10m씩 20번 = 약 200m. --screen-off 이면 걷는 동안 화면을 꺼요(앱이 화면 꺼짐에도 기록하는지)
  const OFF = process.argv.includes('--screen-off');
  if (OFF) { adb('shell', 'input', 'keyevent', '26'); log('화면 끔'); await sleep(3000); }
  for (let k = 1; k <= 20; k++) { geo(start[0] + k * 0.00007, start[1] + k * 0.00007); await sleep(process.argv.includes('--long') ? 21000 : OFF ? 4000 : 1500); }   // --long: 20걸음 × 21초 = 약 7분
  if (OFF) { adb('shell', 'input', 'keyevent', '24'); adb('shell', 'input', 'keyevent', '26'); await sleep(1500); adb('shell', 'wm', 'dismiss-keyguard'); log('화면 켬'); }
  await sleep(2000);
  const res = await w2.js(`(() => { const t = new URL(location.href).searchParams.get('t'); const tr = JSON.parse(localStorage.getItem('track:' + t) || '[]'); return { t, points: tr.length, dist: (document.querySelector('.goal b') || {}).textContent }; })()`);
  log('결과', JSON.stringify(res));
  await w2.js(click('지도')); await sleep(2500);
  const line = await w2.js(`(() => { const p = [...document.querySelectorAll('.leaflet-overlay-pane path')].find(p => p.getAttribute('stroke') === '#D9822B'); return p ? p.getAttribute('d').split(/[LM]/).filter(Boolean).length : 0; })()`);
  shot('2-지도');
  log('지도 주황 선 점 수', line);
  // 시험 나들이 지우기
  await w2.js(click('인원 현황')); await sleep(800);
  await w2.js(`window.confirm = () => true; document.querySelectorAll('details').forEach(d => d.open = true); true`);
  await w2.js(click('나들이 끝내기')); await sleep(3000);
  const ok = res.points >= 10 && line >= 2;
  console.log(ok ? '\nPASS: 걸은 길이 기록되고 지도에 그려져요' : '\nFAIL: 걸은 길 기록 ' + res.points + '곳, 지도 선 점 ' + line + '개');
  w.close(); w2.close();
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('시험 실패:', e.message); process.exit(2); });
