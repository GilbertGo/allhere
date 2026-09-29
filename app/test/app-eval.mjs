// 에뮬레이터(또는 USB 휴대폰)의 다왔나 앱 화면에서 자바스크립트 한 줄을 실행하고 결과를 보여줘요
// 실행: node app/test/app-eval.mjs "document.body.innerText.slice(0, 200)"
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const ADB = join(process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), 'platform-tools', 'adb.exe');
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim();
const socks = adb('shell', 'cat', '/proc/net/unix').split('\n').map(l => (l.match(/@(webview_devtools_remote_\d+)/) || [])[1]).filter(Boolean);
if (!socks.length) { console.error('앱 웹뷰가 없어요'); process.exit(1); }
adb('forward', 'tcp:9333', 'localabstract:' + socks[socks.length - 1]);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id !== 1) return;
  const r = m.result;
  console.log(r.exceptionDetails ? '오류: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) : JSON.stringify(r.result.value, null, 1));
  ws.close(); process.exit(0);
};
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
