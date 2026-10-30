(() => {
"use strict";

/* ---------- veri ---------- */
const TEMPLATES = window.FISLIK_TEMPLATES || [];
const STORIES = (window.FISLIK_STORIES || {}).stories || [];
const LEXICON = (window.FISLIK_STORIES || {}).lexicon || {};
const LEVELS = { A1: "Başlangıç", A2: "Temel", B1: "Orta", B2: "Orta üstü", C1: "İleri" };
const STORY_DECK_NAME = "Hikâye kelimeleri";
const STORY_DECK_KEY = "fislik.storyDeck";
const NEW_PER_SESSION = 20;   // bir oturumda en fazla kaç yeni kart
const QUOTES = [
  ["The limits of my language mean the limits of my world.", "Ludwig Wittgenstein"],
  ["Damlaya damlaya göl olur.", "Atasözü"],
  ["Bir lisan bir insan, iki lisan iki insan.", "Atasözü"],
  ["Learning never exhausts the mind.", "Leonardo da Vinci"],
  ["It does not matter how slowly you go as long as you do not stop.", "Konfüçyüs'e atfedilir"],
  ["Repetition is the mother of learning.", "Latin atasözü"],
  ["İlim ilim bilmektir, ilim kendin bilmektir.", "Yunus Emre"],
  ["To have another language is to possess a second soul.", "Şarlman'a atfedilir"],
  ["Hayatta en hakiki mürşit ilimdir.", "Mustafa Kemal Atatürk"],
  ["Well begun is half done.", "Aristoteles"],
];
const DEVELOPER = "Yusuf Korkmazyiğit";

/* ---------- yardımcılar ---------- */
const DAY = 86400000;
const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 10) + now().toString(36).slice(-4);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STATUS = {
  new:      { label: "Yeni",        cls: "c-new"  },
  unknown:  { label: "Bilmiyorum",  cls: "c-bad"  },
  learning: { label: "Öğreniyorum", cls: "c-mid"  },
  known:    { label: "Öğrendim",    cls: "c-good" },
};
const ORDER = ["unknown", "learning", "new", "known"];
const inClaude = !!(window.claude && window.claude.use);
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function makeCard(o, i = 0){ return { id: uid(), en: String(o.en||"").trim(), pos: String(o.pos||"").trim(), tr: String(o.tr||"").trim(), def: String(o.def||"").trim(), ex: String(o.ex||"").trim(), extr: String(o.extr||"").trim(), status: "new", interval: 0, due: 0, seen: 0, added: now() + i }; }
function counts(cards){ const c = {new:0,unknown:0,learning:0,known:0}; cards.forEach(k => c[k.status]++); return c; }
// Bilmiyorum: her çalışmada gelir · Öğreniyorum: ertesi gün gelir · Öğrendim: artık gösterilmez (listeden istenirse tekrar edilir)
const isReview = k => (k.status === "unknown" || k.status === "learning") && (k.due || 0) <= now();
function todayCount(cards){ return cards.filter(isReview).length + Math.min(NEW_PER_SESSION, cards.filter(k => k.status === "new").length); }
function quoteOfDay(){ const d = Math.floor(now() / DAY); return QUOTES[d % QUOTES.length]; }
function toast(msg, ms = 2800){
  const r = document.getElementById("toastRoot"); r.innerHTML = "";
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); t.textContent = msg; r.appendChild(t);
  clearTimeout(toast._t); toast._t = setTimeout(() => t.remove(), ms);
}

/* ---------- çalışma günlüğü: seri, günlük hedef, takvim ---------- */
const ACT_KEY = "fislik.activity.v1";
const GOALS = [10, 15, 20, 25, 30, 40, 50];
const HARD_MIN = 2;   // en az kaç kez "Bilmiyorum" denince zorlanılan sayılır
let activity = { days: {}, goal: 20, best: 0, reads: {} };
try { const a = JSON.parse(localStorage.getItem(ACT_KEY) || "null"); if (a && typeof a.days === "object") activity = { days: a.days, goal: GOALS.includes(a.goal) ? a.goal : 20, best: a.best || 0, reads: a.reads || {} }; } catch {}
function saveActivity(){ try { localStorage.setItem(ACT_KEY, JSON.stringify(activity)); } catch {} }
// yerel saate göre gün anahtarı; öğlen sabitlenir ki yaz saati geçişinde gün kaymasın
function noon(t = now()){ const d = new Date(t); d.setHours(12, 0, 0, 0); return d; }
function dayKey(d = noon()){ return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function streak(){
  const d = noon(), todayDone = !!activity.days[dayKey(d)];
  if (!todayDone) d.setDate(d.getDate() - 1);   // bugün henüz çalışılmadıysa seri dünden sayılır, bozulmuş sayılmaz
  let len = 0; while (activity.days[dayKey(d)]) { len++; d.setDate(d.getDate() - 1); }
  return { len, todayDone };
}
function logReview(){
  const k = dayKey(); activity.days[k] = (activity.days[k] || 0) + 1;
  activity.best = Math.max(activity.best, streak().len);
  saveActivity();
}
/* ---------- hedef: band, sınav türü, sınav tarihi ---------- */
const PLAN_KEY = "fislik.plan.v1";
const BANDS = ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"];
let plan = null;   // { band: "7.0", type: "academic" | "general", date: "2026-12-12" | "" } ya da { skipped: true }
try { plan = JSON.parse(localStorage.getItem(PLAN_KEY) || "null"); } catch {}
let planEditing = false;
function savePlan(){ try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch {} }
const hasPlan = () => !!(plan && plan.band);
function daysLeft(){
  if (!hasPlan() || !plan.date) return null;
  const [y, m, d] = plan.date.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d, 12) - noon()) / DAY);
}
// hedef banda göre öneriler: desteler, hikâye seviyesi, günlük kart sayısı
function recommend(){
  // hedef girilmemişse orta seviyeden (B1) başla; C1 yeni başlayan biri için fazla zor olabilir
  const b = hasPlan() ? parseFloat(plan.band) : 6;
  const rec = b <= 5.5 ? { decks: ["a2", "b1"], level: "B1", goal: 15 }
            : b <= 6.0 ? { decks: ["b1", "b2"], level: "B1", goal: 20 }
            : b <= 6.5 ? { decks: ["b2", "topic"], level: "B2", goal: 20 }
            : b <= 7.0 ? { decks: ["b2", "ielts-c1", "topic"], level: "C1", goal: 25 }
            : b <= 7.5 ? { decks: ["ielts-c1", "b2", "topic"], level: "C1", goal: 30 }
            :            { decks: ["ielts-c1", "topic"], level: "C1", goal: 40 };
  const left = daysLeft();
  rec.rush = left !== null && left >= 0 && left <= 30;   // son bir ay: biraz daha fazla kart
  if (rec.rush) rec.goal = Math.min(50, rec.goal + 10);
  return rec;
}
const isRecDeck = t => { const r = recommend().decks; return r.includes(t.key) || (t.kind === "topic" && r.includes("topic")); };
function nextStory(){
  const lv = recommend().level;
  return STORIES.find(s => s.level === lv && !quizBest[s.id]) || STORIES.find(s => !quizBest[s.id]) || null;
}

function lastDays(n){ const d = noon(); let sum = 0; for (let i = 0; i < n; i++) { sum += activity.days[dayKey(d)] || 0; d.setDate(d.getDate() - 1); } return sum; }

/* ---------- depolama: Claude içinde hesaba, dışarıda tarayıcıya ---------- */
const LS_KEY = "fislik.decks.v1";
const store = {
  decks: {}, mode: "local", col: null, timers: {}, failed: false,
  loadLocal(){ try { this.decks = JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch { this.decks = {}; } },
  saveLocal(){ try { localStorage.setItem(LS_KEY, JSON.stringify(this.decks)); } catch { if (!this.failed) { this.failed = true; toast("Tarayıcı depolaması dolu ya da kapalı. Yedek alman iyi olur."); } } },
  async connect(){
    if (!inClaude) return;
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      this.col = db.collection("data/users/" + id);
      let first = true;
      this.col.onSnapshot(snap => {
        const remote = {};
        snap.docs.forEach(d => { if (d.exists) remote[d.id] = JSON.parse(JSON.stringify(d.data())); });
        if (first) {
          first = false; this.mode = "db";
          Object.keys(this.decks).forEach(k => { if (!remote[k]) { remote[k] = this.decks[k]; this.push(k); } });
        }
        Object.keys(this.timers).forEach(k => { if (this.decks[k]) remote[k] = this.decks[k]; });
        this.decks = remote; this.saveLocal(); render();
      }, () => { this.mode = "local"; render(); });
    } catch { /* yerelde kal */ }
  },
  push(id){
    if (!this.col) return;
    clearTimeout(this.timers[id]);
    this.timers[id] = setTimeout(async () => {
      const deck = this.decks[id];
      try {
        if (deck) await this.col.doc(id).set(deck); else await this.col.doc(id).delete();
      } catch (e) {
        if (e && e.code === "quota_exceeded") toast("Depolama alanı doldu. Kullanmadığın bir desteyi silip tekrar dene.");
        else toast("Kayıt sunucuya gitmedi; değişiklikler bu tarayıcıda duruyor.");
      } finally { delete this.timers[id]; }
    }, 600);
  },
  save(id){ this.saveLocal(); this.push(id); },
  remove(id){ delete this.decks[id]; this.saveLocal(); this.push(id); },
};

/* ---------- isteğe bağlı: Claude ile doldur (yalnızca Claude içinde) ---------- */
let sampleFn = null;
async function initSample(){
  if (!inClaude) return;
  try { sampleFn = await window.claude.use("sample"); } catch { sampleFn = null; }
  if (view.name === "deck") render();
}
async function autofill(word){
  const prompt = `You are helping a Turkish university student prepare for IELTS (target band 7.5).
For the English word or phrase "${word}", return ONLY a JSON object with these keys:
"pos": part of speech abbreviation (n, v, adj, adv, phr v, phrase),
"tr": the most useful Turkish meaning(s), short, comma-separated,
"def": a short learner-dictionary English definition (max 15 words),
"ex": one natural academic-style example sentence (IELTS level, max 20 words),
"ex_tr": a natural Turkish translation of that example sentence.
No markdown, no extra text.`;
  return await sampleFn.json(prompt, { modelTier: "quick" });
}

/* ---------- görünüm durumu ---------- */
let view = { name: "home" };
let filter = "all";
let query = "";
let direction = "en";
let mode = "flip";          // "flip": kart çevir · "type": Türkçesini görüp İngilizcesini yaz
const PREFS_KEY = "fislik.prefs";
try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); if (p.direction === "tr") direction = "tr"; if (p.mode === "type") mode = "type"; } catch {}
function savePrefs(){ try { localStorage.setItem(PREFS_KEY, JSON.stringify({ direction, mode })); } catch {} }
let editing = null;
let session = null;
function go(v){ if (v.name !== "wpractice" && wrTimer) { stopWrTimer(); saveWr(); } if (v.name !== "rtest" && rtTimer) stopRtTimer(); view = v; editing = null; closeSheet(); window.scrollTo(0, 0); render(); }

const app = document.getElementById("app");
function render(){
  if (view.name === "deck" && !store.decks[view.id]) view = { name: "home" };
  if (view.name === "home") renderHome();
  else if (view.name === "vocab") renderVocab();
  else if (view.name === "deck") renderDeck();
  else if (view.name === "study") renderStudy();
  else if (view.name === "stories") renderStories();
  else if (view.name === "story") renderStory();
  else if (view.name === "help") renderHelp();
  else if (view.name === "writing") renderWriting();
  else if (view.name === "rtest") renderRTest();
  else if (view.name === "wtype") renderWType();
  else if (view.name === "wcrit") renderWCrit();
  else if (view.name === "wlink") renderWLink();
  else if (view.name === "wpractice") renderWPractice();
  else if (view.name === "wessay") renderWEssay();
}

function header(){
  const [q, a] = quoteOfDay();
  return `<header class="top">
    <div class="brandbox"><button class="brand" data-act="home">Fişlik <small>IELTS kelime kartları</small></button><button class="helplink" data-act="help">Nasıl kullanılır?</button></div>
    <blockquote class="quote">“${esc(q)}”<cite>${esc(a)}</cite></blockquote>
  </header>`;
}
function footer(){
  const s = store.mode === "db" ? "İlerlemen Claude hesabına kaydediliyor." : "İlerlemen bu tarayıcıda kaydediliyor.";
  return `<footer class="foot">
    <div>Geliştirici: <strong>${esc(DEVELOPER)}</strong></div>
    <div>${s}</div>
    ${inClaude ? "" : `<div class="row"><button class="btn ghost small" data-act="export">Yedeği indir</button><label class="btn ghost small" style="cursor:pointer">Yedekten yükle<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>`}
    <div>Kelime seviyeleri: CEFR-J Wordlist 1.5 (Tono Laboratory, TUFS) ve Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0). Türkçe anlamlar Fişlik için hazırlanmıştır.</div>
  </footer>`;
}
function barHTML(c, total){
  if (!total) return `<div class="bar"></div>`;
  return `<div class="bar" aria-hidden="true">${["known","learning","unknown","new"].map(s => c[s] ? `<i class="${STATUS[s].cls}" style="width:${c[s]/total*100}%"></i>` : "").join("")}</div>`;
}
function legendHTML(c){
  return `<div class="legend">${["unknown","learning","known","new"].map(s => `<span><span class="dot ${STATUS[s].cls}"></span>${STATUS[s].label} ${c[s]}</span>`).join("")}</div>`;
}

function modeSeg(){
  return `<div class="row modeseg">
    <span class="hint">Çalışma şekli:</span>
    <div class="seg" role="group" aria-label="Çalışma şekli">
      <button data-act="mode" data-v="flip" aria-pressed="${mode==="flip"}">Kart çevir</button>
      <button data-act="mode" data-v="type" aria-pressed="${mode==="type"}">Yazarak</button>
    </div>
  </div>`;
}

const MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const WDAYS = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const fmtDay = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${WDAYS[(d.getDay() + 6) % 7]}`;

function goalRowHTML(){
  const st = streak(), done = activity.days[dayKey()] || 0, goal = activity.goal;
  const pct = Math.min(100, Math.round(done / goal * 100));
  const fire = st.len
    ? `<span class="streak${st.todayDone ? "" : " cold"}" title="Üst üste çalıştığın gün sayısı">🔥 ${st.len} gün</span>${st.todayDone ? "" : `<span class="gr-note">bugün çalışırsan serin sürer</span>`}`
    : `<span class="gr-note">Bugün çalış, serin başlasın</span>`;
  return `<div class="goalrow">
    <div class="gr-top">${fire}<span class="gr-count">${done >= goal ? "Hedef tamam ✓ " : ""}${done} / ${goal} kart</span></div>
    <div class="gr-bar" role="progressbar" aria-label="Bugünkü hedef" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(done, goal)}"><i style="width:${pct}%"></i></div>
  </div>`;
}

// son 17 hafta, GitHub tarzı: sütunlar hafta, satırlar Pzt..Paz; renk o günkü tekrar sayısı (hedefe göre)
function heatmapHTML(){
  const WEEKS = 17, goal = activity.goal, today = noon();
  const start = noon(); start.setDate(today.getDate() - (today.getDay() + 6) % 7 - (WEEKS - 1) * 7);
  const level = c => !c ? 0 : c < goal / 2 ? 1 : c < goal ? 2 : c < goal * 2 ? 3 : 4;
  let cells = "", months = "", daysOn = 0, total = 0;
  for (let w = 0; w < WEEKS; w++) {
    const first = new Date(start); first.setDate(start.getDate() + w * 7);
    months += `<span>${w === 0 || first.getDate() <= 7 ? MONTHS[first.getMonth()] : ""}</span>`;
    for (let r = 0; r < 7; r++) {
      const d = new Date(first); d.setDate(first.getDate() + r);
      if (d > today) { cells += `<span class="hm-c future"></span>`; continue; }
      const c = activity.days[dayKey(d)] || 0; if (c) { daysOn++; total += c; }
      cells += `<span class="hm-c l${level(c)}${+d === +today ? " is-today" : ""}" data-tip="${fmtDay(d)}: ${c ? c + " kart" : "çalışılmadı"}"></span>`;
    }
  }
  return `<div class="hm" role="img" aria-label="Son ${WEEKS} haftada ${daysOn} gün çalıştın, toplam ${total} kart tekrar ettin.">
      <div class="hm-months" aria-hidden="true">${months}</div>
      <div class="hm-body" aria-hidden="true">
        <div class="hm-days"><span>Pzt</span><span></span><span>Çar</span><span></span><span>Cum</span><span></span><span></span></div>
        <div class="hm-grid">${cells}</div>
      </div>
    </div>
    <div class="hm-foot"><span class="hm-tip" aria-live="polite">Bir güne dokun ya da üzerine gel</span>
      <span class="hm-legend" aria-hidden="true">Az <i class="hm-c l0"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><i class="hm-c l4"></i> Çok</span></div>`;
}

function progressHTML(cards){
  const st = streak(), known = cards.filter(k => k.status === "known").length;
  const tile = (n, label) => `<div class="tile"><b>${n}</b><span>${label}</span></div>`;
  return `<h3 class="sec">İlerlemen</h3>
    <section class="progress">
      <div class="tiles">
        ${tile(`🔥 ${st.len}`, "günlük seri")}
        ${tile(activity.best, "en uzun seri")}
        ${tile(lastDays(7), "son 7 günde kart")}
        ${tile(known, "öğrendiğin kelime")}
      </div>
      ${heatmapHTML()}
      <div class="row prow">
        <span class="hint">Günlük hedef:</span>
        <div class="seg" role="group" aria-label="Günlük hedef">
          ${GOALS.map(g => `<button data-act="goal" data-v="${g}" aria-pressed="${activity.goal === g}">${g}</button>`).join("")}
        </div>
      </div>
    </section>`;
}
function hardHTML(cards){
  const hard = cards.filter(k => k.status !== "known" && (k.miss || 0) >= HARD_MIN).length;
  return `<div class="hardrow card">
      <div><div class="nm">Zorlandıkların</div><div class="ds">En az ${HARD_MIN} kez "Bilmiyorum" dediğin kelimeler. "Öğrendim" dedikçe listeden düşerler.</div></div>
      <button class="btn small" data-act="studyHard" ${hard ? "" : "disabled"}>Çalış (${hard})</button>
    </div>`;
}

/* kelime listeleri: çalışılan her kelime cevabına göre Bilmiyorum / Öğreniyorum / Öğrendim listesine taşınır */
let listTab = "unknown", listLimit = 50;
const LIST_INFO = {
  unknown: "Bu kelimeler her çalışmada karşına çıkar.",
  learning: "Bu kelimeler ertesi gün tekrar karşına çıkar.",
  known: "Bu kelimeler artık gösterilmez. Unuttuğunu düşünürsen buradan tekrar edebilirsin.",
};
function wordListsHTML(decks){
  const rows = [];
  decks.forEach(([id, d]) => (d.cards || []).forEach(k => { if (k.status !== "new") rows.push({ id, d, k }); }));
  const count = s => rows.filter(r => r.k.status === s).length;
  const cur = rows.filter(r => r.k.status === listTab).sort((a, b) => (b.k.last || 0) - (a.k.last || 0));
  return `<h3 class="sec">Kelime listelerin</h3>
    <section class="lists">
      <div class="chips" role="group" aria-label="Liste">
        ${["unknown", "learning", "known"].map(s => `<button class="chip" data-act="ltab" data-v="${s}" aria-pressed="${listTab === s}"><span class="dot ${STATUS[s].cls}"></span>${STATUS[s].label} ${count(s)}</button>`).join("")}
      </div>
      <div class="lists-head"><span class="hint">${LIST_INFO[listTab]}</span>
        <button class="btn small" data-act="studyList" ${cur.length ? "" : "disabled"}>${listTab === "known" ? "Tekrar et" : "Bu listeyi çalış"} (${cur.length})</button></div>
      ${cur.length ? `<div class="wl">${cur.slice(0, listLimit).map(({ id, d, k }) => `
        <div class="wl-row s-${k.status}">
          <div><span class="wl-en">${esc(k.en)}</span>${k.pos ? ` <span class="wl-pos">${esc(k.pos)}</span>` : ""}<div class="wl-tr">${esc(k.tr) || "—"} · <span class="hint">${esc(d.name)}</span></div></div>
          ${k.status === "known" ? `<button class="ib" data-act="unlearn" data-id="${k.id}" data-deck="${id}" title="Öğreniyorum listesine geri al">Tekrar çalış</button>` : ""}
        </div>`).join("")}</div>
        ${cur.length > listLimit ? `<button class="btn ghost small" data-act="moreList">Daha fazla göster (${cur.length - listLimit} kelime daha)</button>` : ""}`
      : `<div class="empty">Bu listede henüz kelime yok. Kartları çalışıp cevap verdikçe kelimeler buraya taşınır.</div>`}
    </section>`;
}

function renderHelp(){
  const step = (n, title, body) => `<li><h4>${title}</h4>${body}</li>`;
  app.innerHTML = header() + `
    <button class="back" data-act="home">← Ana sayfa</button>
    <h2 class="ptitle">Nasıl kullanılır?</h2>
    <p class="hint">Fişlik, IELTS kelimelerini aralıklı tekrarla öğrenmen için yapıldı: bilmediğin kelimeler sık, öğrendiklerin hiç karşına çıkmaz. Böylece zamanını bilmediklerine harcarsın.</p>
    <ol class="help">
      ${step(0, "Hedefini belirle", `<p><b>Bugün</b> sekmesinde sınav türünü (Academic / General Training), hedef band puanını ve istersen sınav tarihini gir. Fişlik buna göre günlük kart sayısı, desteler ve okuma seviyesi önerir; <b>Bugünün planı</b> listesi de her gün ne yapman gerektiğini gösterir. Uygulama üç sekmeden oluşur: <b>Bugün</b>, <b>Kelime</b>, <b>Okuma</b>.</p>`)}
      ${step(1, "Bir deste ekle", `<p><b>Kelime</b> sekmesindeki <b>Hazır şablonlar</b> bölümünden seviyene uygun bir deste (A2, B1, B2, C1) ya da bir <b>konu destesi</b> (Çevre, Eğitim…) seç ve <b>Ekle</b>'ye bas. Hedefine uygun desteler <b>Önerilen</b> diye işaretlidir. İstersen kendi desteni oluşturup kelimeleri tek tek de ekleyebilirsin.</p>`)}
      ${step(2, "Çalışmaya başla", `<p><b>Çalışmaya başla</b> sana bugün çalışman gereken kartları getirir. Her oturumda en fazla ${NEW_PER_SESSION} yeni kelime gelir. İki çalışma şekli var:</p>
        <ul><li><b>Kart çevir:</b> Kelimeyi gör, anlamını düşün, sonra kartı çevir. Arka yüzde anlam, tanım, örnek cümle ve cümlenin Türkçesi var.</li>
        <li><b>Yazarak:</b> Türkçesini görürsün, İngilizcesini yazarsın. Yazım hatalarını da yakalar; IELTS'te yazım puan kaybettirir.</li></ul>`)}
      ${step(3, "Dürüstçe cevap ver", `<p>Her karttan sonra üç seçenekten birini seç. Kelime o listeye taşınır:</p>
        <ul class="help-ans"><li><span class="dot c-bad"></span><b>Bilmiyorum:</b> Kelime her çalışmada karşına çıkar, aynı oturumun sonunda da bir kez daha gelir.</li>
        <li><span class="dot c-mid"></span><b>Öğreniyorum:</b> Kelime ertesi gün tekrar gelir.</li>
        <li><span class="dot c-good"></span><b>Öğrendim:</b> Kelime artık gösterilmez. Unutursan <b>Öğrendim</b> listesinden geri alabilirsin.</li></ul>`)}
      ${step(4, "Listelerini takip et", `<p><b>Kelime</b> sekmesindeki <b>Kelime listelerin</b> bölümünde her kelimenin hangi listede olduğunu görürsün ve istediğin listeyi ayrıca çalışabilirsin. İki kez <i>Bilmiyorum</i> dediğin kelimeler <b>Zorlandıkların</b> bölümünde toplanır.</p>`)}
      ${step(5, "Her gün biraz çalış", `<p>Günlük hedefini (10, 20, 30 ya da 50 kart) seç. Her gün çalıştıkça 🔥 serin uzar, çalışma takvimin yeşillenir. Az ama her gün çalışmak, haftada bir uzun çalışmaktan çok daha etkilidir.</p>`)}
      ${step(6, "Hikâye oku", `<p><b>Okuma</b> sekmesinde A1'den C1'e 45 hikâye var; sıradaki önerilen hikâye en üstte durur. Gerçek sınava hazırlık için aynı sekmede 3 pasaj, 40 soru ve 60 dakikalık <b>IELTS Reading testi</b> var; bitirince tahmini band puanını ve en çok zorlandığın soru tipini görürsün. Bilmediğin kelimeye dokun: Türkçesini ve cümleyi görürsün, istersen destene eklersin. Hikâyenin sonundaki <b>True / False / Not Given</b> soruları IELTS Reading'e hazırlar.</p>`)}
      ${step(6.5, "Writing pratiği yap", `<p><b>Writing</b> sekmesinde Task 2'nin beş deneme türünü, her biri için yapı şablonunu ve açıklamalı band 7+ örnek denemeyi bulursun. <b>Deneme yaz</b> ile 40 dakikalık sayaçla bir soru cevapla; bitirince kelime sayısı, paragraf, bağlaç çeşitliliği, tekrar ve akademik üslup otomatik kontrol edilir, sonra kendi değerlendirme listeni doldurursun. Haftada en az iki deneme hedefle.</p>`)}
      ${step(7, "İlerlemeni koru", `<p>İlerlemen bu tarayıcıda saklanır. Başka bir cihaza geçmek ya da yedek almak için sayfanın en altındaki <b>Yedeği indir</b> ve <b>Yedekten yükle</b> düğmelerini kullan. Telefonda tarayıcı menüsünden <b>Ana ekrana ekle</b> dersen Fişlik uygulama gibi açılır ve internetsiz de çalışır.</p>`)}
    </ol>
    <h3 class="sec">Klavye kısayolları</h3>
    <p class="hint"><b>Boşluk</b> kartı çevirir · <b>1</b> Bilmiyorum · <b>2</b> Öğreniyorum · <b>3</b> Öğrendim · Yazarak modda <b>Enter</b> önce kontrol eder, sonra önerilen cevabı seçer · <b>Esc</b> çalışmadan çıkar.</p>
    <div style="margin-top:20px"><button class="btn hl" data-act="home">Başlayalım</button></div>
  ` + footer();
}

function navHTML(active){
  const tab = (act, label) => `<button data-act="${act}" ${active === act ? 'aria-current="page"' : ""}>${label}</button>`;
  return `<nav class="tabs" aria-label="Bölümler">${tab("home", "Bugün")}${tab("vocab", "Kelime")}${tab("stories", "Okuma")}${WR ? tab("writing", "Writing") : ""}</nav>`;
}

function planFormHTML(){
  const p = hasPlan() ? plan : { band: "7.0", type: "academic", date: "" };
  return `<form class="plancard planform" data-form="plan">
    <div class="pc-title">🎯 Hedefini belirle</div>
    <p class="hint">Hedefine göre günlük kart sayısı, desteler ve okuma seviyesi önerilir. İstediğin zaman değiştirebilirsin.</p>
    <div class="pf-grid">
      <label>Sınav türü<select name="type">
        <option value="academic" ${p.type !== "general" ? "selected" : ""}>Academic</option>
        <option value="general" ${p.type === "general" ? "selected" : ""}>General Training</option></select></label>
      <label>Hedef band<select name="band">${BANDS.map(b => `<option ${b === p.band ? "selected" : ""}>${b}</option>`).join("")}</select></label>
      <label>Sınav tarihi (isteğe bağlı)<input type="date" name="date" value="${esc(p.date || "")}" min="${dayKey()}"></label>
    </div>
    <div class="row">
      <button class="btn hl" type="submit">Kaydet</button>
      <button class="btn ghost" type="button" data-act="${hasPlan() ? "planCancel" : "planSkip"}">${hasPlan() ? "Vazgeç" : "Şimdilik geç"}</button>
    </div>
  </form>`;
}

function planCardHTML(){
  if (planEditing || !plan) return planFormHTML();
  if (!hasPlan()) return `<div class="plan-mini"><button class="helplink" data-act="planEdit">🎯 Hedef belirle: band ve sınav tarihine göre öneri al</button></div>`;
  const left = daysLeft(), rec = recommend();
  const when = left === null ? "Sınav tarihi belirlenmedi"
             : left > 1 ? `Sınava <b>${left} gün</b> var` : left === 1 ? "Sınav <b>yarın</b>. Başarılar!" : left === 0 ? "Sınav <b>bugün</b>. Başarılar!" : "Sınav tarihin geçti. Yeni tarih girebilirsin.";
  return `<section class="plancard">
    <div class="pc-top">
      <div><div class="pc-title">🎯 ${plan.type === "general" ? "General Training" : "Academic"} · Band ${esc(plan.band)}</div><div class="pc-sub">${when}</div></div>
      <button class="ib" data-act="planEdit">Düzenle</button>
    </div>
    ${activity.goal !== rec.goal ? `<div class="pc-rec"><span>Hedefine göre önerilen günlük kart: <b>${rec.goal}</b>${rec.rush ? " (sınava bir aydan az kaldı)" : ""} · şu an ${activity.goal}</span>
      <button class="btn small" data-act="applyGoal" data-v="${rec.goal}">Uygula</button></div>` : ""}
  </section>`;
}

function todayPlanHTML(all, due){
  const done = activity.days[dayKey()] || 0, goal = activity.goal;
  const read = activity.reads[dayKey()] || 0, ns = nextStory();
  const item = (ok, title, sub, btn) => `<li class="tp-item${ok ? " ok" : ""}"><span class="tp-check" aria-hidden="true">${ok ? "✓" : ""}</span>
    <div><div class="nm">${title}</div><div class="ds">${sub}</div></div>${ok ? `<span class="added">Tamam</span>` : btn}</li>`;
  return `<h3 class="sec">Bugünün planı</h3>
    <ol class="todayplan">
      ${item(done >= goal, "Kelime", all.length ? `${done} / ${goal} kart` : "Önce Kelime sekmesinden bir deste ekle",
        all.length ? `<button class="btn small" data-act="studyAll" ${due ? "" : "disabled"}>Çalış</button>` : `<button class="btn small" data-act="vocab">Deste ekle</button>`)}
      ${STORIES.length ? item(read > 0, "Okuma", read > 0 ? `Bugün ${read} hikâye bitirdin` : ns ? `Önerilen: ${esc(ns.title)} (${ns.level}) · hikâyeyi oku, soruları cevapla` : "Tüm hikâyeleri bitirdin; istediğini tekrar okuyabilirsin",
        ns ? `<button class="btn small" data-act="story" data-id="${esc(ns.id)}">Oku</button>` : `<button class="btn small" data-act="stories">Hikâyeler</button>`) : ""}
      ${WR ? item(weekEssays() >= WR_WEEKLY, "Writing", `Bu hafta ${weekEssays()} / ${WR_WEEKLY} deneme${wr.draft && !wr.draft.done && wrWords(wr.draft.text) ? " · yarım kalan bir denemen var" : ""}`,
        `<button class="btn small" data-act="${wr.draft ? "wcontinue" : "wnew"}">${wr.draft ? "Devam" : "Yaz"}</button>`) : ""}
    </ol>`;
}

function renderHome(){
  const decks = Object.entries(store.decks).sort((a,b) => (a[1].created||0) - (b[1].created||0));
  const all = decks.flatMap(([,d]) => d.cards || []);
  const due = todayCount(all);
  app.innerHTML = header() + navHTML("home") + `
    ${planCardHTML()}
    ${todayPlanHTML(all, due)}
    ${all.length ? `<section class="today">
      <div><h2>Bugün çalışılacak</h2><div class="n">${due}<span>kart</span></div></div>
      <button class="btn hl" data-act="studyAll" ${due ? "" : "disabled"}>Çalışmaya başla</button>
      ${goalRowHTML()}
    </section>
    ${modeSeg()}
    ${all.some(k => k.status === "new") ? `<div class="newinfo">Her oturumda en fazla ${NEW_PER_SESSION} yeni kelime gelir; tekrarı gelenler hep önce gösterilir.</div>` : ""}
    ${progressHTML(all)}` : `<div class="empty">Henüz deste yok. <b>Kelime</b> sekmesinden hazır bir deste ekleyerek başla.
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn small hl" data-act="vocab">Deste ekle</button><button class="btn small" data-act="help">Nasıl kullanılır?</button></div></div>`}
  ` + footer();
  // dar ekranda takvim yana kayar: en yeni haftalar görünsün
  const hm = app.querySelector(".hm"); if (hm) hm.scrollLeft = hm.scrollWidth;
}

function renderVocab(){
  const decks = Object.entries(store.decks).sort((a,b) => (a[1].created||0) - (b[1].created||0));
  const all = decks.flatMap(([,d]) => d.cards || []);
  const used = new Set(decks.map(([,d]) => d.template || (d.starter ? "paket1" : null)).filter(Boolean));
  const tplRow = t => `<div class="tpl-item${isRecDeck(t) && !used.has(t.key) ? " rec" : ""}">
        <div class="lvl${t.kind === "topic" ? " emo" : ""}">${esc(t.level)}</div>
        <div><div class="nm">${esc(t.name)}${hasPlan() && isRecDeck(t) ? ` <span class="recbadge">Önerilen</span>` : ""}</div><div class="ds">${esc(t.desc)} · ${t.cards.length} kelime</div></div>
        ${used.has(t.key) ? `<span class="added">Eklendi</span>` : `<button class="btn small" data-act="addTpl" data-key="${esc(t.key)}">Ekle</button>`}
      </div>`;
  app.innerHTML = header() + navHTML("vocab") + `
    <h3 class="sec">Destelerin</h3>
    <div class="decks">
      ${decks.length ? decks.map(([id,d]) => {
        const cs = d.cards || [], c = counts(cs), dd = todayCount(cs);
        return `<article class="deck">
          <div class="deck-head">
            <button class="deck-name" data-act="open" data-id="${id}">${esc(d.name)}</button>
            <button class="btn small" data-act="study" data-id="${id}" ${dd ? "" : "disabled"}>Çalış${dd ? ` (${dd})` : ""}</button>
          </div>
          ${barHTML(c, cs.length)}
          <div class="deck-meta">${cs.length} kart</div>
          ${legendHTML(c)}
        </article>`;
      }).join("") : `<div class="empty">Henüz deste yok. Aşağıdaki hazır şablonlardan birini ekle ya da kendi kategorini oluştur.${hasPlan() ? " Hedefine uygun olanlar <b>Önerilen</b> diye işaretli." : ""}</div>`}
    </div>
    <form class="newdeck" data-form="newdeck">
      <input type="text" name="deckname" placeholder="Yeni kategori adı (ör. Environment, Education)" maxlength="60" aria-label="Yeni kategori adı">
      <button class="btn" type="submit">Oluştur</button>
    </form>
    ${all.length ? wordListsHTML(decks) + hardHTML(all) : ""}
    ${[["Hazır şablonlar: seviye desteleri", TEMPLATES.filter(t => t.kind !== "topic")],
       ["Konu desteleri: IELTS Writing konuları", TEMPLATES.filter(t => t.kind === "topic")]].filter(([, ts]) => ts.length).map(([title, ts]) => `
    <h3 class="sec">${title}</h3>
    <div class="tpl">${ts.map(tplRow).join("")}</div>`).join("")}
  ` + footer();
}

function renderDeck(){
  const id = view.id, d = store.decks[id], cs = d.cards || [], c = counts(cs);
  const due = todayCount(cs);
  const q = query.trim().toLowerCase();
  const shown = cs.filter(k => (filter === "all" || k.status === filter) && (!q || k.en.toLowerCase().includes(q) || (k.tr||"").toLowerCase().includes(q)))
                  .sort((a,b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.added||0) - (b.added||0));
  const LIMIT = 200, list = shown.slice(0, LIMIT);
  app.innerHTML = header() + `
    <button class="back" data-act="vocab">← Destelere dön</button>
    <div class="dtitle"><input type="text" value="${esc(d.name)}" data-field="deckname" aria-label="Deste adı" maxlength="60"></div>
    ${barHTML(c, cs.length)}
    <div style="margin:8px 0 16px">${legendHTML(c)}</div>
    <div class="row">
      <button class="btn hl" data-act="study" data-id="${id}" ${due ? "" : "disabled"}>Bugünküleri çalış (${due})</button>
      <button class="btn ghost" data-act="studyEvery" data-id="${id}" ${cs.length ? "" : "disabled"}>Hepsini çalış</button>
    </div>
    ${modeSeg()}
    ${mode === "flip" ? `<div class="row" style="margin-top:10px">
      <span class="hint">Kartın ön yüzü:</span>
      <div class="seg" role="group" aria-label="Kart yönü">
        <button data-act="dir" data-v="en" aria-pressed="${direction==="en"}">İngilizce</button>
        <button data-act="dir" data-v="tr" aria-pressed="${direction==="tr"}">Türkçe</button>
      </div>
    </div>` : `<div class="hint" style="margin-top:8px">Yazarak modda Türkçesi gösterilir, İngilizcesini yazarsın.</div>`}
    ${cardForm(editing ? cs.find(k => k.id === editing) : null)}
    <input class="search" type="text" placeholder="Bu destede ara (İngilizce ya da Türkçe)" value="${esc(query)}" data-field="search" aria-label="Destede ara">
    <div class="chips" role="group" aria-label="Filtre">
      ${[["all","Hepsi "+cs.length],["unknown","Bilmiyorum "+c.unknown],["learning","Öğreniyorum "+c.learning],["known","Öğrendim "+c.known],["new","Yeni "+c.new]]
        .map(([v,l]) => `<button class="chip" data-act="filter" data-v="${v}" aria-pressed="${filter===v}">${l}</button>`).join("")}
    </div>
    <div class="list">
      ${list.length ? list.map(k => `
        <div class="item s-${k.status}">
          <div class="w">${esc(k.en)} ${k.pos ? `<span class="hint" style="font:italic 400 14px var(--word)">${esc(k.pos)}</span>` : ""}</div>
          <div class="t">${esc(k.tr) || "<i>anlam eklenmedi</i>"} · <span class="hint">${STATUS[k.status].label}</span></div>
          <div class="acts">
            <button class="ib" data-act="edit" data-id="${k.id}" aria-label="${esc(k.en)} kartını düzenle">Düzenle</button>
            <button class="ib" data-act="del" data-id="${k.id}" aria-label="${esc(k.en)} kartını sil">Sil</button>
          </div>
        </div>`).join("") : `<div class="empty">${cs.length ? "Bu filtrede kart yok." : "Bu deste boş. İlk kelimeni yukarıdan ekle."}</div>`}
      ${shown.length > LIMIT ? `<div class="empty">İlk ${LIMIT} kart gösteriliyor. Belirli bir kelimeyi bulmak için arama kutusunu kullan.</div>` : ""}
    </div>
    <div style="margin-top:34px;text-align:right"><button class="ib" data-act="delDeck" data-id="${id}">Desteyi sil</button></div>
  ` + footer();
}

function cardForm(k){
  const v = k || {en:"",pos:"",tr:"",def:"",ex:"",extr:""};
  return `<form class="addbox" data-form="card" ${k ? `data-edit="${k.id}"` : ""}>
    <strong>${k ? "Kartı düzenle" : "Yeni kelime ekle"}</strong>
    <div class="two">
      <label>İngilizce<input type="text" name="en" value="${esc(v.en)}" required maxlength="80" autocomplete="off"></label>
      <label>Tür<input type="text" name="pos" value="${esc(v.pos)}" placeholder="n, v, adj…" maxlength="12"></label>
    </div>
    <label>Türkçe anlamı<input type="text" name="tr" value="${esc(v.tr)}" maxlength="120"></label>
    <label>İngilizce tanım (isteğe bağlı)<input type="text" name="def" value="${esc(v.def)}" maxlength="200"></label>
    <label>Örnek cümle (isteğe bağlı)<textarea name="ex" maxlength="300">${esc(v.ex)}</textarea></label>
    <label>Örnek cümlenin Türkçesi (isteğe bağlı)<textarea name="extr" maxlength="300">${esc(v.extr || (k ? exTrOf(k, view.id) : ""))}</textarea></label>
    <div class="row">
      <button class="btn hl" type="submit">${k ? "Değişiklikleri kaydet" : "Kartı ekle"}</button>
      ${sampleFn ? `<button class="btn ghost" type="button" data-act="fill">Claude ile doldur</button>` : ""}
      ${k ? `<button class="btn ghost" type="button" data-act="cancelEdit">Vazgeç</button>` : ""}
    </div>
    <div class="hint" data-msg>${sampleFn ? "İngilizce kelimeyi yaz, boş alanları Claude doldursun. Sonra kendin kontrol et." : ""}</div>
  </form>`;
}

/* ---------- hikâyeler ---------- */
const WORD_RE = /\{([^}]+)\}|(\p{L}+(?:['’-]\p{L}+)*)/gu;
const SENT_RE = /[^.!?]+(?:[.!?]+["”’']*|$)\s*/g;
let storySents = [];   // açık hikâyenin cümleleri (örnek cümle için)
function glossOf(story, surface){
  let k = surface.toLowerCase().replace(/’/g, "'");
  const look = x => (story.gloss && story.gloss[x]) || LEXICON[x];
  let e = look(k);
  // iyelik eki ('s) atılır; let's, that's gibi kısaltmalar atılmaz ("let: izin vermek" yanlış olur)
  if (!e && k.endsWith("'s") && !/^(let|that|it|what|there|here|he|she|who|where)'s$/.test(k)) { k = k.slice(0, -2); e = look(k); }
  if (!e) return null;
  return e.length === 2 ? { lemma: k, pos: e[0], tr: e[1] } : { lemma: e[0], pos: e[1], tr: e[2] };
}
function wordCount(st){ return (st.text.match(/\p{L}+(?:['’-]\p{L}+)*/gu) || []).length; }
// İngilizce tırnaklar dengesizse (cümle alıntının ortasında bölündüyse) at
function cleanSentence(s){ s = s.trim(); return (s.match(/"/g) || []).length % 2 ? s.replace(/"/g, "") : s; }
function collectedLemmas(){
  const set = new Set();
  Object.values(store.decks).forEach(d => (d.cards || []).forEach(k => { if (k.from) set.add(k.en.toLowerCase()); }));
  return set;
}
function storyHTML(st){
  storySents = [];
  const have = collectedLemmas();
  return st.text.split(/\n\s*\n/).map(par => "<p>" + (par.match(SENT_RE) || []).map(sent => {
    const si = storySents.length; let plain = "", html = "", last = 0;
    for (const m of sent.matchAll(WORD_RE)) {
      const gap = sent.slice(last, m.index); plain += gap; html += esc(gap);
      const surface = m[1] || m[2], g = glossOf(st, surface);
      html += g ? `<button class="w${have.has(g.lemma.toLowerCase()) ? " got" : ""}" data-act="word" data-s="${si}" data-o="${plain.length}" data-l="${surface.length}">${esc(surface)}</button>` : esc(surface);
      plain += surface; last = m.index + m[0].length;
    }
    plain += sent.slice(last); html += esc(sent.slice(last));
    storySents.push(plain);
    return html;
  }).join("") + "</p>").join("");
}

/* hikâye soruları: IELTS Reading tarzı True / False / Not Given */
const QUIZ_KEY = "fislik.quiz.v1";
const QLABEL = { T: "True", F: "False", NG: "Not Given" };
let quizBest = {}; try { quizBest = JSON.parse(localStorage.getItem(QUIZ_KEY) || "{}") || {}; } catch {}
const quizPicks = {};   // hikâye id -> verilen cevaplar (bu oturumda)
function quizHTML(st){
  const q = st.quiz || []; if (!q.length) return "";
  const picks = quizPicks[st.id] || [], answered = picks.filter(Boolean).length;
  const score = q.reduce((n, [, a], i) => n + (picks[i] === a ? 1 : 0), 0);
  return `<section class="quiz" aria-labelledby="qz-h">
    <h3 id="qz-h">Anladın mı? <span>True / False / Not Given</span></h3>
    <p class="hint"><b>True</b>: metin bunu söylüyor · <b>False</b>: metin bunun tersini söylüyor · <b>Not Given</b>: metinde bu bilgi yok</p>
    <ol>${q.map(([stmt, ans, why], i) => {
      const p = picks[i], ok = p === ans;
      return `<li class="qz${p ? (ok ? " ok" : " bad") : ""}">
        <div class="qz-s">${esc(stmt)}</div>
        <div class="qz-b" role="group" aria-label="Cevabın">${["T", "F", "NG"].map(v =>
          `<button data-act="qz" data-i="${i}" data-v="${v}" ${p ? "disabled" : ""} class="${p && v === ans ? "is-ans" : ""}${p === v && !ok ? " is-wrong" : ""}" aria-pressed="${p === v}">${QLABEL[v]}</button>`).join("")}</div>
        ${p ? `<div class="qz-f" role="status"><b>${ok ? "Doğru ✓" : `Yanlış. Doğrusu: ${QLABEL[ans]}`}</b> ${esc(why)}</div>` : ""}
      </li>`; }).join("")}</ol>
    ${answered === q.length ? `<div class="qz-end"><b>Sonuç: ${score} / ${q.length}</b>${score === q.length ? " · Hepsi doğru!" : ""}
      <button class="btn ghost small" data-act="qzReset">Tekrar dene</button></div>` : ""}
  </section>`;
}
function answerQuiz(i, v){
  const st = STORIES.find(s => s.id === view.id); if (!st) return;
  const picks = quizPicks[st.id] || (quizPicks[st.id] = []);
  if (picks[i]) return;
  picks[i] = v;
  if (picks.filter(Boolean).length === st.quiz.length) {
    const score = st.quiz.reduce((n, [, a], k) => n + (picks[k] === a ? 1 : 0), 0);
    const prev = quizBest[st.id];
    if (!prev || score > prev.score) { quizBest[st.id] = { score, total: st.quiz.length }; try { localStorage.setItem(QUIZ_KEY, JSON.stringify(quizBest)); } catch {} }
    const dk = dayKey(); activity.reads[dk] = (activity.reads[dk] || 0) + 1; saveActivity();
  }
  // sadece soru bölümünü yenile: sayfa kaymasın, okuduğun yer kaybolmasın
  const sec = app.querySelector(".quiz"); if (sec) sec.outerHTML = quizHTML(st);
}

function renderStories(){
  const levels = [...new Set(STORIES.map(s => s.level))];
  const ns = nextStory(), recLv = recommend().level, doneN = STORIES.filter(s => quizBest[s.id]).length;
  app.innerHTML = header() + navHTML("stories") + `
    <h2 class="ptitle">Okuma</h2>
    ${readingTestsHTML()}
    <h3 class="sec">Seviyeli hikâyeler</h3>
    <p class="hint">Hepsi Fişlik için yazılmış kısa hikâyeler. Okurken bilmediğin kelimeye dokun: Türkçesini ve hikâyedeki cümleyi görürsün, istersen destene eklersin. Sondaki True / False / Not Given soruları IELTS Reading'e hazırlar. ${doneN} / ${STORIES.length} hikâyeyi bitirdin.</p>
    ${ns ? `<button class="readcard" data-act="story" data-id="${esc(ns.id)}">
      <span class="lvl">${esc(ns.level)}</span>
      <span><span class="nm">Sıradaki: ${esc(ns.title)}</span><span class="ds">${hasPlan() ? `Band ${esc(plan.band)} hedefin için önerilen seviye` : "Önerilen hikâye"} · ${wordCount(ns)} kelime · ${ns.quiz.length} soru</span></span>
      <span class="go" aria-hidden="true">→</span>
    </button>` : ""}
    ${levels.map(lv => `
      <h3 class="sec">${esc(lv)} · ${esc(LEVELS[lv] || "")}${hasPlan() && lv === recLv ? ` <span class="recbadge">Hedefine uygun</span>` : ""}</h3>
      <div class="tpl">${STORIES.filter(s => s.level === lv).map(s => `
        <button class="tpl-item storyrow" data-act="story" data-id="${esc(s.id)}">
          <span class="lvl">${esc(s.level)}</span>
          <span><span class="nm">${esc(s.title)}</span><span class="ds">${esc(s.tr)} · ${wordCount(s)} kelime${quizBest[s.id] ? ` · <span class="qz-best">✓ ${quizBest[s.id].score}/${quizBest[s.id].total}</span>` : ""}</span></span>
          <span class="go" aria-hidden="true">→</span>
        </button>`).join("")}
      </div>`).join("")}
  ` + footer();
}

function renderStory(){
  const i = STORIES.findIndex(s => s.id === view.id), st = STORIES[i];
  if (!st) return go({ name: "stories" });
  const same = STORIES.filter(s => s.level === st.level), j = same.indexOf(st);
  const prev = same[j - 1], next = same[j + 1];
  app.innerHTML = header() + `
    <button class="back" data-act="stories">← Hikâyeler</button>
    <article class="story">
      <div class="story-meta"><span class="lvl">${esc(st.level)}</span><span class="hint">${esc(st.tr)} · ${wordCount(st)} kelime</span></div>
      <h2 class="ptitle">${esc(st.title)}</h2>
      <p class="hint">Bilmediğin kelimeye dokun. Yeşil altı çizili olanlar destende zaten var.</p>
      <div class="story-text">${storyHTML(st)}</div>
    </article>
    ${quizHTML(st)}
    <nav class="row storynav">
      ${prev ? `<button class="btn ghost" data-act="story" data-id="${esc(prev.id)}">← ${esc(prev.title)}</button>` : ""}
      <span style="flex:1"></span>
      ${next ? `<button class="btn" data-act="story" data-id="${esc(next.id)}">${esc(next.title)} →</button>` : `<button class="btn" data-act="stories">Hikâyelere dön</button>`}
    </nav>
  ` + footer();
}

/* kelime paneli: #app dışında durur ki hikâye yeniden çizilmeden açılıp kapansın */
const sheetRoot = document.createElement("div");
sheetRoot.id = "sheetRoot"; document.body.appendChild(sheetRoot);
let sheet = null;   // { st, surface, g, s, o, l }
function storyDeckId(){
  let id = null; try { id = localStorage.getItem(STORY_DECK_KEY); } catch {}
  if (id && store.decks[id]) return id;
  const found = Object.entries(store.decks).find(([, d]) => d.name === STORY_DECK_NAME);
  return found ? found[0] : "__new";
}
function openSheet(btn){
  const st = STORIES.find(s => s.id === view.id); if (!st) return;
  const s = +btn.dataset.s, o = +btn.dataset.o, l = +btn.dataset.l;
  const surface = storySents[s].slice(o, o + l);
  app.querySelectorAll(".w.on").forEach(x => x.classList.remove("on")); btn.classList.add("on");
  sheet = { st, surface, g: glossOf(st, surface), s, o, l, deck: storyDeckId(), btn };
  document.body.classList.add("sheet-open");
  renderSheet();
}
function closeSheet(){
  if (!sheet) return;
  if (sheet.btn) sheet.btn.classList.remove("on");
  sheet = null; sheetRoot.innerHTML = ""; document.body.classList.remove("sheet-open");
}
function renderSheet(){
  if (!sheet) { sheetRoot.innerHTML = ""; return; }
  const { g, surface, s, o, l, deck } = sheet, sent = storySents[s];
  const ex = esc(sent.slice(0, o)) + `<mark>${esc(sent.slice(o, o + l))}</mark>` + esc(sent.slice(o + l));
  const decks = Object.entries(store.decks).sort((a, b) => (a[1].created || 0) - (b[1].created || 0));
  const hasStoryDeck = decks.some(([, d]) => d.name === STORY_DECK_NAME);
  const target = store.decks[deck];
  const dup = target && (target.cards || []).some(k => k.en.toLowerCase() === g.lemma.toLowerCase());
  const showLemma = g.lemma.toLowerCase() !== surface.toLowerCase();
  sheetRoot.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(g.lemma)} kelimesi">
    <button class="sh-x" data-sh="close" aria-label="Kapat">×</button>
    <div class="sh-head"><span class="sh-w">${esc(surface)}</span>${showLemma ? `<span class="sh-l">→ ${esc(g.lemma)}</span>` : ""}<span class="sh-p">${esc(g.pos)}</span></div>
    <div class="sh-tr">${esc(g.tr)}</div>
    <div class="sh-ex">“${ex.trim()}”</div>
    <div class="sh-ask">
      <label class="sh-q">Destene eklensin mi?
        <select data-sh="deck" aria-label="Deste">
          ${decks.map(([id, d]) => `<option value="${id}" ${id === deck ? "selected" : ""}>${esc(d.name)}</option>`).join("")}
          ${hasStoryDeck ? "" : `<option value="__new" ${deck === "__new" ? "selected" : ""}>+ Yeni deste: ${STORY_DECK_NAME}</option>`}
        </select>
      </label>
      <div class="row">
        <button class="btn hl" data-sh="add" ${dup ? "disabled" : ""}>${dup ? "Bu destede zaten var" : "Evet, ekle"}</button>
        <button class="btn ghost" data-sh="close">Hayır</button>
      </div>
    </div>
  </div>`;
}
function addFromSheet(){
  const { g, st, s } = sheet;
  let id = sheet.deck;
  if (id === "__new") { id = uid(); store.decks[id] = { name: STORY_DECK_NAME, created: now(), cards: [] }; }
  const d = store.decks[id];
  if (d.cards.some(k => k.en.toLowerCase() === g.lemma.toLowerCase())) { toast(`"${g.lemma}" bu destede zaten var.`); return; }
  d.cards.push(Object.assign(makeCard({ en: g.lemma, pos: g.pos, tr: g.tr, ex: cleanSentence(storySents[s]) }), { from: st.id }));
  store.save(id);
  try { localStorage.setItem(STORY_DECK_KEY, id); } catch {}
  const lem = g.lemma.toLowerCase();
  app.querySelectorAll(".w").forEach(b => { const x = glossOf(st, b.textContent); if (x && x.lemma.toLowerCase() === lem) b.classList.add("got"); });
  toast(`"${g.lemma}" ${d.name} destesine eklendi.`);
  closeSheet();
}
sheetRoot.addEventListener("click", e => {
  const b = e.target.closest("[data-sh]"); if (!b || !sheet) return;
  if (b.dataset.sh === "close") closeSheet();
  else if (b.dataset.sh === "add") addFromSheet();
});
sheetRoot.addEventListener("change", e => {
  if (e.target.dataset.sh === "deck" && sheet) { sheet.deck = e.target.value; renderSheet(); }
});

