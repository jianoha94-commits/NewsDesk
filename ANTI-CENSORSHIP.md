# 정보 접근성 · 게시자 보호 가이드

이 문서는 **정보 접근의 자유**를 위해 자이노하뉴스데스크가 취할 수 있는 조치를 정리합니다.

> ⚠️ **중요 — 과신 금지**
> 아래 조치들은 위험을 *줄이는* 수단이지 **익명성을 보장하지 않습니다.**
> 국가 수준의 감시자를 상대로 신원·위치를 완전히 숨기는 것은 웹사이트 설정만으로 불가능합니다.
> 실제 신변 위험이 있다면 반드시 전문 자료·인력을 함께 활용하세요:
> - EFF Surveillance Self-Defense — https://ssd.eff.org
> - Access Now Digital Security Helpline — https://www.accessnow.org/help
> - Freedom of the Press Foundation — https://freedom.press

---

## 1. 차단 대비 — 여러 곳에 동시 배포(미러)

한 주소가 막혀도 다른 주소로 접속되도록 **같은 저장소를 여러 정적 호스트에 배포**합니다.
모두 무료이며, 저장소를 연결만 하면 자동 갱신됩니다.

| 호스트 | 배포 방법 | 예시 주소 |
|---|---|---|
| GitHub Pages | Settings → Pages | `OWNER.github.io/zainoha-newsdesk` |
| Cloudflare Pages | dash.cloudflare.com → Pages → Connect to Git | `zainoha-newsdesk.pages.dev` |
| Netlify | netlify.com → Add site → Import (netlify.toml 포함됨) | `zainoha-newsdesk.netlify.app` |

배포 후 각 주소를 `assets/config.js` 의 `mirrors` 에 넣으면, 사이트 하단 "접속이 막혔다면"에
대체 주소가 자동 표시됩니다.

**Cloudflare Onion 라우팅**: Cloudflare Pages를 쓰면 `.onion` 주소로도 접근 가능합니다
(대시보드 → Network → Onion Routing). 발급된 주소를 `config.js` 의 `onion` 에 넣으세요.

## 2. 게시자 신원·위치 보호

- **자동 커밋은 봇 신원으로**: GitHub Actions의 일일 수집 커밋은 `zainoha-bot` 이름으로 남습니다(개인 신원 없음).
- **개인 푸시 시**: 로컬 git 사용자명을 실명이 아닌 가명으로 설정하세요. (아래 명령 참고)
- **가명 GitHub 계정**: 실명·개인 이메일과 분리된 계정으로 저장소를 만드세요. 이메일은
  Settings → Emails → *Keep my email private* 로 숨길 수 있습니다.
- **VPN/Tor 경유 푸시**: 저장소에 푸시할 때 VPN 또는 Tor를 경유하면 접속 IP가 기록되지 않습니다.
- **메타데이터 주의**: 업로드하는 이미지·문서의 EXIF/작성자 정보에 위치·이름이 남을 수 있습니다.

로컬 커밋 신원을 가명으로 설정하는 명령 (이 저장소에만 적용):

```bash
git config user.name "zainoha"
git config user.email "zainoha@users.noreply.github.com"
```

## 3. 독자 접근 안내

사이트에 이미 포함되어 있습니다("접속이 막혔다면" 섹션). 독자에게 권하는 방법:
Tor 브라우저, 신뢰할 수 있는 VPN, 미러 주소 미리 저장.

## 4. 지켜야 할 선

이 프로젝트는 **사실을 정확한 출처와 함께 알리는 것**을 목적으로 합니다.
발신 출처를 위장하거나, 신원을 사칭하거나, 허위 정보를 진짜처럼 꾸미는 용도로는 사용하지 마세요 —
그것은 접근성 확보가 아니라 기만이며, 신뢰와 안전 모두를 해칩니다.
