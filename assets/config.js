// 자이노하뉴스데스크 — 사이트 설정

window.ZND_CONFIG = {
  // ----- 기본 언어 ("ko" | "en") -----
  defaultLang: "ko",

  // ----- 커뮤니티 (Giscus) -----
  // GitHub Pages 배포 후 값을 채우면 커뮤니티 광장이 자동 활성화됩니다.
  //  1) 저장소를 public 으로 만들고 Settings → Features → Discussions 체크
  //  2) https://github.com/apps/giscus 에서 giscus 앱 설치
  //  3) https://giscus.app 에서 repoId / categoryId 발급
  giscus: {
    enabled: false,
    repo: "OWNER/zainoha-newsdesk",
    repoId: "",
    category: "General",
    categoryId: "",
    mapping: "pathname",
  },

  // ----- 차단 대비 미러(대체 접속 경로) -----
  // 같은 사이트를 여러 호스트에 배포한 뒤, 각 주소를 여기에 넣으세요.
  // 방문자에게 "이 주소가 막히면 아래로 접속" 안내가 표시됩니다.
  mirrors: [
    // { label: "GitHub Pages", url: "https://OWNER.github.io/zainoha-newsdesk/" },
    // { label: "Cloudflare Pages", url: "https://zainoha-newsdesk.pages.dev/" },
    // { label: "Netlify", url: "https://zainoha-newsdesk.netlify.app/" },
  ],

  // Tor(.onion) 미러가 있다면 여기에. (Cloudflare Onion 또는 자체 hidden service)
  onion: "",
};