/* örnek cümlenin Türkçesi: kartta yoksa kartın geldiği şablondan bulunur */
const tplExTr = {};
TEMPLATES.forEach(t => { tplExTr[t.key] = {}; t.cards.forEach(c => { if (c[5]) tplExTr[t.key][c[0].toLowerCase()] = c[5]; }); });
function exTrOf(k, deckId){
  if (k.extr) return k.extr;
  const d = store.decks[deckId], key = d && (d.template || (d.starter ? "paket1" : null));
  return (key && tplExTr[key] && tplExTr[key][k.en.toLowerCase()]) || "";
}
const exBlock = (k, deckId) => k.ex ? `<div class="ex">“${esc(k.ex)}”</div>${exTrOf(k, deckId) ? `<div class="extr">${esc(exTrOf(k, deckId))}</div>` : ""}` : "";

/* ---------- IELTS Reading testleri ---------- */
const RD = window.FISLIK_READING || null;
const RT_KEY = "fislik.rtest.v1";
const RT_TYPES = { tfng: "True / False / Not Given", ynng: "Yes / No / Not Given", mc: "Multiple Choice", gap: "Completion (boşluk doldurma)", heading: "Matching Headings", match: "Matching Sentence Endings" };
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
const LETTERS = "ABCDEFGHIJ";
let rtBest = {}; try { rtBest = JSON.parse(localStorage.getItem(RT_KEY) || "{}") || {}; } catch {}
let rt = null;          // { tid, only (pasaj indeksi ya da null), cur, ans: {}, secs, done }
let rtTimer = null;
const rtTest = id => RD && RD.tests.find(t => t.id === id);
const rtKey = (tid, only) => only === null || only === undefined ? tid : `${tid}-p${only}`;
function bandFor(score, total){
  const scaled = total === 40 ? score : Math.round(score / total * 40);
  return (RD.bands.find(([min]) => scaled >= min) || [0, 0])[1];
}
// sorular: tüm test boyunca 1'den numaralanır
function rtItems(t){
  const out = []; let n = 0;
  t.passages.forEach((p, pi) => p.groups.forEach((g, gi) => g.items.forEach((it, ii) => out.push({ n: ++n, pi, gi, ii, g, it, key: `${pi}-${gi}-${ii}` }))));
  return out;
}
const normGap = x => String(x || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]/g, "").replace(/^(a|an|the) /, "").replace(/\s+/g, " ").trim();
function rtCorrect(g, it, v){
  if (v === undefined || v === "") return false;
  if (g.type === "gap") return it.a.map(normGap).includes(normGap(v));
  if (g.type === "tfng" || g.type === "ynng") return v === it.a;
  return +v === it.a;
}
function rtAnswerText(g, it){
  if (g.type === "gap") return it.a[0];
  if (g.type === "tfng") return { T: "TRUE", F: "FALSE", NG: "NOT GIVEN" }[it.a];
  if (g.type === "ynng") return { Y: "YES", N: "NO", NG: "NOT GIVEN" }[it.a];
  if (g.type === "heading") return `${ROMAN[it.a]}. ${g.options[it.a]}`;
  if (g.type === "match") return `${LETTERS[it.a]}. ${g.options[it.a]}`;
  return `${LETTERS[it.a]}. ${it.options[it.a]}`;
}
function stopRtTimer(){ clearInterval(rtTimer); rtTimer = null; }
function startRt(tid, only){
  stopRtTimer();
  rt = { tid, only: only === undefined ? null : only, cur: only == null ? 0 : only, ans: {}, secs: 0, done: false };
  go({ name: "rtest" });
}
function rtLimit(){ const t = rtTest(rt.tid); return (rt.only === null ? t.minutes : Math.round(t.minutes / t.passages.length)) * 60; }
function tickRt(){
  if (!rt || rt.done) return stopRtTimer();
  rt.secs++;
  const left = rtLimit() - rt.secs, el = app.querySelector("[data-rtime]");
  if (el) { el.textContent = left >= 0 ? fmtTime(left) : "+" + fmtTime(-left); el.parentElement.classList.toggle("over", left < 0); }
  if (left === 0) toast("Süre doldu. Gerçek sınavda cevap kâğıdı burada toplanır; istersen bitirmeye devam edebilirsin.", 6000);
}

