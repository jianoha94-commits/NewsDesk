// 자이노하뉴스데스크 — 프런트엔드
// data/latest.json 을 읽어 오늘의 이슈를 렌더링하고,
// 호감도 투표는 무료 카운터 API(Abacus)로 전역 집계한다 (실패 시 이 브라우저에만 저장).

const VOTE_NS = "zainoha-newsdesk";
const VOTE_API = "https://abacus.jasoncameron.dev";

const $ = (sel, el = document) => el.querySelector(sel);

let LANG = "ko";
let CURRENT_DOC = null;   // 현재 표시 중인 날짜 데이터 (언어 전환 시 재렌더용)
let CURRENT_DATE = null;  // 아카이브 활성 날짜

const t = (key) => (window.ZND_I18N[LANG] || {})[key] ?? key;

// ---------- 언어 ----------

function applyStaticLang() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const v = t(el.dataset.i18n);
    if (typeof v === "string") el.innerHTML = v;
  }
  $("#lang-toggle").textContent = t("langBtn");
  document.title = "자이노하뉴스데스크";
}

function initLang() {
  LANG = localStorage.getItem("znd-lang") || window.ZND_CONFIG?.defaultLang || "ko";
  applyStaticLang();
  $("#lang-toggle").addEventListener("click", () => {
    LANG = LANG === "ko" ? "en" : "ko";
    localStorage.setItem("znd-lang", LANG);
    applyStaticLang();
    if (CURRENT_DOC) renderDay(CURRENT_DOC);
    renderMirrors();
  });
}

// ---------- 테마 ----------

function initTheme() {
  const saved = localStorage.getItem("znd-theme");
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (preferDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("znd-theme", next);
    syncGiscusTheme(next);
  });
}

// ---------- 커뮤니티 (Giscus) ----------

function giscusTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark_dimmed" : "light";
}

function syncGiscusTheme(theme) {
  const frame = document.querySelector("iframe.giscus-frame");
  if (!frame) return;
  frame.contentWindow.postMessage(
    { giscus: { setConfig: { theme: theme === "dark" ? "dark_dimmed" : "light" } } },
    "https://giscus.app"
  );
}

function initCommunity() {
  const cfg = window.ZND_CONFIG?.giscus;
  const mount = $("#giscus-mount");
  if (!mount) return;
  if (!cfg?.enabled || !cfg.repoId || !cfg.categoryId) return;

  mount.innerHTML = "";
  const s = document.createElement("script");
  s.src = "https://giscus.app/client.js";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-repo", cfg.repo);
  s.setAttribute("data-repo-id", cfg.repoId);
  s.setAttribute("data-category", cfg.category || "General");
  s.setAttribute("data-category-id", cfg.categoryId);
  s.setAttribute("data-mapping", cfg.mapping || "pathname");
  s.setAttribute("data-strict", "0");
  s.setAttribute("data-reactions-enabled", "1");
  s.setAttribute("data-emit-metadata", "0");
  s.setAttribute("data-input-position", "top");
  s.setAttribute("data-theme", giscusTheme());
  s.setAttribute("data-lang", LANG);
  s.setAttribute("data-loading", "lazy");
  mount.appendChild(s);
}

// ---------- 미러(대체 접속 경로) ----------

function renderMirrors() {
  const wrap = $("#mirror-list");
  if (!wrap) return;
  const mirrors = (window.ZND_CONFIG?.mirrors || []).slice();
  const onion = window.ZND_CONFIG?.onion;
  if (onion) mirrors.push({ label: "Tor (.onion)", url: onion });

  if (!mirrors.length) {
    wrap.innerHTML = `<p class="mirror-none">${esc(t("mirrorNone"))}</p>`;
    return;
  }
  wrap.innerHTML = mirrors.map((m) => {
    const here = location.href.startsWith(m.url);
    return `<a class="mirror-chip${here ? " here" : ""}" href="${esc(m.url)}"${here ? "" : ' target="_blank" rel="noopener"'}>
      <span class="mirror-label">${esc(m.label)}</span>
      <span class="mirror-url">${esc(m.url.replace(/^https?:\/\//, ""))}</span>
    </a>`;
  }).join("");
}

// ---------- 투표 ----------

async function fetchCount(key) {
  const res = await fetch(`${VOTE_API}/get/${VOTE_NS}/${key}`);
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`vote api ${res.status}`);
  return (await res.json()).value ?? 0;
}

