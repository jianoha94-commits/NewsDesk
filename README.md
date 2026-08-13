# 📡 자이노하뉴스데스크 (ZAINOHA NEWS DESK)

세상이 관심있어하는 니즈를 매일 3건씩 자동 선정하고, 각 이슈에 대한 **호감도**를 지속적으로 추적하는 정적 뉴스 대시보드.

## 구성

| 항목 | 내용 |
|---|---|
| 수집 소스 | Google News RSS (국내), Reddit r/worldnews (글로벌), Hacker News (테크) — 전부 무료, API 키 불필요 |
| 발행 주기 | 매일 07:30 KST, GitHub Actions 크론 자동 실행 |
| 호감도 | ① 방문자 👍/👎 투표 (Abacus 무료 카운터 API, 전역 집계) ② 커뮤니티 반응 지표 (업보트·댓글 → 관심도 0~100) ③ 보도 톤 (헤드라인 키워드 기반 긍정/부정 게이지) |
| 배포 | GitHub Pages (정적 사이트) |

## 로컬 실행

```bash
node scripts/collect.mjs   # 오늘의 이슈 수집 → data/ 갱신
python -m http.server 8090 # http://localhost:8090 에서 확인
```

## 배포 방법

1. GitHub에 저장소 생성 후 푸시
2. 저장소 **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`** 선택
3. Actions 탭에서 "일일 이슈 수집" 워크플로가 매일 데이터를 갱신하면 Pages가 자동 반영

## 커뮤니티 (Giscus)

배포 후 방문자들이 GitHub 계정으로 사실 확인·토론을 남길 수 있는 공개 게시판이 붙습니다.

1. 저장소를 **public** 으로 만들고 **Settings → General → Features → Discussions** 체크
2. https://github.com/apps/giscus 에서 giscus 앱을 저장소에 설치
3. https://giscus.app 에 저장소 주소를 넣어 `repoId` / `categoryId` 발급
4. `assets/config.js` 에 값을 채우고 `enabled: true` 로 변경

서버·DB 없이 동작하며, 모든 글은 저장소의 GitHub Discussions에 공개 기록으로 보존됩니다.

## 데이터 구조

- `data/latest.json` — 오늘의 이슈 3건
- `data/archive/YYYY-MM-DD.json` — 일자별 아카이브
- `data/index.json` — 아카이브 날짜 목록