function readingTestsHTML(){
  if (!RD) return "";
  return `<h3 class="sec">IELTS Reading · Academic</h3>
    ${RD.tests.map(t => { const best = rtBest[t.id];
      return `<section class="rt-card">
        <div class="rt-head"><div><div class="nm">${esc(t.title)}</div><div class="ds">Gerçek sınav biçimi: 3 pasaj, 40 soru, ${t.minutes} dakika${best ? ` · en iyi: <b>${best.score}/40 · band ${best.band}</b>` : ""}</div></div>
          <button class="btn hl" data-act="rtStart" data-id="${t.id}">Tam test</button></div>
        <div class="rt-ps">${t.passages.map((p, i) => { const b = rtBest[rtKey(t.id, i)], n = p.groups.reduce((s, g) => s + g.items.length, 0);
          return `<button class="rt-p" data-act="rtStart" data-id="${t.id}" data-p="${i}"><span class="nm">Pasaj ${i + 1}: ${esc(p.title)}</span><span class="ds">${n} soru · ${Math.round(t.minutes / t.passages.length)} dk${b ? ` · <span class="qz-best">✓ ${b.score}/${b.total}</span>` : ""}</span></button>`; }).join("")}</div>
      </section>`; }).join("")}`;
}

function rtQuestionHTML(x, review){
  const { g, it, key, n } = x, v = rt.ans[key], ok = review && rtCorrect(g, it, v);
  let input = "";
  if (g.type === "tfng" || g.type === "ynng") {
    const opts = g.type === "tfng" ? [["T", "TRUE"], ["F", "FALSE"], ["NG", "NOT GIVEN"]] : [["Y", "YES"], ["N", "NO"], ["NG", "NOT GIVEN"]];
    input = `<div class="qz-b">${opts.map(([val, lab]) => `<button data-act="rtAns" data-k="${key}" data-v="${val}" aria-pressed="${v === val}" ${review ? "disabled" : ""} class="${review && val === it.a ? "is-ans" : ""}${review && v === val && !ok ? " is-wrong" : ""}">${lab}</button>`).join("")}</div>`;
  } else if (g.type === "mc") {
    input = `<div class="rt-mc">${it.options.map((o, i) => `<button data-act="rtAns" data-k="${key}" data-v="${i}" aria-pressed="${+v === i && v !== undefined}" ${review ? "disabled" : ""} class="${review && i === it.a ? "is-ans" : ""}${review && +v === i && v !== undefined && !ok ? " is-wrong" : ""}"><b>${LETTERS[i]}</b> ${esc(o)}</button>`).join("")}</div>`;
  } else if (g.type === "heading" || g.type === "match") {
    const lab = i => g.type === "heading" ? ROMAN[i] : LETTERS[i];
    input = `<select data-rsel="${key}" ${review ? "disabled" : ""} aria-label="Soru ${n} cevabı"><option value="">Seç…</option>${g.options.map((o, i) => `<option value="${i}" ${+v === i && v !== undefined && v !== "" ? "selected" : ""}>${lab(i)}</option>`).join("")}</select>`;
  }
  const q = g.type === "gap"
    ? esc(it.q).replace("____", `<input class="rt-gap" type="text" data-rgap="${key}" value="${esc(v || "")}" ${review ? "disabled" : ""} autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Soru ${n} cevabı">`)
    : esc(it.q);
  return `<li class="rt-q${review ? (ok ? " ok" : " bad") : ""}" value="${n}">
    <div class="rt-qt">${q}</div>${input}
    ${review ? `<div class="qz-f"><b>${ok ? "Doğru ✓" : `${v === undefined || v === "" ? "Boş bıraktın." : "Yanlış."} Doğrusu: ${esc(rtAnswerText(g, it))}`}</b> ${esc(it.why)}</div>` : ""}
  </li>`;
}

