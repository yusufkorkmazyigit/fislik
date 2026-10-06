(() => {
"use strict";

/* ---------- veri ---------- */
const TEMPLATES = window.FISLIK_TEMPLATES || [];
const STORIES = (window.FISLIK_STORIES || {}).stories || [];
const LEXICON = (window.FISLIK_STORIES || {}).lexicon || {};
const LEVELS = { A1: "Başlangıç", A2: "Temel", B1: "Orta", B2: "Orta üstü" };
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
function makeCard(o, i = 0){ return { id: uid(), en: String(o.en||"").trim(), pos: String(o.pos||"").trim(), tr: String(o.tr||"").trim(), def: String(o.def||"").trim(), ex: String(o.ex||"").trim(), status: "new", interval: 0, due: 0, seen: 0, added: now() + i }; }
function counts(cards){ const c = {new:0,unknown:0,learning:0,known:0}; cards.forEach(k => c[k.status]++); return c; }
const isReview = k => k.status !== "new" && (k.due || 0) <= now();
function todayCount(cards){ return cards.filter(isReview).length + Math.min(NEW_PER_SESSION, cards.filter(k => k.status === "new").length); }
function quoteOfDay(){ const d = Math.floor(now() / DAY); return QUOTES[d % QUOTES.length]; }
function toast(msg, ms = 2800){
  const r = document.getElementById("toastRoot"); r.innerHTML = "";
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); t.textContent = msg; r.appendChild(t);
  clearTimeout(toast._t); toast._t = setTimeout(() => t.remove(), ms);
}

/* ---------- çalışma günlüğü: seri, günlük hedef, takvim ---------- */
const ACT_KEY = "fislik.activity.v1";
const GOALS = [10, 20, 30, 50];
const HARD_MIN = 2;   // en az kaç kez "Bilmiyorum" denince zorlanılan sayılır
let activity = { days: {}, goal: 20, best: 0 };
try { const a = JSON.parse(localStorage.getItem(ACT_KEY) || "null"); if (a && typeof a.days === "object") activity = { days: a.days, goal: GOALS.includes(a.goal) ? a.goal : 20, best: a.best || 0 }; } catch {}
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
"ex": one natural academic-style example sentence (IELTS level, max 20 words).
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
function go(v){ view = v; editing = null; closeSheet(); window.scrollTo(0, 0); render(); }

const app = document.getElementById("app");
function render(){
  if (view.name === "deck" && !store.decks[view.id]) view = { name: "home" };
  if (view.name === "home") renderHome();
  else if (view.name === "deck") renderDeck();
  else if (view.name === "study") renderStudy();
  else if (view.name === "stories") renderStories();
  else if (view.name === "story") renderStory();
}

function header(){
  const [q, a] = quoteOfDay();
  return `<header class="top">
    <div class="brandbox"><button class="brand" data-act="home">Fişlik <small>IELTS kelime kartları</small></button></div>
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
  const hard = cards.filter(k => (k.miss || 0) >= HARD_MIN).length;
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
      <div class="hardrow">
        <div><div class="nm">Zorlandıkların</div><div class="ds">En az ${HARD_MIN} kez "Bilmiyorum" dediğin kelimeler. "Öğrendim" dedikçe listeden düşerler.</div></div>
        <button class="btn small" data-act="studyHard" ${hard ? "" : "disabled"}>Çalış (${hard})</button>
      </div>
    </section>`;
}

function renderHome(){
  const decks = Object.entries(store.decks).sort((a,b) => (a[1].created||0) - (b[1].created||0));
  const all = decks.flatMap(([,d]) => d.cards || []);
  const due = todayCount(all);
  const used = new Set(decks.map(([,d]) => d.template || (d.starter ? "paket1" : null)).filter(Boolean));
  app.innerHTML = header() + `
    <section class="today">
      <div><h2>Bugün çalışılacak</h2><div class="n">${due}<span>kart</span></div></div>
      <button class="btn hl" data-act="studyAll" ${due ? "" : "disabled"}>Çalışmaya başla</button>
      ${all.length ? goalRowHTML() : ""}
    </section>
    ${all.length ? modeSeg() : ""}
    ${all.some(k => k.status === "new") ? `<div class="newinfo">Her oturumda en fazla ${NEW_PER_SESSION} yeni kelime gelir; tekrarı gelenler hep önce gösterilir.</div>` : ""}
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
      }).join("") : `<div class="empty">Henüz deste yok. Aşağıdaki hazır şablonlardan birini ekle ya da kendi kategorini oluştur.</div>`}
    </div>
    <form class="newdeck" data-form="newdeck">
      <input type="text" name="deckname" placeholder="Yeni kategori adı (ör. Environment, Education)" maxlength="60" aria-label="Yeni kategori adı">
      <button class="btn" type="submit">Oluştur</button>
    </form>
    ${all.length ? progressHTML(all) : ""}
    ${STORIES.length ? `<h3 class="sec">Okuma</h3>
    <button class="readcard" data-act="stories">
      <span class="lvl">A1<br>B2</span>
      <span><span class="nm">Seviyeli hikâyeler</span><span class="ds">${STORIES.length} kısa hikâye. Okurken bilmediğin kelimeye dokun, anlamını gör, destene ekle.</span></span>
      <span class="go" aria-hidden="true">→</span>
    </button>` : ""}
    ${[["Hazır şablonlar: seviye desteleri", TEMPLATES.filter(t => t.kind !== "topic")],
       ["Konu desteleri: IELTS Writing konuları", TEMPLATES.filter(t => t.kind === "topic")]].filter(([, ts]) => ts.length).map(([title, ts]) => `
    <h3 class="sec">${title}</h3>
    <div class="tpl">
      ${ts.map(t => `<div class="tpl-item">
        <div class="lvl${t.kind === "topic" ? " emo" : ""}">${esc(t.level)}</div>
        <div><div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.desc)} · ${t.cards.length} kelime</div></div>
        ${used.has(t.key) ? `<span class="added">Eklendi</span>` : `<button class="btn small" data-act="addTpl" data-key="${esc(t.key)}">Ekle</button>`}
      </div>`).join("")}
    </div>`).join("")}
  ` + footer();
  // dar ekranda takvim yana kayar: en yeni haftalar görünsün
  const hm = app.querySelector(".hm"); if (hm) hm.scrollLeft = hm.scrollWidth;
}

function renderDeck(){
  const id = view.id, d = store.decks[id], cs = d.cards || [], c = counts(cs);
  const due = todayCount(cs);
  const q = query.trim().toLowerCase();
  const shown = cs.filter(k => (filter === "all" || k.status === filter) && (!q || k.en.toLowerCase().includes(q) || (k.tr||"").toLowerCase().includes(q)))
                  .sort((a,b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.added||0) - (b.added||0));
  const LIMIT = 200, list = shown.slice(0, LIMIT);
  app.innerHTML = header() + `
    <button class="back" data-act="home">← Destelere dön</button>
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
  const v = k || {en:"",pos:"",tr:"",def:"",ex:""};
  return `<form class="addbox" data-form="card" ${k ? `data-edit="${k.id}"` : ""}>
    <strong>${k ? "Kartı düzenle" : "Yeni kelime ekle"}</strong>
    <div class="two">
      <label>İngilizce<input type="text" name="en" value="${esc(v.en)}" required maxlength="80" autocomplete="off"></label>
      <label>Tür<input type="text" name="pos" value="${esc(v.pos)}" placeholder="n, v, adj…" maxlength="12"></label>
    </div>
    <label>Türkçe anlamı<input type="text" name="tr" value="${esc(v.tr)}" maxlength="120"></label>
    <label>İngilizce tanım (isteğe bağlı)<input type="text" name="def" value="${esc(v.def)}" maxlength="200"></label>
    <label>Örnek cümle (isteğe bağlı)<textarea name="ex" maxlength="300">${esc(v.ex)}</textarea></label>
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
  }
  // sadece soru bölümünü yenile: sayfa kaymasın, okuduğun yer kaybolmasın
  const sec = app.querySelector(".quiz"); if (sec) sec.outerHTML = quizHTML(st);
}

