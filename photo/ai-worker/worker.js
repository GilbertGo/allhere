// 사진 글상자 AI 도우미 (Cloudflare Worker)
// 웹앱이 보낸 사진을 Claude(claude-haiku-4-5)에게 보여 주고 제목·내용을 받아 돌려줘요.
// AI 키(ANTHROPIC_API_KEY)는 여기에만 숨겨 두고, 웹앱에는 두지 않아요(웹앱은 누구나 코드를 볼 수 있어서).
//
// 설정(Cloudflare 대시보드 → Workers → 이 워커 → Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  : Anthropic 콘솔에서 만든 키 (Secret)
//   APP_KEY            : 웹앱에 적어 넣을 앱 암호(아무 글자, Secret). 모르는 사람이 이 주소를 써도 막아요
//
// Cloudflare 대시보드의 코드 편집기에는 npm 꾸러미를 넣을 수 없어서, Anthropic SDK 대신 fetch로 바로 불러요.

const ALLOW_ORIGIN = 'https://gilbertgo.github.io';
const MODEL = 'claude-haiku-4-5';

// AI가 돌려줄 모양: 제목·내용, 그리고 확실하지 않을 때 찍은 사람에게 물어볼 질문(없으면 빈 글)과 보기
const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '사진 제목. 짧게(20자 안쪽)' },
    memo: { type: 'string', description: '내용 한 줄. 사진에서 보이는 것만(40자 안쪽)' },
    question: { type: 'string', description: '꼭 확인이 필요할 때만 찍은 사람에게 물을 짧은 질문. 필요 없으면 빈 글' },
    choices: { type: 'array', items: { type: 'string' }, description: '질문의 대답 보기 2~4개(짧게). 질문이 없으면 빈 배열' }
  },
  required: ['title', 'memo', 'question', 'choices'],
  additionalProperties: false
};

const SYSTEM = `너는 현장 사진에 붙일 글상자를 쓰는 도우미야. 사진을 보고 한국어로 제목과 내용 한 줄을 써.
- 제목: 무엇을 찍었는지 짧게. 간판·메뉴판·표지판 글씨가 보이면 그 이름을 써(예: "점심 삼대째손두부", "외벽 균열 점검").
- 내용: 사진에서 실제로 보이는 것만 짧게(예: "순두부, 콩물, 두부김치", "창문 아래 세로 균열").
- 짐작으로 꾸며 쓰지 마. 사진만으로 확실하지 않고, 그게 글에 꼭 필요할 때만 question에 짧은 질문을 하나 넣고 choices에 대답 보기를 줘. 확실하면 question은 빈 글.
- "찍은 사람이 알려 준 것"이 있으면 그걸 믿고 글에 반영해. 이미 대답한 것은 다시 묻지 마.`;

// 소방점검 사진대지 양식: 설비명(title) · 위치(place) · 불량내용(memo) · 조치사항(fix)
const SCHEMA_FIRE = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '설비명. 예: 소화기, 옥내소화전, 스프링클러헤드, 감지기, 유도등' },
    place: { type: 'string', description: '건물 안 위치(예: 지하1층 기계실 앞). 사진이나 알려 준 것으로 확실할 때만, 아니면 빈 글' },
    memo: { type: 'string', description: '불량내용. 소방점검 보고서 말투로 짧게(30자 안쪽)' },
    fix: { type: 'string', description: '조치사항. 예: 교체 요망, 재충전 요망, 수리 요망, 장애물 제거' },
    question: { type: 'string', description: '꼭 확인이 필요할 때만 점검자에게 물을 짧은 질문. 필요 없으면 빈 글' },
    choices: { type: 'array', items: { type: 'string' }, description: '질문의 대답 보기 2~4개(짧게). 질문이 없으면 빈 배열' }
  },
  required: ['title', 'place', 'memo', 'fix', 'question', 'choices'],
  additionalProperties: false
};

const SYSTEM_FIRE = `너는 소방시설 작동·종합점검 "사진대지"를 쓰는 도우미야. 사진을 보고 한국어 소방점검 보고서 말투로 칸을 채워.
- 설비명(title): 소화기, 옥내소화전, 스프링클러헤드, 감지기, 발신기, 경종, 수신기, 유도등, 비상조명등, 방화문, 완강기, 피난통로 같은 이름으로.
- 불량내용(memo): 예) "압력 불량(지시압력계 적색)", "내용연수 경과", "호스 미비치", "헤드 도장", "감지기 탈락", "유도등 점등 불량", "방화문 자동폐쇄장치 불량", "피난통로 장애물 적치".
- 조치사항(fix): 예) "교체 요망", "재충전 요망", "수리 요망", "설치 요망", "이설 요망", "장애물 제거", "즉시 시정".
- 위치(place): 층·실 이름(예: "지하1층 기계실 앞", "3층 복도")이 사진 표지나 알려 준 것으로 확실할 때만. 모르면 빈 글로 두고, 다른 게 다 확실하면 question으로 위치를 물어도 돼(보기 예: "지하1층", "1층 로비", "계단실").
- 불량이 안 보이면 memo는 "이상 없음", fix는 빈 글.
- 짐작으로 꾸며 쓰지 마. 사진만으로 불량 여부나 설비가 확실하지 않을 때만 question에 짧은 질문 하나와 choices를 줘. 확실하면 question은 빈 글.
- "점검자가 알려 준 것"이 있으면 그걸 믿고 반영해. 이미 대답한 것은 다시 묻지 마.`;

let cors = { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });

export default {
  async fetch(req, env) {
    if (env.ALLOW_ORIGIN) cors = { ...cors, 'Access-Control-Allow-Origin': env.ALLOW_ORIGIN };   // 시험할 때만 다른 주소 허용
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST만 돼요' }, 405);
    if (!env.APP_KEY || req.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: '앱 암호가 맞지 않아요' }, 401);
    let body; try { body = await req.json(); } catch { return json({ error: '보낸 내용을 읽지 못했어요' }, 400); }
    const { image, date = '', place = '', facts = [], answers = [], mode = 'basic' } = body || {};
    const fire = mode === 'fire';
    if (typeof image !== 'string' || image.length < 100 || image.length > 4_000_000) return json({ error: '사진이 없거나 너무 커요' }, 400);

    const told = [...facts, ...answers.map(a => `${a.q} → ${a.a}`)].filter(Boolean);
    const text = [
      `찍은 날: ${date || '모름'}`, `찍은 곳(동네): ${place || '모름'}`,
      told.length ? `찍은 사람이 알려 준 것:\n- ${told.join('\n- ')}` : '',
      answers.length >= 2 ? '이번에는 더 묻지 말고 question은 빈 글로 해.' : ''
    ].filter(Boolean).join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: fire ? SYSTEM_FIRE : SYSTEM,
        output_config: { format: { type: 'json_schema', schema: fire ? SCHEMA_FIRE : SCHEMA } },
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text }
        ] }]
      })
    });
    if (!r.ok) return json({ error: `AI 오류 ${r.status}`, detail: (await r.text()).slice(0, 300) }, 502);
    const msg = await r.json();
    if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return json({ error: 'AI가 글을 쓰지 못했어요' }, 502);
    const t = (msg.content || []).find(b => b.type === 'text');
    let out; try { out = JSON.parse(t ? t.text : ''); } catch { return json({ error: 'AI 대답을 읽지 못했어요' }, 502); }
    return json({ title: out.title || '', memo: out.memo || '', ...(fire ? { place: out.place || '', fix: out.fix || '' } : {}), question: out.question || '', choices: Array.isArray(out.choices) ? out.choices.slice(0, 4) : [] });
  }
};