function rtGroupHTML(p, pi, g, gi, items, review){
  const list = g.type === "heading" ? `<div class="rt-opts"><b>List of Headings</b>${g.options.map((o, i) => `<div><b>${ROMAN[i]}</b> ${esc(o)}</div>`).join("")}</div>`
             : g.type === "match" ? `<div class="rt-opts">${g.options.map((o, i) => `<div><b>${LETTERS[i]}</b> ${esc(o)}</div>`).join("")}</div>` : "";
  return `<section class="rt-group"><p class="rt-instr">${esc(g.instr)}</p>${list}
    <ol class="rt-qs">${items.filter(x => x.pi === pi && x.gi === gi).map(x => rtQuestionHTML(x, review)).join("")}</ol></section>`;
}

function renderRTest(){
  const t = rt && rtTest(rt.tid); if (!t) return go({ name: "stories" });
  const items = rtItems(t).filter(x => rt.only === null || x.pi === rt.only);
  const review = rt.done, pi = rt.cur, p = t.passages[pi];
  const answered = i => items.filter(x => x.pi === i && rt.ans[x.key] !== undefined && rt.ans[x.key] !== "").length;
  const left = rtLimit() - rt.secs;
  let summary = "";
  if (review) {
    const score = items.filter(x => rtCorrect(x.g, x.it, rt.ans[x.key])).length, band = bandFor(score, items.length);
    const byType = {};
    items.forEach(x => { const b = byType[x.g.type] || (byType[x.g.type] = [0, 0]); b[1]++; if (rtCorrect(x.g, x.it, rt.ans[x.key])) b[0]++; });
    const weakest = Object.entries(byType).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1])[0];
    summary = `<section class="rt-result">
      <div class="rt-score"><b>${score} / ${items.length}</b><span>doğru</span></div>
      <div class="rt-score"><b>${band}</b><span>tahmini band${items.length < 40 ? " (kabaca)" : ""}</span></div>
      <div class="rt-types">${Object.entries(byType).map(([k, [c, n]]) => `<div><span>${RT_TYPES[k]}</span><b>${c}/${n}</b></div>`).join("")}</div>
      ${weakest && weakest[1][0] < weakest[1][1] ? `<p class="hint">En çok zorlandığın soru tipi: <b>${RT_TYPES[weakest[0]]}</b>. Açıklamalarda cevabın metinde nerede olduğuna bak.</p>` : `<p class="hint">Hepsi doğru, harika!</p>`}
      <p class="hint">Band, Academic Reading'de yaygın kullanılan dönüşüm tablosuna göre tahmindir${items.length < 40 ? "; tek pasajda 40 soruya oranlanır, bu yüzden kaba bir tahmindir" : ""}.</p>
    </section>`;
  }
  app.innerHTML = `
    <div class="top studytop"><button class="back" data-act="rtExit">← ${review ? "Okuma" : "Çık"}</button>
      ${review ? `<span class="sync">${esc(t.title)}</span>` : `<div class="wr-timer${left < 0 ? " over" : ""}"><span data-rtime>${left >= 0 ? fmtTime(left) : "+" + fmtTime(-left)}</span>
        <button class="btn small ghost" data-act="rtTimer">${rtTimer ? "Duraklat" : (rt.secs ? "Devam" : "Sayacı başlat")}</button></div>`}</div>
    ${summary}
    ${rt.only === null ? `<div class="rt-tabs" role="group" aria-label="Pasajlar">${t.passages.map((_, i) => `<button data-act="rtGo" data-p="${i}" aria-current="${i === pi}">Pasaj ${i + 1}<small>${answered(i)}/${items.filter(x => x.pi === i).length}</small></button>`).join("")}</div>` : ""}
    <article class="rt-passage">
      <div class="hint">READING PASSAGE ${pi + 1}${rt.only === null ? ` · You should spend about 20 minutes on Questions ${items.find(x => x.pi === pi).n}–${items.filter(x => x.pi === pi).slice(-1)[0].n}` : ""}</div>
      <h2 class="ptitle">${esc(p.title)}</h2>
      ${p.paras.map(([l, txt]) => `<p><b class="rt-l">${l}</b> ${esc(txt)}</p>`).join("")}
    </article>
    ${p.groups.map((g, gi) => rtGroupHTML(p, pi, g, gi, items, review)).join("")}
    <div class="row rt-foot">
      ${rt.only === null && pi < t.passages.length - 1 ? `<button class="btn" data-act="rtGo" data-p="${pi + 1}">Pasaj ${pi + 2} →</button>` : ""}
      ${review ? `<button class="btn hl" data-act="rtStart" data-id="${t.id}" ${rt.only !== null ? `data-p="${rt.only}"` : ""}>Tekrar çöz</button>`
               : `<button class="btn hl" data-act="rtFinish">Testi bitir (${items.filter(x => rt.ans[x.key] !== undefined && rt.ans[x.key] !== "").length}/${items.length})</button>`}
    </div>
  `;
}
function rtCounts(){
  const t = rtTest(rt.tid), items = rtItems(t).filter(x => rt.only === null || x.pi === rt.only);
  const filled = x => rt.ans[x.key] !== undefined && rt.ans[x.key] !== "";
  const fin = app.querySelector("[data-act=rtFinish]"); if (fin) fin.textContent = `Testi bitir (${items.filter(filled).length}/${items.length})`;
  app.querySelectorAll(".rt-tabs button").forEach((b, i) => { const sm = b.querySelector("small"); if (sm) sm.textContent = `${items.filter(x => x.pi === i && filled(x)).length}/${items.filter(x => x.pi === i).length}`; });
}
function finishRt(){
  const t = rtTest(rt.tid), items = rtItems(t).filter(x => rt.only === null || x.pi === rt.only);
  const empty = items.filter(x => rt.ans[x.key] === undefined || rt.ans[x.key] === "").length;
  if (empty && !confirm(`${empty} soru boş. Gerçek sınavda boş bırakmak yerine tahmin etmek daha iyidir; yanlış cevap puan düşürmez. Yine de bitirilsin mi?`)) return;
  stopRtTimer(); rt.done = true;
  const score = items.filter(x => rtCorrect(x.g, x.it, rt.ans[x.key])).length, k = rtKey(rt.tid, rt.only), prev = rtBest[k];
  if (!prev || score > prev.score) { rtBest[k] = { score, total: items.length, band: bandFor(score, items.length), date: now() }; try { localStorage.setItem(RT_KEY, JSON.stringify(rtBest)); } catch {} }
  const dk = dayKey(); activity.reads[dk] = (activity.reads[dk] || 0) + 1; saveActivity();
  window.scrollTo(0, 0); render();
}

