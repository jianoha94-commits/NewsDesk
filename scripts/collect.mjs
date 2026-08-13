// 자이노하뉴스데스크 — 일일 이슈 수집기
// 무료 소스(Google News RSS, Reddit, Hacker News)에서 오늘의 이슈 3개를 선정해
// data/latest.json 과 data/archive/YYYY-MM-DD.json 으로 저장한다.
// 의존성 없음 — Node 18+ 내장 fetch 사용.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");

const UA = "ZainohaNewsDesk/1.0 (personal news dashboard; contact: none)";

// ---------- 유틸 ----------

function kstDateString(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...(opts.headers || {}) },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, { headers: { Accept: "application/json" } }));
}

// ---------- RSS 파싱 ----------

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      pubDate: tag(block, "pubDate"),
      source: tag(block, "source"),
      description: tag(block, "description"),
    });
  }
  return items;
}

// Google News 기사 description 안의 관련 기사 링크 목록 추출 (메인 제목과 중복 제거)
function relatedFromDescription(desc, mainTitle = "", limit = 4) {
  const rel = [];
  const main = mainTitle.replace(/\s+/g, "");
  for (const m of desc.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = stripTags(m[2]);
    if (!title || /전체 보기|View Full Coverage|Google 뉴스/i.test(title)) continue;
    if (main && title.replace(/\s+/g, "").includes(main.slice(0, 20))) continue;
    rel.push({ title, url: decodeEntities(m[1]) });
    if (rel.length >= limit) break;
  }
  return rel;
}

// 보도량(관련 기사 수) → 관심도 0~100
function coverageEngagement(count) {
  return Math.min(95, 35 + count * 11);
}

// ---------- 헤드라인 톤(보조 지표) ----------

const POS_WORDS = [
  "성공", "타결", "합의", "회복", "상승", "호조", "최고", "돌파", "개선", "혁신", "성장", "수상", "쾌거", "환영", "기대",
  "win", "wins", "success", "breakthrough", "record", "growth", "recover", "rally", "agree", "deal", "peace", "cure", "surge", "boost", "hope",
];
const NEG_WORDS = [
  "사망", "사고", "붕괴", "하락", "폭락", "논란", "위기", "충돌", "전쟁", "참사", "감소", "우려", "실패", "혐의", "체포", "파산", "갈등", "피해",
  "dead", "death", "crash", "crisis", "war", "attack", "fail", "fear", "collapse", "fraud", "arrest", "layoff", "cuts", "threat", "toll", "strike",
];

function toneOf(texts) {
  const joined = texts.join(" ").toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POS_WORDS) if (joined.includes(w.toLowerCase())) pos++;
  for (const w of NEG_WORDS) if (joined.includes(w.toLowerCase())) neg++;
  if (pos + neg === 0) return { score: 0, label: "중립" };
  const score = Math.round(((pos - neg) / (pos + neg)) * 100);
  const label = score > 20 ? "긍정" : score < -20 ? "부정" : "중립";
  return { score, label };
}

// ---------- 참여도(커뮤니티 반응) ----------

// score/comments 를 0~100 참여도로 변환 (로그 스케일)
function engagement(score, comments) {
  const raw = Math.log10(Math.max(1, score) + 2 * Math.max(1, comments));
  return Math.min(100, Math.round((raw / 5) * 100));
}

// ---------- 소스별 수집 ----------

async function issueFromGoogleNewsKR() {
  const xml = await fetchText("https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko");
  const items = parseRss(xml);
  if (!items.length) return null;
  const top = items[0];
  const related = relatedFromDescription(top.description, top.title);
  const tone = toneOf([top.title, ...related.map((r) => r.title)]);
  return {
    category: "국내",
    categoryEn: "korea",
    title: top.title.replace(/\s+-\s+[^-]+$/, ""),
    url: top.link,
    source: top.source || "Google News",
    related,
    metrics: { kind: "coverage", value: 1 + related.length, unit: "개 매체 보도" },
    engagement: coverageEngagement(1 + related.length),
    tone,
  };
}

