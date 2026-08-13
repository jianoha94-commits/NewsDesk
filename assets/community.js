// 자이노하뉴스데스크 — 커뮤니티 (Firebase + 구글 로그인)
// 구글 로그인 · 닉네임 · 댓글 · 글별 좋아요/싫어요.
// 개인정보 최소화: 저장하는 것은 uid + 닉네임 + 글 내용뿐. IP·이메일은 저장하지 않는다.
//
// config.js 의 firebase.enabled 가 true 이고 값이 채워졌을 때만 동작한다.

(function () {
  const CDN = "https://www.gstatic.com/firebasejs/10.12.5";
  const $ = (s, el = document) => el.querySelector(s);

  let fb = null;      // { auth, db, api } 로드된 Firebase
  let ME = null;      // { uid, nickname } 현재 로그인 사용자
  let LANG = "ko";
  let unsubComments = null;

  const t = (k) => (window.ZND_I18N?.[LANG] || {})[k] ?? k;
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };

  // 외부(app.js)에서 호출
  window.ZND_initCommunity = async function (lang) {
    LANG = lang || "ko";
    const cfg = window.ZND_CONFIG?.firebase;
    const setup = $("#community-setup");
    const composer = $("#composer");

    if (!cfg?.enabled || !cfg.apiKey || !cfg.projectId) {
      if (setup) setup.hidden = false;      // 설정 전: 안내문 표시
      if (composer) composer.hidden = true;
      return;
    }
    if (setup) setup.hidden = true;

    try {
      await loadFirebase(cfg);
    } catch (e) {
      console.error("Firebase 로드 실패", e);
      if (setup) { setup.hidden = false; setup.querySelector("p").textContent = "커뮤니티를 불러오지 못했습니다."; }
      return;
    }

    fb.api.onAuthStateChanged(fb.auth, async (user) => {
      if (user) {
        const nickname = await ensureUserProfile(user);
        ME = { uid: user.uid, nickname };
      } else {
        ME = null;
      }
      renderAuthArea();
      renderComposer();
    });

    subscribeComments();
  };

  // 언어 전환 시 재렌더
  window.ZND_communitySetLang = function (lang) {
    LANG = lang;
    renderAuthArea();
    renderComposer();
  };

  async function loadFirebase(cfg) {
    if (fb) return;
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
    const app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId,
    });
    fb = {
      auth: auth.getAuth(app),
      db: fs.getFirestore(app),
      api: {
        GoogleAuthProvider: auth.GoogleAuthProvider,
        signInWithPopup: auth.signInWithPopup,
        signOut: auth.signOut,
        onAuthStateChanged: auth.onAuthStateChanged,
        doc: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc, deleteDoc: fs.deleteDoc,
        collection: fs.collection, addDoc: fs.addDoc, getDocs: fs.getDocs,
        query: fs.query, orderBy: fs.orderBy, limit: fs.limit,
        onSnapshot: fs.onSnapshot, serverTimestamp: fs.serverTimestamp,
        runTransaction: fs.runTransaction,
      },
    };
  }

  // ---------- 사용자 프로필 / 닉네임 ----------

  async function ensureUserProfile(user) {
    const { doc, getDoc } = fb.api;
    const snap = await getDoc(doc(fb.db, "users", user.uid));
    if (snap.exists() && snap.data().nickname) return snap.data().nickname;
    return await promptNickname(user);
  }

  function promptNickname(user) {
    return new Promise((resolve) => {
      const suggested = (user.displayName || "user").replace(/\s+/g, "").slice(0, 16);
      const area = $("#auth-area");
      area.innerHTML = `
        <form class="nick-form">
          <input class="nick-input" maxlength="20" minlength="2" placeholder="${esc(t("nicknamePlaceholder"))}" value="${esc(suggested)}" required>
          <button class="btn-primary" type="submit">${esc(t("nicknameSave"))}</button>
          <span class="nick-error" hidden></span>
        </form>`;
      const form = $(".nick-form", area);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = $(".nick-input", area).value.trim();
        const err = $(".nick-error", area);
        if (name.length < 2) { err.hidden = false; err.textContent = t("nicknameTooShort"); return; }
        try {
          await claimNickname(user.uid, name);
          resolve(name);
        } catch (ex) {
          err.hidden = false;
          err.textContent = ex.message === "TAKEN" ? t("nicknameTaken") : t("nicknameError");
        }
      });
    });
  }

  // 닉네임 고유성 보장 (트랜잭션): nicknames/{lower} 를 선점 + users/{uid} 저장
  async function claimNickname(uid, name) {
    const { doc, runTransaction, serverTimestamp } = fb.api;
    const key = name.toLowerCase();
    await runTransaction(fb.db, async (tx) => {
      const nickRef = doc(fb.db, "nicknames", key);
      const nickSnap = await tx.get(nickRef);
      if (nickSnap.exists() && nickSnap.data().uid !== uid) throw new Error("TAKEN");
      tx.set(nickRef, { uid });
      tx.set(doc(fb.db, "users", uid), { nickname: name, createdAt: serverTimestamp() });
    });
  }

  // ---------- 로그인 영역 ----------

  function renderAuthArea() {
    const area = $("#auth-area");
    if (!area) return;
    if (ME) {
      area.innerHTML = `
        <span class="me-badge">👤 ${esc(ME.nickname)}</span>
        <button class="ghost-btn" id="logout-btn">${esc(t("authLogout"))}</button>`;
      $("#logout-btn", area).onclick = () => fb.api.signOut(fb.auth);
    } else {
      area.innerHTML = `<button class="btn-primary" id="login-btn">${esc(t("authLogin"))}</button>`;
      $("#login-btn", area).onclick = async () => {
        try {
          await fb.api.signInWithPopup(fb.auth, new fb.api.GoogleAuthProvider());
        } catch (e) { console.error(e); }
      };
    }
  }

  // ---------- 작성창 ----------

  function renderComposer() {
    const c = $("#composer");
    if (!c) return;
    if (!ME) { c.hidden = true; c.innerHTML = ""; return; }
    c.hidden = false;
    c.innerHTML = `
      <textarea class="composer-input" maxlength="1000" rows="3" placeholder="${esc(t("composerPlaceholder"))}"></textarea>
      <div class="composer-actions">
        <span class="composer-hint">${esc(t("composerHint"))}</span>
        <button class="btn-primary" id="post-btn">${esc(t("postBtn"))}</button>
      </div>`;
    $("#post-btn", c).onclick = async () => {
      const ta = $(".composer-input", c);
      const text = ta.value.trim();
      if (!text) return;
      $("#post-btn", c).disabled = true;
      try {
        const { collection, addDoc, serverTimestamp } = fb.api;
        await addDoc(collection(fb.db, "comments"), {
          uid: ME.uid, nickname: ME.nickname, text, createdAt: serverTimestamp(),
        });
        ta.value = "";
      } catch (e) { console.error(e); }
      $("#post-btn", c).disabled = false;
    };
  }

  // ---------- 댓글 목록 ----------

  function subscribeComments() {
    const { collection, query, orderBy, limit, onSnapshot } = fb.api;
    const q = query(collection(fb.db, "comments"), orderBy("createdAt", "desc"), limit(80));
    if (unsubComments) unsubComments();
    unsubComments = onSnapshot(q, (snap) => {
      const list = $("#comment-list");
      if (!list) return;
      if (snap.empty) { list.innerHTML = `<p class="comment-empty">${esc(t("commentEmpty"))}</p>`; return; }
      list.innerHTML = "";
      snap.forEach((d) => list.appendChild(commentEl(d.id, d.data())));
    }, (err) => console.error("comments", err));
  }

  function commentEl(id, data) {
    const el = document.createElement("div");
    el.className = "comment";
    const when = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString(LANG === "en" ? "en-US" : "ko-KR") : "";
    const canDelete = ME && ME.uid === data.uid;
    el.innerHTML = `
      <div class="comment-head">
        <span class="comment-nick">👤 ${esc(data.nickname || "?")}</span>
        <span class="comment-time">${esc(when)}</span>
      </div>
      <div class="comment-body">${esc(data.text)}</div>
      <div class="comment-foot">
        <button class="react-btn" data-type="like">👍 <span data-c="like">0</span></button>
        <button class="react-btn" data-type="dislike">👎 <span data-c="dislike">0</span></button>
        ${canDelete ? `<button class="react-btn del" data-del="1">${esc(t("deleteBtn"))}</button>` : ""}
      </div>`;
    loadReactions(id, el);
    for (const b of el.querySelectorAll(".react-btn[data-type]")) {
      b.onclick = () => react(id, b.dataset.type, el);
    }
    if (canDelete) $(".del", el).onclick = () => deleteComment(id);
    return el;
  }

  async function loadReactions(commentId, el) {
    const { collection, getDocs } = fb.api;
    try {
      const snap = await getDocs(collection(fb.db, "comments", commentId, "reactions"));
      let like = 0, dislike = 0, mine = null;
      snap.forEach((r) => {
        const ty = r.data().type;
        if (ty === "like") like++; else if (ty === "dislike") dislike++;
        if (ME && r.id === ME.uid) mine = ty;
      });
      $('[data-c="like"]', el).textContent = like;
      $('[data-c="dislike"]', el).textContent = dislike;
      for (const b of el.querySelectorAll(".react-btn[data-type]")) {
        b.classList.toggle("active", mine === b.dataset.type);
      }
    } catch (e) { console.error(e); }
  }

  async function react(commentId, type, el) {
    if (!ME) { alert(t("loginToReact")); return; }
    const { doc, getDoc, setDoc, deleteDoc } = fb.api;
    const ref = doc(fb.db, "comments", commentId, "reactions", ME.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().type === type) {
        await deleteDoc(ref);              // 같은 버튼 다시 누르면 취소
      } else {
        await setDoc(ref, { type });       // 새로/반대로 변경
      }
      await loadReactions(commentId, el);
    } catch (e) { console.error(e); }
  }

  async function deleteComment(id) {
    if (!confirm(t("deleteConfirm"))) return;
    try { await fb.api.deleteDoc(fb.api.doc(fb.db, "comments", id)); }
    catch (e) { console.error(e); }
  }
})();
