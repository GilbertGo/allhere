# 소방 사진대지 AI 서버 만들기 (한 번만)

사진을 AI에게 보여 주려면 AI 키가 필요한데, 웹앱에는 숨길 곳이 없어서 아주 작은 서버(Cloudflare Worker, 무료)에 숨겨 둡니다.
AI는 `claude-haiku-4-5`(싸고 빠른 모델), 사진 1장에 약 3~5원입니다(질문이 생기면 그 사진은 2~3배).

## 1. Anthropic API 키 만들기
1. https://console.anthropic.com 가입 → Billing(결제)에서 카드 등록, 처음엔 $5 정도 충전
2. **Limits(사용 한도)에서 월 한도를 $5~10로 걸어 두기** (혹시 모를 과다 사용 방지)
3. API Keys → Create Key → 이름 `fire-sheet` → 나온 키(`sk-ant-...`)를 복사해 메모장에 잠시 보관

## 2. Cloudflare Worker 만들기
1. https://dash.cloudflare.com 가입(무료)
2. 왼쪽 **Workers & Pages** → **Create** → **Create Worker** → 이름 `fire-sheet-ai` → **Deploy**
3. **Edit code** → 원래 있던 글을 모두 지우고 `worker.js` 내용을 통째로 붙여넣기 → **Deploy**
4. 워커 화면 **Settings → Variables and Secrets → Add**
   - `ANTHROPIC_API_KEY` (종류 Secret) = 1번에서 복사한 키
   - `APP_KEY` (종류 Secret) = 아무 암호(예: `fire-2026-xyz`). 휴대폰 앱에도 똑같이 적어요
   - Deploy
5. 워커 주소(예: `https://fire-sheet-ai.○○○.workers.dev`)를 복사

## 3. 휴대폰 소방 사진대지에 연결
1. 소방 사진대지 첫 화면 → **🤖 AI로 채우기 설정**
2. "AI로 채우기 쓰기" 체크, **AI 서버 주소** = 2-5의 주소, **앱 암호** = 2-4의 APP_KEY → 저장
3. 사진을 고르고 "글 적기"의 **🤖 AI로 채우기**, 또는 장갑 모드에서 "찍어"