async function issueFromReddit() {
  const subs = ["worldnews", "news"];
  for (const sub of subs) {
    try {
      const j = await fetchJson(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=10&raw_json=1`);
      const posts = (j?.data?.children || [])
        .map((c) => c.data)
        .filter((p) => p && !p.stickied && !p.over_18);
      if (!posts.length) continue;
      const top = posts[0];
      const related = posts.slice(1, 4).map((p) => ({
        title: p.title,
        url: `https://www.reddit.com${p.permalink}`,
      }));
      const tone = toneOf([top.title, ...related.map((r) => r.title)]);
      return {
        category: "글로벌",
        categoryEn: "global",
        title: top.title,
        url: top.url && top.url.startsWith("http") ? top.url : `https://www.reddit.com${top.permalink}`,
        discussionUrl: `https://www.reddit.com${top.permalink}`,
        source: `r/${sub}`,
        related,
        metrics: { kind: "reddit", score: top.score, comments: top.num_comments, value: top.score, unit: "업보트" },
        engagement: engagement(top.score, top.num_comments),
        tone,
      };
    } catch {
      // 다음 서브레딧 시도
    }
  }
  // Reddit 차단 시 Google News 세계 뉴스로 대체
  try {
    const xml = await fetchText("https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko");
    const items = parseRss(xml);
    if (!items.length) return null;
    const top = items[0];
    const related = relatedFromDescription(top.description, top.title);
    const tone = toneOf([top.title, ...related.map((r) => r.title)]);
    return {
      category: "글로벌",
      categoryEn: "global",
      title: top.title.replace(/\s+-\s+[^-]+$/, ""),
      url: top.link,
      source: top.source || "Google News",
      related,
      metrics: { kind: "coverage", value: 1 + related.length, unit: "개 매체 보도" },
      engagement: coverageEngagement(1 + related.length),
      tone,
    };
  } catch {
    return null;
  }
}

async function issueFromHackerNews() {
  const j = await fetchJson("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=15");
  const hits = (j?.hits || []).filter((h) => h.title);
  if (!hits.length) return null;
  hits.sort((a, b) => (b.points || 0) - (a.points || 0));
  const top = hits[0];
  const related = hits.slice(1, 4).map((h) => ({
    title: h.title,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
  }));
  const tone = toneOf([top.title, ...related.map((r) => r.title)]);
  return {
    category: "테크",
    categoryEn: "tech",
    title: top.title,
    url: top.url || `https://news.ycombinator.com/item?id=${top.objectID}`,
    discussionUrl: `https://news.ycombinator.com/item?id=${top.objectID}`,
    source: "Hacker News",
    related,
    metrics: { kind: "hn", score: top.points || 0, comments: top.num_comments || 0, value: top.points || 0, unit: "포인트" },
    engagement: engagement(top.points || 0, top.num_comments || 0),
    tone,
  };
}

// ---------- 메인 ----------

async function main() {
  const date = kstDateString();
  console.log(`[collect] ${date} 이슈 수집 시작`);

  const results = await Promise.allSettled([
    issueFromGoogleNewsKR(),
    issueFromReddit(),
    issueFromHackerNews(),
  ]);

  const issues = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) issues.push(r.value);
    else if (r.status === "rejected") console.error("  소스 실패:", r.reason?.message || r.reason);
  }
  if (!issues.length) throw new Error("수집된 이슈가 없습니다.");

  issues.forEach((it, i) => {
    it.id = `${date}-${it.categoryEn}`;
    it.rank = i + 1;
  });

  const doc = { date, generatedAt: new Date().toISOString(), issues };

  await mkdir(ARCHIVE_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "latest.json"), JSON.stringify(doc, null, 2), "utf8");
  await writeFile(path.join(ARCHIVE_DIR, `${date}.json`), JSON.stringify(doc, null, 2), "utf8");

  // 아카이브 인덱스 갱신
  const indexPath = path.join(DATA_DIR, "index.json");
  let dates = [];
  if (existsSync(indexPath)) {
    try { dates = JSON.parse(await readFile(indexPath, "utf8")).dates || []; } catch {}
  }
  if (!dates.includes(date)) dates.push(date);
  dates.sort().reverse();
  await writeFile(indexPath, JSON.stringify({ dates }, null, 2), "utf8");

  console.log(`[collect] 완료 — 이슈 ${issues.length}건:`);
  for (const it of issues) console.log(`  [${it.category}] ${it.title}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