function renderStories(){
  const levels = [...new Set(STORIES.map(s => s.level))];
  app.innerHTML = header() + `
    <button class="back" data-act="home">← Ana sayfa</button>
    <h2 class="ptitle">Seviyeli hikâyeler</h2>
    <p class="hint">Hepsi Fişlik için yazılmış kısa hikâyeler. Okurken bilmediğin kelimeye dokun: Türkçesini ve hikâyedeki cümleyi görürsün, istersen destene eklersin.</p>
    ${levels.map(lv => `
      <h3 class="sec">${esc(lv)} · ${esc(LEVELS[lv] || "")}</h3>
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
    queue = [...group("unknown"), ...group("learning"), ...group("known"), ...fresh];
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
  const nextKnown = k.status === "known" ? Math.max(3, (k.interval||3)*2) : 3;
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
      ${done ? `<div class="reveal">${verdict}<div class="bigword">${esc(k.en)}</div>${k.ex ? `<div class="ex">“${esc(k.ex)}”</div>` : ""}</div>` : `
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
      ${ans("unknown", "a1", "Bilmiyorum", "birazdan tekrar")}
      ${ans("learning", "a2", "Öğreniyorum", "yarın")}
      ${ans("known", "a3", "Öğrendim", `${nextKnown} gün sonra`)}
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
        <p class="hint">Öğrendiklerin 3, sonra 6, 12, 24 gün sonra tekrar karşına çıkacak. Öğreniyorum dediklerin yarın.</p>
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
    ? `<div class="tr">${esc(k.tr) || "—"}</div>${k.def ? `<div class="def">${esc(k.def)}</div>` : ""}${k.ex ? `<div class="ex">“${esc(k.ex)}”</div>` : ""}`
    : `<div class="bigword">${esc(k.en)}</div>${k.pos ? `<div class="pos">${esc(k.pos)}</div>` : ""}${k.ex ? `<div class="ex">“${esc(k.ex)}”</div>` : ""}`;
  const pct = Math.round(s.i / s.queue.length * 100);
  const nextKnown = k.status === "known" ? Math.max(3, (k.interval||3)*2) : 3;
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
      <button class="ans a1" data-act="ans" data-v="unknown" ${s.flipped ? "" : "disabled"}>Bilmiyorum<small>birazdan tekrar</small></button>
      <button class="ans a2" data-act="ans" data-v="learning" ${s.flipped ? "" : "disabled"}>Öğreniyorum<small>yarın</small></button>
      <button class="ans a3" data-act="ans" data-v="known" ${s.flipped ? "" : "disabled"}>Öğrendim<small>${nextKnown} gün sonra</small></button>
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
  go(back && back.name === "deck" && store.decks[back.id] ? back : { name: "home" });
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
  else if (act === "studyEvery") startSession([id], true);
  else if (act === "studyAll") startSession(Object.keys(store.decks), false);
  else if (act === "studyHard") startSession(Object.keys(store.decks), true, k => (k.miss || 0) >= HARD_MIN);
  else if (act === "goal") { activity.goal = +b.dataset.v; saveActivity(); render(); }
  else if (act === "addTpl") {
    const t = TEMPLATES.find(x => x.key === b.dataset.key); if (!t) return;
    const did = uid();
    store.decks[did] = { name: t.name, created: now(), template: t.key,
      cards: t.cards.map(([en,pos,tr,def,ex], i) => makeCard({en,pos,tr,def,ex}, i)) };
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
  if (f.dataset.form === "newdeck") {
    const name = f.deckname.value.trim(); if (!name) return;
    const id = uid(); store.decks[id] = { name, created: now(), cards: [] };
    store.save(id); filter = "all"; query = ""; go({ name: "deck", id });
  }
  if (f.dataset.form === "card") {
    const d = store.decks[view.id]; const data = { en: f.en.value, pos: f.pos.value, tr: f.tr.value, def: f.def.value, ex: f.ex.value };
    if (!data.en.trim()) return;
    if (f.dataset.edit) {
      const k = d.cards.find(c => c.id === f.dataset.edit);
      Object.assign(k, { en: data.en.trim(), pos: data.pos.trim(), tr: data.tr.trim(), def: data.def.trim(), ex: data.ex.trim() });
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
});
app.addEventListener("input", e => {
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
