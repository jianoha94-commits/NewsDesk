# 커뮤니티 설정 — Firebase + 구글 로그인

커뮤니티(구글 로그인·닉네임·댓글·좋아요/싫어요)를 켜는 방법입니다. **무료 티어**로 충분하며,
Firebase 프로젝트 생성은 **본인 구글 계정**으로 직접 하셔야 합니다(제가 계정을 만들 수 없습니다).

## 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com → **프로젝트 추가**
2. 프로젝트 이름: `zainoha-newsdesk` (아무거나)

## 2. 구글 로그인 켜기
- **Authentication → Sign-in method → Google → 사용 설정 → 저장**
- **Authentication → Settings → Authorized domains** 에 배포 도메인 추가
  (예: `OWNER.github.io`, `zainoha-newsdesk.pages.dev`, `localhost`)

## 3. Firestore 데이터베이스 만들기
1. **Firestore Database → 데이터베이스 만들기 → 프로덕션 모드**
2. **규칙(Rules)** 탭 → 이 저장소의 [firestore.rules](firestore.rules) 내용을 **그대로 붙여넣고 게시**

## 4. 웹 앱 등록 후 설정값 복사
1. **프로젝트 설정(⚙️) → 내 앱 → 웹 앱 추가(</>)**
2. 나오는 `firebaseConfig` 값을 `assets/config.js` 의 `firebase` 에 입력하고 `enabled: true` 로 변경
   ```js
   firebase: {
     enabled: true,
     apiKey: "AIza...",
     authDomain: "zainoha-newsdesk.firebaseapp.com",
     projectId: "zainoha-newsdesk",
     appId: "1:...:web:...",
   }
   ```
   > 이 값들은 공개되어도 안전한 publishable 키입니다. 보안은 3번의 **규칙**이 담당합니다.

## 5. 배포
`config.js` 를 커밋·푸시하면 각 미러에서 커뮤니티가 자동 활성화됩니다.

---

## 부계정·조작 방지에 대하여 (IP를 저장하지 않는 이유)

- **구글 계정 1개 = 검증된 신원 1개.** 부정계정 탐지(전화 인증 등)는 구글이 처리하므로,
  IP를 모으지 않아도 "한 사람이 수십 개 계정"을 막는 효과가 IP 제한보다 큽니다.
- 좋아요/싫어요는 **사용자당 1표**로 규칙에서 강제됩니다(문서 id = uid).
- **IP↔닉네임 장부를 만들지 않는 이유**: 이 사이트는 검열로부터 사람을 보호하려는 곳입니다.
  그런 장부는 압수·유출 시 이용자를 노출시키는 허니팟이 됩니다. 그래서 저장하지 않습니다.
- 더 강한 자동화 방어가 필요하면, 나중에 **Firebase App Check**(reCAPTCHA)를 추가할 수 있습니다.
  이것도 IP를 보관하지 않고 봇을 걸러냅니다.

> 만약 법적 요건상 접속 기록이 꼭 필요하다면, 반드시 **개인정보 수집 고지·동의**를 두고,
> IP는 **해시 처리 + 짧은 보관기간**으로 최소화해야 합니다. 몰래 수집은 개인정보보호법 위반입니다.
