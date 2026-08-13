// 자이노하뉴스데스크 — 사이트 설정

window.ZND_CONFIG = {
  // ----- 기본 언어 ("ko" | "en") -----
  defaultLang: "ko",

  // ----- 커뮤니티: Firebase + 구글 로그인 -----
  // 아래 값을 채우면 커뮤니티(구글 로그인·닉네임·댓글·좋아요/싫어요)가 활성화됩니다.
  // 설정 방법:
  //  1) https://console.firebase.google.com 에서 프로젝트 생성 (본인 구글 계정)
  //  2) Authentication → Sign-in method → Google 사용 설정
  //  3) Firestore Database 생성 (프로덕션 모드), firestore.rules 내용 붙여넣기
  //  4) 프로젝트 설정 → 웹 앱 추가 → firebaseConfig 값을 아래에 복사
  //     (이 값들은 공개되어도 안전한 "publishable" 키입니다)
  firebase: {
    enabled: true,
    apiKey: "AIzaSyAn10uQHdcfhDVT8BrbtAb0nIla7n1hRw8",
    authDomain: "jianoha-newsdesk.firebaseapp.com",
    projectId: "jianoha-newsdesk",
    appId: "1:1006408483856:web:4dfb5bb8377f675a887695",
    // Firestore 규칙을 반드시 적용하세요(무단 쓰기 방지). firestore.rules 참고.
  },

  // ----- 차단 대비 미러(대체 접속 경로) -----
  mirrors: [
    // { label: "GitHub Pages", url: "https://OWNER.github.io/zainoha-newsdesk/" },
    // { label: "Cloudflare Pages", url: "https://zainoha-newsdesk.pages.dev/" },
    // { label: "Netlify", url: "https://zainoha-newsdesk.netlify.app/" },
  ],
  onion: "",
};