/* ---------- Writing (Task 2) ---------- */
const WR = window.FISLIK_WRITING || null;
const WR_KEY = "fislik.writing.v1";
const WR_MIN = 250, WR_TIME = 40 * 60, WR_WEEKLY = 2;
let wr = { draft: null, essays: [] };   // draft: { pid, text, secs, done }  essays: [{ id, pid, text, words, secs, date, checks }]
try { const x = JSON.parse(localStorage.getItem(WR_KEY) || "null"); if (x && Array.isArray(x.essays)) wr = { draft: x.draft || null, essays: x.essays }; } catch {}
function saveWr(){ try { localStorage.setItem(WR_KEY, JSON.stringify(wr)); } catch { toast("Taslak kaydedilemedi: tarayıcı depolaması dolu ya da kapalı."); } }
const wrType = k => WR.types.find(t => t.key === k);
const wrPrompt = id => WR.prompts.find(p => p.id === id);
const wrTopicName = key => (TEMPLATES.find(t => t.key === key) || {}).name || "";
const wrWords = txt => (String(txt).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
const fmtTime = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const weekEssays = () => wr.essays.filter(e => now() - e.date < 7 * DAY).length;

// Otomatik kontroller: band puanı değil, ölçülebilen şeyler
const WR_STOP = new Set("that this with have from they their there which would could should about these those because while where when what into also more most many much some such than then them were been being other only very will just your over even like make made does doing done people think".split(" "));
const WR_INFORMAL = ["kids", "stuff", "gonna", "wanna", "lots of", "a lot of", "okay", "ok", "nowadays", "etc"];
function wrAnalyze(text, promptText){
  const words = wrWords(text);
  const paras = text.split(/\n+/).filter(p => wrWords(p) >= 5).length;
  const linkers = [];
  WR.linkers.forEach(g => g.items.forEach(([phrase]) => phrase.split(" / ").forEach(ph => {
    if (ph.includes("...")) return;
    const n = (text.match(new RegExp(`\\b${ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")) || []).length;
    if (n) linkers.push([ph, n]);
  })));
  const contractions = [...new Set((text.match(/\b[A-Za-z]+(?:n['’]t|['’](?:re|ll|ve|m|d))\b|\b(?:it|that|there|what|let)['’]s\b/gi) || []).map(x => x.toLowerCase()))];
  const informal = WR_INFORMAL.filter(w => new RegExp(`\\b${w}\\b`, "i").test(text));
  // sorudaki kelimelerin farklı biçimleri (educated / education) tekrar sayılmaz
  const promptStems = new Set((promptText.toLowerCase().match(/[a-z]{4,}/g) || []).map(w => w.slice(0, 5)));
  const freq = {};
  (text.toLowerCase().match(/[a-z]+/g) || []).forEach(w => { if (w.length >= 4 && !WR_STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
  // konunun ana kelimeleri doğal olarak tekrar eder; metnin %2'sini (en az 5 kez) geçerse uyar
  const lim = Math.max(5, Math.ceil(words * 0.02));
  const repeated = Object.entries(freq).filter(([w, n]) => n >= lim && !promptStems.has(w.slice(0, 5))).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sentences = text.split(/[.!?]+\s/).filter(s => wrWords(s) > 0);
  const avg = sentences.length ? Math.round(words / sentences.length) : 0;
  const checks = [
    { ok: words >= WR_MIN, title: `Uzunluk: ${words} kelime`, note: words >= WR_MIN ? "En az 250 kelime şartı karşılandı." : `Sınavda ${WR_MIN} kelimenin altı Task Response puanını düşürür; ${WR_MIN - words} kelime daha gerekiyor.` },
    { ok: paras >= 4 && paras <= 6, title: `Paragraf: ${paras}`, note: paras >= 4 && paras <= 6 ? "Giriş, iki ya da üç gövde ve sonuç için uygun." : "Genelde 4–5 paragraf beklenir: giriş, 2–3 gövde, sonuç. Paragrafları boş satırla ayır." },
    { ok: linkers.length >= 4 && !linkers.some(([, n]) => n > 2), title: `Bağlaçlar: ${linkers.length} farklı`, note: linkers.length ? linkers.map(([p, n]) => `${p}${n > 1 ? ` ×${n}` : ""}`).join(", ") + (linkers.some(([, n]) => n > 2) ? ". İkiden fazla kullandığın bağlacı değiştir." : linkers.length < 4 ? ". Biraz daha çeşitlendirebilirsin." : ".") : "Hiç bağlaç bulunamadı; fikirleri birbirine bağlamak Coherence and Cohesion puanı için önemli." },
    { ok: !contractions.length && !informal.length, title: "Akademik üslup", note: contractions.length || informal.length ? `Kaçınılması gerekenler: ${[...contractions, ...informal].join(", ")}. Akademik yazıda kısaltma (don't → do not) ve gündelik ifadeler kullanılmaz.` : "Kısaltma ya da gündelik ifade bulunamadı." },
    { ok: !repeated.length, title: "Kelime tekrarı", note: repeated.length ? `Çok sık kullandıkların: ${repeated.map(([w, n]) => `${w} ×${n}`).join(", ")}. Bunlar için eş anlamlı ya da 'this issue', 'such policies' gibi gönderim kullan. (Sorudaki kelimelerin tekrarı sayılmaz.)` : "Belirgin bir kelime tekrarı yok; sorudaki kelimelerin tekrarı sayılmaz." },
    { ok: avg >= 12 && avg <= 28, title: `Ortalama cümle: ${avg} kelime`, note: avg < 12 ? "Cümleler çok kısa; yan cümleyle (which, although, because) bazılarını birleştir." : avg > 28 ? "Cümleler çok uzun; anlaşılırlık için bazılarını böl." : "Cümle uzunluğu dengeli." },
  ];
  return { words, checks };
}
function analysisHTML(a){
  return `<div class="wa">${a.checks.map(c => `<div class="wa-row ${c.ok ? "ok" : "warn"}"><span class="wa-ic" aria-hidden="true">${c.ok ? "✓" : "!"}</span><div><b>${esc(c.title)}</b><div class="ds">${esc(c.note)}</div></div></div>`).join("")}</div>`;
}

function renderWriting(){
  if (!WR) return go({ name: "home" });
  const d = wr.draft, dp = d && wrPrompt(d.pid), done = new Set(wr.essays.map(e => e.pid));
  const row = (act, id, lvl, nm, ds) => `<button class="tpl-item storyrow" data-act="${act}" ${id ? `data-id="${esc(id)}"` : ""}><span class="lvl">${lvl}</span><span><span class="nm">${nm}</span><span class="ds">${ds}</span></span><span class="go" aria-hidden="true">→</span></button>`;
  app.innerHTML = header() + navHTML("writing") + `
    <h2 class="ptitle">Writing Task 2</h2>
    <p class="hint">40 dakikada en az 250 kelimelik bir deneme. Puanın dört kritere göre verilir; önce türleri ve örnekleri incele, sonra sayaçla pratik yap. Bu hafta ${weekEssays()} / ${WR_WEEKLY} deneme yazdın.</p>
    <section class="wr-cta">
      ${dp ? `<div><div class="nm">Yarım kalan denemen</div><div class="ds">${esc(dp.text.slice(0, 90))}… · ${wrWords(d.text)} kelime · ${fmtTime(d.secs || 0)}</div></div>
        <div class="row"><button class="btn hl" data-act="wcontinue">Devam et</button><button class="btn ghost" data-act="wnew">Yeni soru</button></div>`
      : `<div><div class="nm">Deneme yaz</div><div class="ds">Rastgele bir soru gelir, sayaç başlar. Bitirince otomatik kontroller ve değerlendirme listesi çıkar.</div></div>
        <button class="btn hl" data-act="wnew">Başla</button>`}
    </section>
    <h3 class="sec">Deneme türleri</h3>
    <div class="tpl">${WR.types.map((t, i) => row("wtype", t.key, i + 1, `${esc(t.name)} · ${esc(t.tr)}`, `Soruda: “${esc(t.spot[0])}” · örnek deneme`)).join("")}</div>
    <h3 class="sec">Rehber</h3>
    <div class="tpl">
      ${row("wcrit", "", "4", "Puanlama kriterleri", "Band 7 için her kriterde ne gerekir?")}
      ${row("wlink", "", "Aa", "Bağlaç bankası", `${WR.linkers.reduce((n, g) => n + g.items.length, 0)} bağlaç, işlevine göre, Türkçe ve örnekle`)}
    </div>
    <h3 class="sec">Soru bankası</h3>
    ${WR.types.map(t => `<details class="wr-bank"><summary>${esc(t.name)} <span class="hint">${WR.prompts.filter(p => p.type === t.key).length} soru</span></summary>
      ${WR.prompts.filter(p => p.type === t.key).map(p => `<div class="wr-q"><div>${esc(p.text)}<div class="hint">${esc(wrTopicName(p.topic))}${done.has(p.id) ? ` · <span class="qz-best">✓ yazıldı</span>` : ""}</div></div><button class="btn small" data-act="wstart" data-id="${p.id}">Yaz</button></div>`).join("")}
    </details>`).join("")}
    <h3 class="sec">Denemelerin</h3>
    ${wr.essays.length ? `<div class="tpl">${wr.essays.slice().reverse().map(e => { const p = wrPrompt(e.pid) || { text: "", type: "" }, tp = wrType(p.type);
      return row("wessay", e.id, `${e.words}`, `${esc(new Date(e.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" }))} · ${esc(tp ? tp.name : "")}`, `${esc(p.text.slice(0, 80))}… · ${e.words} kelime · liste ${e.checks.filter(Boolean).length}/${WR.checklist.length}`); }).join("")}</div>`
      : `<div class="empty">Henüz kaydedilmiş denemen yok. İlk denemeni yazınca burada görünür.</div>`}
  ` + footer();
}

function renderWType(){
  const t = wrType(view.id); if (!t) return go({ name: "writing" });
  app.innerHTML = header() + `
    <button class="back" data-act="writing">← Writing</button>
    <h2 class="ptitle">${esc(t.name)} <span class="hint">· ${esc(t.tr)}</span></h2>
    <p>${esc(t.summary)}</p>
    <div class="wr-box"><b>Soruda şöyle geçer:</b> ${t.spot.map(s => `<span class="wr-spot">${esc(s)}</span>`).join(" ")}</div>
    <h3 class="sec">Yapı</h3>
    <ol class="wr-struct">${t.structure.map(([h, d]) => `<li><b>${esc(h)}:</b> ${esc(d)}</li>`).join("")}</ol>
    <h3 class="sec">İşe yarar kalıplar</h3>
    <ul class="wr-frames">${t.frames.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <h3 class="sec">Band 7+ örnek deneme</h3>
    <div class="wr-box"><b>Soru:</b> ${esc(t.model.prompt)}</div>
    <article class="wr-model">${t.model.paras.map(([p, note]) => `<p>${esc(p)}</p><div class="wr-note">${esc(note)}</div>`).join("")}
      <div class="hint">${wrWords(t.model.paras.map(p => p[0]).join(" "))} kelime · TR: Task Response, CC: Coherence and Cohesion, LR: Lexical Resource, GRA: Grammatical Range and Accuracy</div></article>
    <div class="row" style="margin-top:16px"><button class="btn hl" data-act="wnew" data-type="${t.key}">Bu türde pratik yap</button></div>
  ` + footer();
}

function renderWCrit(){
  app.innerHTML = header() + `
    <button class="back" data-act="writing">← Writing</button>
    <h2 class="ptitle">Puanlama kriterleri</h2>
    <p class="hint">Writing puanın dört kriterin ortalamasıdır; her biri eşit ağırlıktadır. Aşağıdaki özetler resmî tanımların sade Türkçe açıklamasıdır, birebir çevirisi değildir.</p>
    ${WR.criteria.map(c => `<section class="wr-crit"><h3>${esc(c.name)} <span class="hint">· ${esc(c.tr)}</span></h3>
      <p>${esc(c.what)}</p>
      <div class="wr-cols"><div><b>Band 7 için</b><ul>${c.band7.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div><b>Nasıl yapılır</b><ul>${c.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div></section>`).join("")}
  ` + footer();
}

function renderWLink(){
  app.innerHTML = header() + `
    <button class="back" data-act="writing">← Writing</button>
    <h2 class="ptitle">Bağlaç bankası</h2>
    <p class="hint">Bağlaçlar Coherence and Cohesion puanının parçasıdır ama fazlası zarar verir: her cümleye bağlaç koyma ve aynısını ikiden fazla kullanma.</p>
    ${WR.linkers.map(g => `<h3 class="sec">${esc(g.group)}</h3><div class="wr-links">${g.items.map(([en, tr, ex]) => `<div class="wr-link"><div><b>${esc(en)}</b> <span class="hint">${esc(tr)}</span></div><div class="ex">${esc(ex)}</div></div>`).join("")}</div>`).join("")}
  ` + footer();
}

let wrTimer = null;
function stopWrTimer(){ clearInterval(wrTimer); wrTimer = null; }
function renderWPractice(){
  const d = wr.draft, p = d && wrPrompt(d.pid); if (!p) return go({ name: "writing" });
  const t = wrType(p.type), topic = TEMPLATES.find(x => x.key === p.topic);
  const words = topic ? topic.cards.slice().sort((a, b) => (a[0] > b[0] ? 1 : -1)).filter((_, i) => i % 3 === 0).slice(0, 12) : [];
  if (d.done) {
    const a = wrAnalyze(d.text, p.text);
    app.innerHTML = header() + `
      <button class="back" data-act="wedit">← Yazmaya dön</button>
      <h2 class="ptitle">Kontrol</h2>
      <div class="wr-box"><b>${esc(t.name)}:</b> ${esc(p.text)}</div>
      <h3 class="sec">Otomatik kontroller</h3>
      <p class="hint">Bunlar band puanı değil; sadece ölçülebilen şeyler. Asıl değerlendirmeyi aşağıdaki listeyle sen yaparsın.</p>
      ${analysisHTML(a)}
      <h3 class="sec">Kendini değerlendir</h3>
      <p class="hint">Denemeni tekrar oku ve doğru olan maddeleri işaretle. Emin olamadığın maddeler için <button class="helplink" data-act="wtype" data-id="${t.key}">örnek denemeye</button> bak.</p>
      <div class="wr-check">${WR.checklist.map(([k, txt], i) => `<label><input type="checkbox" data-wcheck="${i}"> <span class="wr-crit-tag">${k}</span> ${esc(txt)}</label>`).join("")}</div>
      <div class="row" style="margin-top:14px"><button class="btn hl" data-act="wsave">Denemeyi kaydet</button><button class="btn ghost" data-act="wedit">Düzenlemeye dön</button></div>
    ` + footer();
    return;
  }
  const left = WR_TIME - (d.secs || 0);
  app.innerHTML = `
    <div class="top studytop"><button class="back" data-act="wexit">← Çık</button>
      <div class="wr-timer${left < 0 ? " over" : ""}" aria-live="off"><span data-wtime>${left >= 0 ? fmtTime(left) : "+" + fmtTime(-left)}</span>
        <button class="btn small ghost" data-act="wtimer">${wrTimer ? "Duraklat" : (d.secs ? "Devam" : "Sayacı başlat")}</button></div></div>
    <div class="wr-box"><span class="recbadge">${esc(t.name)}</span> ${esc(p.text)}
      <div class="hint" style="margin-top:6px">İpucu: İlk 5 dakikayı planlamaya, son 3 dakikayı kontrole ayır.</div></div>
    <textarea class="wr-text" data-field="essay" spellcheck="false" autocomplete="off" autocapitalize="sentences" lang="en" placeholder="Denemeni buraya yaz. Paragrafları boş satırla ayır.">${esc(d.text)}</textarea>
    <div class="wr-bar"><span data-wcount>${wrWords(d.text)} kelime</span><span class="hint">Sınavda yazım denetimi olmadığı için burada da kapalı.</span>
      <button class="btn hl" data-act="wfinish">Bitir ve kontrol et</button></div>
    <details class="wr-help"><summary>Yapı ve kalıplar · ${esc(t.name)}</summary>
      <ol class="wr-struct">${t.structure.map(([h, x]) => `<li><b>${esc(h)}:</b> ${esc(x)}</li>`).join("")}</ol>
      <ul class="wr-frames">${t.frames.map(f => `<li>${esc(f)}</li>`).join("")}</ul></details>
    ${words.length ? `<details class="wr-help"><summary>Konu kelimeleri · ${esc(topic.name)}</summary>
      <div class="wr-words">${words.map(c => `<span><b>${esc(c[0])}</b> ${esc(c[2])}</span>`).join("")}</div></details>` : ""}
  `;
  updateWrCount();
}
function updateWrCount(){
  const el = app.querySelector("[data-wcount]"); if (!el || !wr.draft) return;
  const n = wrWords(wr.draft.text); el.textContent = `${n} kelime`; el.className = n >= WR_MIN ? "ok" : "";
}
function tickWr(){
  if (!wr.draft) return stopWrTimer();
  wr.draft.secs = (wr.draft.secs || 0) + 1;
  const left = WR_TIME - wr.draft.secs, el = app.querySelector("[data-wtime]");
  if (el) { el.textContent = left >= 0 ? fmtTime(left) : "+" + fmtTime(-left); el.parentElement.classList.toggle("over", left < 0); }
  if (left === 0) toast("40 dakika doldu. Sınavda bu noktada kalem bırakılır; yine de bitirebilirsin.", 6000);
  if (wr.draft.secs % 10 === 0) saveWr();
}
function startWr(pid){
  stopWrTimer();
  wr.draft = { pid, text: "", secs: 0, done: false }; saveWr();
  go({ name: "wpractice" });
}
function pickPrompt(type){
  const pool = WR.prompts.filter(p => !type || p.type === type), fresh = pool.filter(p => !wr.essays.some(e => e.pid === p.id));
  const from = fresh.length ? fresh : pool; return from[Math.floor(Math.random() * from.length)].id;
}
function renderWEssay(){
  const e = wr.essays.find(x => x.id === view.id); if (!e) return go({ name: "writing" });
  const p = wrPrompt(e.pid) || { text: "", type: "" }, t = wrType(p.type);
  app.innerHTML = header() + `
    <button class="back" data-act="writing">← Writing</button>
    <h2 class="ptitle">${esc(new Date(e.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }))}</h2>
    <div class="wr-box"><b>${esc(t ? t.name : "")}:</b> ${esc(p.text)}</div>
    <article class="wr-model wr-mine">${e.text.split(/\n+/).filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join("")}
      <div class="hint">${e.words} kelime · ${fmtTime(e.secs || 0)} sürede yazıldı</div></article>
    <h3 class="sec">Otomatik kontroller</h3>${analysisHTML(wrAnalyze(e.text, p.text))}
    <h3 class="sec">Kendi değerlendirmen · ${e.checks.filter(Boolean).length} / ${WR.checklist.length}</h3>
    <ul class="wr-checked">${WR.checklist.map(([k, txt], i) => `<li class="${e.checks[i] ? "ok" : ""}"><span class="wa-ic">${e.checks[i] ? "✓" : "·"}</span> <span class="wr-crit-tag">${k}</span> ${esc(txt)}</li>`).join("")}</ul>
    <div class="row" style="margin-top:14px">${t ? `<button class="btn" data-act="wtype" data-id="${t.key}">Örnek denemeyle karşılaştır</button>` : ""}<button class="ib" data-act="wdel" data-id="${e.id}">Denemeyi sil</button></div>
  ` + footer();
}

/* ---------- çalışma ---------- */
function cardOf(it){ const d = store.decks[it.deck]; return d && (d.cards || []).find(k => k.id === it.id); }
function startSession(deckIds, everything, pick){
  const items = [];
  deckIds.forEach(id => (store.decks[id].cards || []).forEach(k => { if (!pick || pick(k)) items.push({ deck: id, id: k.id, k }); }));
  let queue;
  if (everything) {
    queue = shuffle(items.slice());
  } else {
    const group = s => shuffle(items.filter(it => it.k.status === s && isReview(it.k)));
    const fresh = items.filter(it => it.k.status === "new").sort((a,b) => (a.k.added||0) - (b.k.added||0)).slice(0, NEW_PER_SESSION);
    queue = [...group("unknown"), ...group("learning"), ...fresh];
  }
  queue = queue.map(({deck, id}) => ({deck, id}));
  if (!queue.length) { toast("Şu an sırası gelen kart yok."); return; }
  session = { queue, i: 0, total: queue.length, flipped: false, res: { unknown: 0, learning: 0, known: 0 }, from: view, retried: new Set() };
  go({ name: "study" });
}

/* yazarak çalışma: cevap karşılaştırma */
const normAns = x => String(x || "").toLowerCase().replace(/[’`]/g, "'").replace(/[-‐–]/g, " ").replace(/[^a-z' ]/g, "").replace(/\s+/g, " ").trim();
// "bombard (with)" -> bombard with / bombard; "to/be ..." başı isteğe bağlı
function accepted(en){
  const raw = String(en || "");
  const set = new Set([raw.replace(/[()]/g, ""), raw.replace(/\([^)]*\)/g, "")].map(normAns));
  [...set].forEach(v => { const m = v.match(/^(to|be) (.+)$/); if (m) set.add(m[2]); });
  set.delete(""); return [...set];
}
// yan yana iki harfin yer değiştirmesi (recieve) tek hata sayılır
function editDistance(a, b){
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2] + 1);
  }
  return d[a.length][b.length];
}
function checkTyped(input, en){
  const a = normAns(input); if (!a) return "bad";
  const ok = accepted(en);
  if (ok.includes(a)) return "ok";
  // birkaç harflik yazım hatası: 4–7 harfte 1, daha uzunda 2 harf
  return ok.some(v => v.length >= 4 && editDistance(a, v) <= (v.length >= 8 ? 2 : 1)) ? "near" : "bad";
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// örnek cümlede kelimeyi boşluğa çevir; bulamazsa null (cümle cevabı ele vermesin diye hiç gösterilmez)
// düzenli çekimler: vanish → vanished, make → making, stop → stopped, study → studied
function inflections(w){
  const f = new Set([w, w + "s", w + "es", w + "ed", w + "d", w + "ing", w.replace(/e$/, "") + "ing"]);
  if (/y$/.test(w)) { const i = w.slice(0, -1) + "i"; f.add(i + "ed"); f.add(i + "es"); }
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) { const d = w + w.slice(-1); f.add(d + "ed"); f.add(d + "ing"); }
  return [...f].sort((a, b) => b.length - a.length).map(escRe).join("|");
}
function blankExample(ex, en){
  if (!ex) return null;
  for (const v of accepted(en).sort((a, b) => b.length - a.length)) {
    // ilk kelime fiil gibi (look → looked after), son kelime isim gibi (state school → state schools) çekimlenebilir
    const words = v.split(" "), last = words.length - 1;
    const re = new RegExp(`\\b${words.map((w, i) => i === 0 || i === last ? `(?:${inflections(w)})` : escRe(w)).join("[\\s-]+")}\\b`, "i");
    if (re.test(ex)) return esc(ex.replace(re, "\u0000")).replace("\u0000", `<span class="blank">${"_".repeat(Math.min(12, v.length + 2))}</span>`);
  }
  return null;
}
function hintPattern(en, n){
  let shown = 0;
  return [...en].map(ch => /[a-z]/i.test(ch) ? (shown++ < n ? ch : "_") : ch === " " ? " " : ch).join(" ");
}
const SUGGEST = { ok: "known", near: "learning", bad: "unknown" };

function renderTyped(s, it, k){
  const t = s.t || (s.t = { value: "", hints: 0, result: null });
  const deckName = store.decks[it.deck].name;
  const letters = (k.en.match(/[a-z]/gi) || []).length;
  const exBlank = blankExample(k.ex, k.en);
  const pct = Math.round(s.i / s.queue.length * 100);
  const done = !!t.result;
  const suggest = done ? (t.result === "ok" && t.hints ? "learning" : SUGGEST[t.result]) : null;
  const verdict = !done ? "" : t.result === "ok"
    ? `<div class="verdict ok">Doğru${t.hints ? " (ipucuyla)" : ""}</div>`
    : t.result === "near"
      ? `<div class="verdict near">Neredeyse, küçük bir yazım hatası var</div><div class="yours">Senin cevabın: <s>${esc(t.value)}</s></div>`
      : `<div class="verdict bad">${t.value.trim() ? "Yanlış" : "Cevap"}</div>${t.value.trim() ? `<div class="yours">Senin cevabın: <s>${esc(t.value)}</s></div>` : ""}`;
  const ans = (v, cls, label, small) => `<button class="ans ${cls}${suggest === v ? " sug" : ""}" data-act="ans" data-v="${v}" ${done ? "" : "disabled"}>${label}<small>${suggest === v ? "önerilen · Enter" : small}</small></button>`;
  app.innerHTML = `
    <div class="top studytop"><button class="back" data-act="endStudy">← Çık</button><span class="sync">${STATUS[k.status].label}</span></div>
    <div class="prog"><div class="track"><i style="width:${pct}%"></i></div><span>${s.i + 1} / ${s.queue.length}</span></div>
    <div class="typecard">
      <div class="tc-top"><span class="tag">Türkçe</span><span class="deckn">${esc(deckName)}</span></div>
      <div class="tr">${esc(k.tr) || "?"}</div>
      ${k.pos ? `<div class="pos">${esc(k.pos)}</div>` : ""}
      ${k.def ? `<div class="def">${esc(k.def)}</div>` : ""}
      ${!done && exBlank ? `<div class="ex">“${exBlank}”</div>` : ""}
      ${done ? `<div class="reveal">${verdict}<div class="bigword">${esc(k.en)}</div>${exBlock(k, it.deck)}</div>` : `
      <form class="typeform" data-form="typed">
        <input type="text" name="typed" value="${esc(t.value)}" placeholder="İngilizcesini yaz" aria-label="İngilizcesini yaz" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en" enterkeyhint="done">
        <div class="row">
          <button class="btn hl" type="submit">Kontrol et</button>
          <button class="btn ghost" type="button" data-act="hint" ${t.hints >= letters - 1 ? "disabled" : ""}>İpucu</button>
          <button class="btn ghost" type="button" data-act="giveup">Bilmiyorum</button>
        </div>
        ${t.hints ? `<div class="hintline" aria-label="İpucu">${esc(hintPattern(k.en, t.hints))}</div>` : `<div class="hint">${letters} harf${/[ -]/.test(k.en.trim()) ? ", birden fazla kelime" : ""}</div>`}
      </form>`}
    </div>
    <div class="answers">
      ${ans("unknown", "a1", "Bilmiyorum", "sık gösterilir")}
      ${ans("learning", "a2", "Öğreniyorum", "yarın")}
      ${ans("known", "a3", "Öğrendim", "artık gösterilmez")}
    </div>
    <div class="keys">${done ? "Enter önerileni seçer · 1 / 2 / 3 ile başka cevap" : "Enter kontrol eder · Esc çıkış"}</div>
  `;
  if (!done) { const inp = app.querySelector("[name=typed]"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  else app.querySelector(".ans.sug")?.focus();
}
function submitTyped(value){
  const s = session; if (!s || !s.t) return;
  const k = cardOf(s.queue[s.i]); if (!k) return;
  s.t.value = value; s.t.result = checkTyped(value, k.en); s.flipped = true; renderStudy();
}

function renderStudy(){
  const s = session;
  if (!s) return go({ name: "home" });
  if (s.i >= s.queue.length) {
    app.innerHTML = header() + `
      <div class="done">
        <div class="big">Bitti</div>
        <p class="hint">${s.total} kart çalıştın${s.queue.length > s.total ? ", bilmediklerini bir kez daha tekrar ettin" : ""}.</p>
        <div class="res">
          <div><b style="color:var(--bad)">${s.res.unknown}</b>Bilmiyorum</div>
          <div><b style="color:var(--mid)">${s.res.learning}</b>Öğreniyorum</div>
          <div><b style="color:var(--good)">${s.res.known}</b>Öğrendim</div>
        </div>
        ${(() => { const st = streak(), d = activity.days[dayKey()] || 0;
          return `<p class="donestreak">🔥 ${st.len} günlük seri · bugün ${d} kart${d >= activity.goal ? " · günlük hedef tamam ✓" : ` · hedefe ${activity.goal - d} kart kaldı`}</p>`; })()}
        <p class="hint">Bilmiyorum dediklerin her çalışmada, Öğreniyorum dediklerin yarın tekrar gelir. Öğrendim dediklerin artık gösterilmez; istersen Kelime sekmesindeki Öğrendim listesinden tekrar edebilirsin.</p>
        <button class="btn hl" data-act="endStudy">Tamam</button>
      </div>`;
    return;
  }
  const it = s.queue[s.i], k = cardOf(it);
  if (!k) { s.i++; return renderStudy(); }
  if (mode === "type") return renderTyped(s, it, k);
  const deckName = store.decks[it.deck].name;
  const frontEn = direction === "en";
  const front = frontEn
    ? `<div class="bigword">${esc(k.en)}</div>${k.pos ? `<div class="pos">${esc(k.pos)}</div>` : ""}`
    : `<div class="tr">${esc(k.tr) || esc(k.def) || "?"}</div>`;
  const back = frontEn
    ? `<div class="tr">${esc(k.tr) || "—"}</div>${k.def ? `<div class="def">${esc(k.def)}</div>` : ""}${exBlock(k, it.deck)}`
    : `<div class="bigword">${esc(k.en)}</div>${k.pos ? `<div class="pos">${esc(k.pos)}</div>` : ""}${exBlock(k, it.deck)}`;
  const pct = Math.round(s.i / s.queue.length * 100);
  app.innerHTML = `
    <div class="top studytop"><button class="back" data-act="endStudy">← Çık</button><span class="sync">${STATUS[k.status].label}</span></div>
    <div class="prog"><div class="track"><i style="width:${pct}%"></i></div><span>${s.i + 1} / ${s.queue.length}</span></div>
    <div class="stage">
      <button class="flip ${s.flipped ? "on" : ""}" data-act="flip" aria-label="Kartı çevir" aria-live="polite">
        <div class="face front-f"><span class="tag">${frontEn ? "İngilizce" : "Türkçe"}</span><span class="deckn">${esc(deckName)}</span>${front}<span class="tap">Anlamını düşün, sonra çevir</span></div>
        <div class="face back-f"><span class="tag">${frontEn ? "Türkçe" : "İngilizce"}</span><span class="deckn">${esc(deckName)}</span>${back}</div>
      </button>
    </div>
    <div class="answers">
      <button class="ans a1" data-act="ans" data-v="unknown" ${s.flipped ? "" : "disabled"}>Bilmiyorum<small>sık gösterilir</small></button>
      <button class="ans a2" data-act="ans" data-v="learning" ${s.flipped ? "" : "disabled"}>Öğreniyorum<small>yarın</small></button>
      <button class="ans a3" data-act="ans" data-v="known" ${s.flipped ? "" : "disabled"}>Öğrendim<small>artık gösterilmez</small></button>
    </div>
    <div class="keys">Klavye: Boşluk çevir · 1 Bilmiyorum · 2 Öğreniyorum · 3 Öğrendim</div>
  `;
}
function answer(v){
  const s = session; if (!s || !s.flipped) return;
  const it = s.queue[s.i], k = cardOf(it);
  if (k) {
    if (v === "unknown") { k.interval = 0; k.due = now(); }
    else if (v === "learning") { k.interval = 1; k.due = now() + DAY; }
    else { k.interval = k.status === "known" ? Math.max(3, (k.interval || 3) * 2) : 3; k.due = now() + k.interval * DAY; }
    // zorlanılan kelime sayacı: "Bilmiyorum" artırır, "Öğrendim" azaltır; öğrendikçe listeden düşer
    if (v === "unknown") k.miss = (k.miss || 0) + 1;
    else if (v === "known" && k.miss) k.miss--;
    k.status = v; k.seen = (k.seen || 0) + 1; k.last = now();
    logReview();
    store.save(it.deck);
    if (s.i < s.total) s.res[v]++;
    if (v === "unknown" && !s.retried.has(it.id)) { s.retried.add(it.id); s.queue.push({ ...it }); }
  }
  s.i++; s.flipped = false; s.t = null; renderStudy();
}
function endStudy(){
  const back = session && session.from; session = null;
  // oturum nereden başladıysa oraya dön (silinmiş bir desteye değil)
  go(back && back.name !== "study" && (back.name !== "deck" || store.decks[back.id]) ? back : { name: "home" });
}

/* ---------- yedekleme (GitHub sürümü) ---------- */
function exportBackup(){
  const blob = new Blob([JSON.stringify({ app: "fislik", version: 1, exported: new Date().toISOString(), decks: store.decks, activity }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fislik-yedek-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importBackup(file){
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "fislik" || typeof data.decks !== "object") throw 0;
    const n = Object.keys(data.decks).length;
    if (!confirm(`Yedekte ${n} deste var. Aynı desteler yedektekiyle değiştirilecek, diğerleri kalacak. Devam edilsin mi?`)) return;
    Object.entries(data.decks).forEach(([id, d]) => { if (d && Array.isArray(d.cards)) { store.decks[id] = d; store.push(id); } });
    if (data.activity && typeof data.activity.days === "object") {
      // günler birleştirilir: aynı gün için büyük olan sayı kalır
      Object.entries(data.activity.days).forEach(([d, c]) => { if (+c > (activity.days[d] || 0)) activity.days[d] = +c; });
      activity.best = Math.max(activity.best, +data.activity.best || 0, streak().len); saveActivity();
    }
    store.saveLocal(); toast(`${n} deste yüklendi.`); go({ name: "home" });
  } catch { toast("Bu dosya bir Fişlik yedeği değil."); }
}

/* ---------- olaylar ---------- */
app.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b || b.dataset.act === "import") return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === "home") go({ name: "home" });
  else if (act === "open") { filter = "all"; query = ""; go({ name: "deck", id }); }
  else if (act === "study") startSession([id], false);
  else if (act === "studyEvery") startSession([id], true, k => k.status !== "known");
  else if (act === "studyAll") startSession(Object.keys(store.decks), false);
  else if (act === "studyHard") startSession(Object.keys(store.decks), true, k => k.status !== "known" && (k.miss || 0) >= HARD_MIN);
  else if (act === "help") go({ name: "help" });
  else if (act === "vocab") go({ name: "vocab" });
  else if (act === "writing") go({ name: "writing" });
  else if (act === "rtStart") {
    const busy = rt && !rt.done && Object.keys(rt.ans).length;
    if (!busy || confirm("Devam eden testin silinecek. Yeni test başlasın mı?")) startRt(id, b.dataset.p === undefined ? null : +b.dataset.p);
  }
  else if (act === "rtGo") { rt.cur = +b.dataset.p; render(); window.scrollTo(0, 0); }
  else if (act === "rtTimer") { if (rtTimer) stopRtTimer(); else rtTimer = setInterval(tickRt, 1000); b.textContent = rtTimer ? "Duraklat" : "Devam"; }
  else if (act === "rtAns") {
    rt.ans[b.dataset.k] = b.dataset.v;
    b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    rtCounts();
  }
  else if (act === "rtFinish") finishRt();
  else if (act === "rtExit") {
    if (rt && !rt.done && Object.keys(rt.ans).length && !confirm("Testten çıkarsan cevapların silinir. Çıkılsın mı?")) return;
    stopRtTimer(); rt = null; go({ name: "stories" });
  }
  else if (act === "wtype") go({ name: "wtype", id });
  else if (act === "wcrit") go({ name: "wcrit" });
  else if (act === "wlink") go({ name: "wlink" });
  else if (act === "wessay") go({ name: "wessay", id });
  else if (act === "wcontinue") go({ name: "wpractice" });
  else if (act === "wnew") { if (!wr.draft || !wrWords(wr.draft.text) || confirm("Yarım kalan denemen silinecek. Yeni soruyla başlansın mı?")) startWr(pickPrompt(b.dataset.type)); }
  else if (act === "wstart") { if (!wr.draft || !wrWords(wr.draft.text) || confirm("Yarım kalan denemen silinecek. Bu soruyla başlansın mı?")) startWr(id); }
  else if (act === "wtimer") { if (wrTimer) stopWrTimer(); else wrTimer = setInterval(tickWr, 1000); saveWr(); b.textContent = wrTimer ? "Duraklat" : "Devam"; }
  else if (act === "wfinish") {
    if (wrWords(wr.draft.text) < 50) { toast("Kontrol için en az 50 kelime yazmalısın."); return; }
    stopWrTimer(); wr.draft.done = true; saveWr(); window.scrollTo(0, 0); render();
  }
  else if (act === "wedit") { wr.draft.done = false; saveWr(); render(); }
  else if (act === "wexit") { stopWrTimer(); saveWr(); go({ name: "writing" }); }
  else if (act === "wsave") {
    const d = wr.draft, checks = WR.checklist.map((_, i) => !!app.querySelector(`[data-wcheck="${i}"]`)?.checked);
    wr.essays.push({ id: uid(), pid: d.pid, text: d.text, words: wrWords(d.text), secs: d.secs || 0, date: now(), checks });
    wr.draft = null; saveWr(); toast("Denemen kaydedildi."); go({ name: "writing" });
  }
  else if (act === "wdel") { if (confirm("Bu deneme silinsin mi? Geri alınamaz.")) { wr.essays = wr.essays.filter(e => e.id !== id); saveWr(); go({ name: "writing" }); } }
  else if (act === "planEdit") { planEditing = true; render(); app.querySelector("[data-form=plan] select")?.focus(); }
  else if (act === "planCancel") { planEditing = false; render(); }
  else if (act === "planSkip") { plan = { skipped: true }; savePlan(); render(); }
  else if (act === "applyGoal") { activity.goal = +b.dataset.v; saveActivity(); toast(`Günlük hedef ${activity.goal} kart oldu.`); render(); }
  else if (act === "ltab") { listTab = b.dataset.v; listLimit = 50; render(); }
  else if (act === "moreList") { listLimit += 100; render(); }
  else if (act === "studyList") startSession(Object.keys(store.decks), true, k => k.status === listTab);
  else if (act === "unlearn") {
    const d = store.decks[b.dataset.deck], k = d && d.cards.find(c => c.id === id);
    if (k) { k.status = "learning"; k.due = now(); store.save(b.dataset.deck); toast(`"${k.en}" Öğreniyorum listesine alındı.`); render(); }
  }
  else if (act === "goal") { activity.goal = +b.dataset.v; saveActivity(); render(); }
  else if (act === "addTpl") {
    const t = TEMPLATES.find(x => x.key === b.dataset.key); if (!t) return;
    const did = uid();
    store.decks[did] = { name: t.name, created: now(), template: t.key,
      cards: t.cards.map(([en,pos,tr,def,ex,extr], i) => makeCard({en,pos,tr,def,ex,extr}, i)) };
    store.save(did); toast(`${t.cards.length} kelimelik deste eklendi.`); render();
  }
  else if (act === "dir") { direction = b.dataset.v; savePrefs(); render(); }
  else if (act === "mode") { mode = b.dataset.v; savePrefs(); render(); }
  else if (act === "hint" && session && session.t) { session.t.value = app.querySelector("[name=typed]").value; session.t.hints++; renderStudy(); }
  else if (act === "giveup") submitTyped("");
  else if (act === "filter") { filter = b.dataset.v; render(); }
  else if (act === "edit") { editing = id; render(); app.querySelector('[data-form=card]').scrollIntoView({block:"center"}); app.querySelector('[data-form=card] input[name=en]').focus(); }
  else if (act === "cancelEdit") { editing = null; render(); }
  else if (act === "del") {
    const d = store.decks[view.id]; const k = d.cards.find(c => c.id === id);
    if (k && confirm(`"${k.en}" kartı silinsin mi?`)) { d.cards = d.cards.filter(c => c.id !== id); store.save(view.id); render(); }
  }
  else if (act === "delDeck") {
    const d = store.decks[id];
    if (confirm(`"${d.name}" destesi ve içindeki ${d.cards.length} kart silinsin mi? Bu geri alınamaz.`)) { store.remove(id); go({ name: "home" }); }
  }
  else if (act === "flip") { if (session) { session.flipped = !session.flipped; renderStudy(); } }
  else if (act === "ans") answer(b.dataset.v);
  else if (act === "endStudy") endStudy();
  else if (act === "stories") go({ name: "stories" });
  else if (act === "story") go({ name: "story", id });
  else if (act === "word") openSheet(b);
  else if (act === "qz") answerQuiz(+b.dataset.i, b.dataset.v);
  else if (act === "qzReset") { const st = STORIES.find(x => x.id === view.id); delete quizPicks[view.id]; const sec = app.querySelector(".quiz"); if (st && sec) sec.outerHTML = quizHTML(st); }
  else if (act === "export") exportBackup();
  else if (act === "fill") {
    const f = b.closest("form"), msg = f.querySelector("[data-msg]"), w = f.en.value.trim();
    if (!w) { msg.className = "err"; msg.textContent = "Önce İngilizce kelimeyi yaz."; f.en.focus(); return; }
    b.disabled = true; msg.className = "hint"; msg.textContent = "Claude düşünüyor…";
    try {
      const r = await autofill(w);
      if (r && typeof r === "object") {
        ["pos","tr","def","ex"].forEach(key => { if (r[key] && !f[key].value.trim()) f[key].value = String(r[key]); });
        if (r.ex_tr && !f.extr.value.trim()) f.extr.value = String(r.ex_tr);
        msg.textContent = "Dolduruldu. Kontrol edip kaydet.";
      }
    } catch (err) {
      msg.className = "err";
      if (err && err.code === "not_granted") { sampleFn = null; msg.textContent = "Claude ile doldurma kapalı. Alanları kendin doldurabilirsin."; }
      else if (err && err.code === "rate_limited") msg.textContent = "Çok sık istek gönderildi. Biraz bekleyip tekrar dene.";
      else msg.textContent = "Doldurulamadı. Alanları kendin doldurabilirsin.";
    } finally { b.disabled = false; }
  }
});

function showTip(e){
  const c = e.target.closest(".hm-c[data-tip]"); if (!c) return;
  const tip = app.querySelector(".hm-tip"); if (tip) tip.textContent = c.dataset.tip;
  app.querySelectorAll(".hm-c.sel").forEach(x => x.classList.remove("sel")); c.classList.add("sel");
}
app.addEventListener("mouseover", showTip);
app.addEventListener("click", showTip);

app.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.form === "typed") { submitTyped(f.typed.value); return; }
  if (f.dataset.form === "plan") {
    const first = !hasPlan();
    plan = { band: BANDS.includes(f.band.value) ? f.band.value : "7.0", type: f.type.value === "general" ? "general" : "academic", date: /^\d{4}-\d{2}-\d{2}$/.test(f.date.value) ? f.date.value : "" };
    savePlan(); planEditing = false;
    // ilk kurulumda önerilen günlük hedefi doğrudan uygula; sonra kullanıcının seçimine dokunma
    if (first) { activity.goal = recommend().goal; saveActivity(); toast(`Hedefin kaydedildi. Günlük hedef: ${activity.goal} kart.`); }
    else toast("Hedefin güncellendi.");
    render(); return;
  }
  if (f.dataset.form === "newdeck") {
    const name = f.deckname.value.trim(); if (!name) return;
    const id = uid(); store.decks[id] = { name, created: now(), cards: [] };
    store.save(id); filter = "all"; query = ""; go({ name: "deck", id });
  }
  if (f.dataset.form === "card") {
    const d = store.decks[view.id]; const data = { en: f.en.value, pos: f.pos.value, tr: f.tr.value, def: f.def.value, ex: f.ex.value, extr: f.extr.value };
    if (!data.en.trim()) return;
    if (f.dataset.edit) {
      const k = d.cards.find(c => c.id === f.dataset.edit);
      Object.assign(k, { en: data.en.trim(), pos: data.pos.trim(), tr: data.tr.trim(), def: data.def.trim(), ex: data.ex.trim(), extr: data.extr.trim() });
      editing = null; toast("Kart güncellendi.");
    } else {
      if (d.cards.some(c => c.en.toLowerCase() === data.en.trim().toLowerCase())) { toast(`"${data.en.trim()}" bu destede zaten var.`); return; }
      d.cards.push(makeCard(data)); toast(`"${data.en.trim()}" eklendi.`);
    }
    store.save(view.id); render();
    const nf = app.querySelector('[data-form=card] input[name=en]'); if (nf && !editing) nf.focus();
  }
});

app.addEventListener("change", e => {
  if (e.target.dataset.field === "deckname" && view.name === "deck") {
    const v = e.target.value.trim(); if (!v) { e.target.value = store.decks[view.id].name; return; }
    store.decks[view.id].name = v; store.save(view.id);
  }
  if (e.target.dataset.act === "import" && e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
  if (e.target.dataset.rsel && rt) { rt.ans[e.target.dataset.rsel] = e.target.value; rtCounts(); }
});
app.addEventListener("input", e => {
  if (e.target.dataset.rgap && rt) { rt.ans[e.target.dataset.rgap] = e.target.value; rtCounts(); return; }
  if (e.target.dataset.field === "essay" && wr.draft) {
    wr.draft.text = e.target.value; updateWrCount();
    clearTimeout(updateWrCount._t); updateWrCount._t = setTimeout(saveWr, 500);
    return;
  }
  if (e.target.dataset.field === "search") {
    query = e.target.value; const pos = e.target.selectionStart; render();
    const s = app.querySelector('[data-field=search]'); s.focus(); s.setSelectionRange(pos, pos);
  }
});

document.addEventListener("keydown", e => {
  if (sheet && e.key === "Escape") { const b = sheet.btn; closeSheet(); if (b && b.isConnected) b.focus(); return; }
  if (view.name !== "study" || !session) return;
  if (e.key === "Escape") return endStudy();
  if (e.target.matches("input,textarea")) return;
  const t = session.t;
  if (mode === "type" && t) {
    // yazarak modda boşluk/Enter kartı çevirmez; kontrol edildiyse önerilen cevabı seçer
    if ((e.key === " " || e.key === "Enter") && t.result) { e.preventDefault(); app.querySelector(".ans.sug")?.click(); }
    else if (t.result && "123".includes(e.key)) answer(["unknown", "learning", "known"][+e.key - 1]);
    return;
  }
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); session.flipped = !session.flipped; renderStudy(); }
  else if (e.key === "1") answer("unknown");
  else if (e.key === "2") answer("learning");
  else if (e.key === "3") answer("known");
});

/* ---------- başlat ---------- */
store.loadLocal();
render();
store.connect();
initSample();
// çevrimdışı çalışma ve "ana ekrana ekle"; dosyadan açınca ya da Claude içinde gerekmez
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !inClaude) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
