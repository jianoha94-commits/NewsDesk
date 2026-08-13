// 자이노하뉴스데스크 — 사이트 설정
// GitHub Pages 배포 후, 아래 Giscus 값을 채우면 커뮤니티가 자동 활성화됩니다.
//
// 설정 방법:
//  1) GitHub 저장소를 public 으로 만들고 Discussions 기능을 켜세요.
//     (Settings → General → Features → Discussions 체크)
//  2) https://github.com/apps/giscus 에서 giscus 앱을 해당 저장소에 설치하세요.
//  3) https://giscus.app 에 저장소 주소를 넣고 나오는 값(repoId, categoryId)을 아래에 복사하세요.

window.ZND_CONFIG = {
  giscus: {
    enabled: false,               // 값을 다 채운 뒤 true 로 바꾸세요
    repo: "OWNER/zainoha-newsdesk",// 예: "publicgptjl/zainoha-newsdesk"
    repoId: "",                   // giscus.app 에서 발급
    category: "General",
    categoryId: "",               // giscus.app 에서 발급
    mapping: "pathname",
  },
};
