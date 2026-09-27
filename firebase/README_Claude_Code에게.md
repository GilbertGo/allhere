# 다왔나 (단체 인솔 웹앱) — 배포 안내 (Claude Code용)

앱 이름은 **다왔나**, 영어 식별자(주소·프로젝트 이름)는 **allhere**를 쓴다. Firebase 프로젝트 ID와 호스팅 주소도 가능하면 allhere로 맞춘다.

`allhere/public/index.html` 한 파일로 된 웹앱이다. 인솔자가 나들이(여행, 산행, 산책 등)을 만들고 참여 링크(`?t=나들이ID&m=1`)를 카톡으로 보내면, 참여자는 앱 설치 없이 브라우저에서 이름만 적고 참여한다. Firebase 익명 로그인 + Realtime Database를 쓴다.

## 해야 할 일
1. **Firebase 프로젝트 정하기.** HERE(here-native)와 섞지 말고 새 프로젝트를 권장. 같은 프로젝트를 쓸 거면 아래 규칙을 기존 규칙에 **합쳐야** 한다(덮어쓰면 HERE 앱이 망가짐).
2. 콘솔에서 **Authentication → 익명 로그인 사용 설정**, **Realtime Database 생성**.
3. **웹 앱 등록** 후 나오는 설정값(apiKey, authDomain, databaseURL, projectId, appId)을 `index.html` 상단 `firebaseConfig`에 넣는다.
4. `database.rules.snippet.json`의 `trips`, `tripSecrets`, `tripLeaders`, `tripPins` 네 노드를 DB 규칙에 넣고 배포.
5. Firebase Hosting으로 `public/` 배포 (`firebase init hosting` → public 폴더 = public, SPA 아님).
6. 휴대폰 두 대로 확인: 단체 나들이 만들기 → 참여 링크 공유 → 다른 폰에서 참여 → 인솔자 화면에 위치/상태 표시 → 버스 탑승 체크 → 전체 알림 → 나들이 끝내기.

## 구조
- `trips/{t}/info` 산행 정보(인솔자만 씀), `members/{uid}` 참여자 본인만 씀(이름, 위치, 상태), `boarded/{uid}` 탑승 체크, `notice` 전체 알림.
- 인솔자 권한: `tripSecrets/{t}`(아무도 못 읽음)와 같은 키를 `tripLeaders/{t}/{uid}`에 써야 인정. 공동 인솔자 링크(`?t=..&k=키`)로 다른 폰에서도 인솔자가 될 수 있다.
- 인솔자 비밀번호(숫자 4자리): `tripPins/{t}`에 저장(인솔자만 읽기·쓰기). 참여자가 이 번호를 `tripLeaders/{t}/{uid}`에 쓰면 규칙이 검증해서 인솔자로 인정한다.
- 나들이 끝내기 = `trips/{t}` 통째로 삭제. `tripSecrets`는 남는다(작음, 나중에 정리 스크립트 고려).

## 알려진 한계 (의도된 것)
- 참여자 휴대폰 화면이 꺼지면 위치 전송이 멈춘다(웹의 한계). '화면 켜두기'(Wake Lock) 버튼으로 보완, 5분 넘게 소식이 없으면 인솔자 화면에 '위치 소식 없음'으로 표시.
- 코스 이탈 자동 감지는 아직 없음(코스 데이터 필요). 지금은 집결지까지 거리와 마지막 위치 시각으로 판단.
- 지도는 OpenStreetMap 타일. 나중에 카카오맵으로 바꿀 수 있음(도메인 등록 필요).
