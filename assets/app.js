// 자이노하뉴스데스크 — 프런트엔드
// data/latest.json 을 읽어 오늘의 이슈를 렌더링하고,
// 호감도 투표는 무료 카운터 API(Abacus)로 전역 집계한다 (실패 시 이 브라우저에만 저장).

const VOTE_NS = "zainoha-newsdesk";
const VOTE_API = "https://abacus.jasoncameron.dev";

const $ = (sel, el = document) => el.querySelector(sel);

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
  });
}

// ---------- 투표 ----------

async function fetchCount(key) {
  const res = await fetch(`${VOTE_API}/get/${VOTE_NS}/${key}`);
  if (res.status === 404) return 0; // 아직 아무도 투표 안 함
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
  if (myChoice(issueId)) return null; // 이슈당 1회
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

function metricLine(m) {
  if (!m) return "";
  if (m.kind === "reddit" || m.kind === "hn") {
    return `${m.score.toLocaleString()} ${m.unit} · 댓글 ${m.comments.toLocaleString()}`;
  }
  return `${m.value.toLocaleString()}${m.unit}`;
}

function issueCard(issue) {
  const card = document.createElement("article");
  card.className = "issue-card";

  const tone = issue.tone || { score: 0, label: "중립" };
  const toneWidth = Math.min(50, Math.abs(tone.score) / 2); // -100..100 → 반쪽 0..50%
  const toneFill = tone.score >= 0
    ? `<div class="gauge-fill pos" style="width:${toneWidth}%"></div>`
    : `<div class="gauge-fill neg" style="width:${toneWidth}%"></div>`;

  const related = (issue.related || []).slice(0, 3).map(
    (r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">↳ ${esc(r.title)}</a></li>`
  ).join("");

  const discussion = issue.discussionUrl
    ? ` · <a href="${esc(issue.discussionUrl)}" target="_blank" rel="noopener">토론 보기</a>`
    : "";

  card.innerHTML = `
    <div class="issue-top">
      <span class="cat-badge ${catClass(issue.categoryEn)}">${esc(issue.category)}</span>
      <span class="issue-rank">ISSUE #${issue.rank}</span>
    </div>
    <h3 class="issue-title"><a href="${esc(issue.url)}" target="_blank" rel="noopener">${esc(issue.title)}</a></h3>
    <div class="issue-source">출처: ${esc(issue.source)} · ${metricLine(issue.metrics)}${discussion}</div>
    ${related ? `<ul class="related">${related}</ul>` : ""}
    <div class="metrics">
      <div class="meter-row">
        <span class="meter-label">관심도</span>
        <div class="meter-track"><div class="meter-fill" style="width:${issue.engagement || 0}%"></div></div>
        <span class="meter-value">${issue.engagement || 0}/100</span>
      </div>
      <div class="meter-row">
        <span class="meter-label">보도 톤</span>
        <div class="gauge-track">${toneFill}</div>
        <span class="meter-value">${esc(tone.label)}</span>
      </div>
    </div>
    <div class="vote-box">
      <div class="vote-head">
        <span class="vote-title">이 이슈, 어떻게 느끼세요?</span>
        <span class="vote-total" data-role="total"></span>
      </div>
      <div class="vote-bar" hidden>
        <div class="up"></div><div class="down"></div>
      </div>
      <div class="vote-buttons">
        <button class="vote-btn up-btn" data-dir="up">👍 좋아요 <span class="vote-count" data-role="up"></span></button>
        <button class="vote-btn down-btn" data-dir="down">👎 글쎄요 <span class="vote-count" data-role="down"></span></button>
      </div>
      <span class="vote-note" data-role="note"></span>
    </div>
  `;

  wireVotes(card, issue.id);
  return card;
}

function paintVotes(card, votes, issueId) {
  const total = votes.up + votes.down;
  $('[data-role="total"]', card).textContent = total ? `${total.toLocaleString()}명 참여` : "첫 투표를 기다립니다";
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
    $('[data-role="note"]', card).textContent = `투표 완료 — 호감도 ${pct}%`;
  }
  if (votes.global === false) {
    $('[data-role="note"]', card).textContent += " (오프라인: 이 브라우저에만 저장됨)";
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
  const grid = $("#issues");
  grid.innerHTML = "";
  for (const issue of doc.issues) grid.appendChild(issueCard(issue));
  $("#issue-count").textContent = `${doc.issues.length}건`;

  const gen = new Date(doc.generatedAt);
  $("#updated-at").textContent = `${doc.date} 발행 · ${gen.toLocaleString("ko-KR")} 수집`;
}

async function renderArchive(activeDate) {
  const wrap = $("#archive-dates");
  try {
    const res = await fetch(`data/index.json?t=${Date.now()}`);
    const { dates } = await res.json();
    if (!dates?.length) { wrap.innerHTML = '<span class="archive-empty">아직 아카이브가 없습니다.</span>'; return; }
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
    wrap.innerHTML = '<span class="archive-empty">아카이브를 불러올 수 없습니다.</span>';
  }
}

// ---------- 시작 ----------

async function main() {
  initTheme();
  $("#today-label").textContent = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  try {
    const doc = await loadDay();
    renderDay(doc);
    renderArchive(doc.date);
  } catch (e) {
    $("#issues").innerHTML = `<p class="loading">데이터를 불러오지 못했습니다. (${esc(e.message)})</p>`;
  }

  // 30분마다 최신 데이터 확인 (탭을 켜둔 채 지속 관찰용)
  setInterval(async () => {
    try { renderDay(await loadDay()); } catch {}
  }, 30 * 60 * 1000);
}

main();