async function hitCount(key) {
  const res = await fetch(`${VOTE_API}/hit/${VOTE_NS}/${key}`);
  if (!res.ok) throw new Error(`vote api ${res.status}`);
  return (await res.json()).value ?? 0;
}

function localVotes(issueId) {
  try { return JSON.parse(localStorage.getItem(`znd-local-votes-${issueId}`)) || { up: 0, down: 0 }; }
  catch { return { up: 0, down: 0 }; }
}

function myChoice(issueId) { return localStorage.getItem(`znd-voted-${issueId}`); }

async function getVotes(issueId) {
  try {
    const [up, down] = await Promise.all([
      fetchCount(`${issueId}-up`),
      fetchCount(`${issueId}-down`),
    ]);
    return { up, down, global: true };
  } catch {
    const v = localVotes(issueId);
    return { ...v, global: false };
  }
}

async function castVote(issueId, dir) {
  if (myChoice(issueId)) return null;
  localStorage.setItem(`znd-voted-${issueId}`, dir);
  try {
    await hitCount(`${issueId}-${dir}`);
    return getVotes(issueId);
  } catch {
    const v = localVotes(issueId);
    v[dir] += 1;
    localStorage.setItem(`znd-local-votes-${issueId}`, JSON.stringify(v));
    return { ...v, global: false };
  }
}

// ---------- 렌더링 ----------

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function catClass(en) {
  return { korea: "cat-korea", global: "cat-global", tech: "cat-tech" }[en] || "cat-korea";
}

function catLabel(issue) {
  if (LANG === "en") return { korea: "KOREA", global: "GLOBAL", tech: "TECH" }[issue.categoryEn] || issue.category;
  return issue.category;
}

function toneLabel(tone) {
  const s = tone?.score ?? 0;
  if (s > 20) return t("tonePos");
  if (s < -20) return t("toneNeg");
  return t("toneNeutral");
}

function metricLine(m) {
  if (!m) return "";
  if (m.kind === "reddit" || m.kind === "hn") {
    const unit = LANG === "en" ? (m.kind === "hn" ? "points" : "upvotes") : m.unit;
    const cmt = LANG === "en" ? "comments" : "댓글";
    return `${m.score.toLocaleString()} ${unit} · ${cmt} ${m.comments.toLocaleString()}`;
  }
  return `${m.value.toLocaleString()}${t("coverageUnit")}`;
}

function issueCard(issue) {
  const card = document.createElement("article");
  card.className = "issue-card";

  const tone = issue.tone || { score: 0, label: "중립" };
  const toneWidth = Math.min(50, Math.abs(tone.score) / 2);
  const toneFill = tone.score >= 0
    ? `<div class="gauge-fill pos" style="width:${toneWidth}%"></div>`
    : `<div class="gauge-fill neg" style="width:${toneWidth}%"></div>`;

  const related = (issue.related || []).slice(0, 3).map(
    (r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">↳ ${esc(r.title)}</a></li>`
  ).join("");

  const discussion = issue.discussionUrl
    ? ` · <a href="${esc(issue.discussionUrl)}" target="_blank" rel="noopener">${esc(t("discussion"))}</a>`
    : "";

  card.innerHTML = `
    <div class="issue-top">
      <span class="cat-badge ${catClass(issue.categoryEn)}">${esc(catLabel(issue))}</span>
      <span class="issue-rank">ISSUE #${issue.rank}</span>
    </div>
    <h3 class="issue-title"><a href="${esc(issue.url)}" target="_blank" rel="noopener">${esc(issue.title)}</a></h3>
    <div class="issue-source">${esc(t("source"))}: ${esc(issue.source)} · ${metricLine(issue.metrics)}${discussion}</div>
    ${related ? `<ul class="related">${related}</ul>` : ""}
    <div class="metrics">
      <div class="meter-row">
        <span class="meter-label">${esc(t("engagement"))}</span>
        <div class="meter-track"><div class="meter-fill" style="width:${issue.engagement || 0}%"></div></div>
        <span class="meter-value">${issue.engagement || 0}/100</span>
      </div>
      <div class="meter-row">
        <span class="meter-label">${esc(t("tone"))}</span>
        <div class="gauge-track">${toneFill}</div>
        <span class="meter-value">${esc(toneLabel(tone))}</span>
      </div>
    </div>
    <div class="vote-box">
      <div class="vote-head">
        <span class="vote-title">${esc(t("voteQ"))}</span>
        <span class="vote-total" data-role="total"></span>
      </div>
      <div class="vote-bar" hidden>
        <div class="up"></div><div class="down"></div>
      </div>
      <div class="vote-buttons">
        <button class="vote-btn up-btn" data-dir="up">${esc(t("voteUp"))} <span class="vote-count" data-role="up"></span></button>
        <button class="vote-btn down-btn" data-dir="down">${esc(t("voteDown"))} <span class="vote-count" data-role="down"></span></button>
      </div>
      <span class="vote-note" data-role="note"></span>
    </div>
  `;

  wireVotes(card, issue.id);
  return card;
}

function paintVotes(card, votes, issueId) {
  const total = votes.up + votes.down;
  $('[data-role="total"]', card).textContent = total ? t("voteJoin")(total) : t("voteFirst");
  $('[data-role="up"]', card).textContent = votes.up ? votes.up.toLocaleString() : "";
  $('[data-role="down"]', card).textContent = votes.down ? votes.down.toLocaleString() : "";

  const bar = $(".vote-bar", card);
  if (total > 0) {
    bar.hidden = false;
    $(".up", bar).style.width = `${(votes.up / total) * 100}%`;
    $(".down", bar).style.width = `${(votes.down / total) * 100}%`;
  }

  const choice = myChoice(issueId);
  if (choice) {
    for (const btn of card.querySelectorAll(".vote-btn")) {
      btn.disabled = true;
      if (btn.dataset.dir === choice) btn.classList.add("chosen");
    }
    const pct = total ? Math.round((votes.up / total) * 100) : 0;
    $('[data-role="note"]', card).textContent = t("voteDone")(pct);
  }
  if (votes.global === false) {
    $('[data-role="note"]', card).textContent += t("voteOffline");
  }
}

function wireVotes(card, issueId) {
  getVotes(issueId).then((v) => paintVotes(card, v, issueId));
  for (const btn of card.querySelectorAll(".vote-btn")) {
    btn.addEventListener("click", async () => {
      const v = await castVote(issueId, btn.dataset.dir);
      if (v) paintVotes(card, v, issueId);
    });
  }
}

// ---------- 데이터 로드 ----------

async function loadDay(date) {
  const url = date ? `data/archive/${date}.json` : "data/latest.json";
  const res = await fetch(`${url}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`데이터 로드 실패 (${res.status})`);
  return res.json();
}

function renderDay(doc) {
  CURRENT_DOC = doc;
  const grid = $("#issues");
  grid.innerHTML = "";
  for (const issue of doc.issues) grid.appendChild(issueCard(issue));
  $("#issue-count").textContent = t("countUnit")(doc.issues.length);

  const gen = new Date(doc.generatedAt);
  const locale = LANG === "en" ? "en-US" : "ko-KR";
  $("#updated-at").textContent = t("published")(doc.date, gen.toLocaleString(locale));
}

async function renderArchive(activeDate) {
  CURRENT_DATE = activeDate;
  const wrap = $("#archive-dates");
  try {
    const res = await fetch(`data/index.json?t=${Date.now()}`);
    const { dates } = await res.json();
    if (!dates?.length) { wrap.innerHTML = `<span class="archive-empty">${esc(t("noArchive"))}</span>`; return; }
    wrap.innerHTML = "";
    for (const d of dates) {
      const chip = document.createElement("button");
      chip.className = "date-chip" + (d === activeDate ? " active" : "");
      chip.textContent = d;
      chip.addEventListener("click", async () => {
        try {
          renderDay(await loadDay(d));
          renderArchive(d);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) { console.error(e); }
      });
      wrap.appendChild(chip);
    }
  } catch {
    wrap.innerHTML = `<span class="archive-empty">${esc(t("noArchive"))}</span>`;
  }
}

// ---------- 시작 ----------

async function main() {
  initLang();
  initTheme();
  renderMirrors();

  $("#today-label").textContent = new Date().toLocaleDateString(LANG === "en" ? "en-US" : "ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  try {
    const doc = await loadDay();
    renderDay(doc);
    renderArchive(doc.date);
  } catch (e) {
    $("#issues").innerHTML = `<p class="loading">${esc(e.message)}</p>`;
  }

  initCommunity();

  setInterval(async () => {
    try { renderDay(await loadDay(CURRENT_DATE || undefined)); } catch {}
  }, 30 * 60 * 1000);
}

main();
