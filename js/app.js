(() => {
"use strict";

/* ---------- veri ---------- */
const TEMPLATES = window.FISLIK_TEMPLATES || [];
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

/* ---------- telaffuz: tarayıcının kendi sesleriyle ---------- */
const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
// Ses listesi bazı tarayıcılarda geç gelir; "voiceschanged" olayını en fazla 2 sn bekle.
function loadVoices(){
  const vs = speechSynthesis.getVoices();
  if (vs.length) return Promise.resolve(vs);
  return new Promise(res => {
    const done = () => { clearTimeout(t); speechSynthesis.removeEventListener("voiceschanged", done); res(speechSynthesis.getVoices()); };
    const t = setTimeout(done, 2000);
    speechSynthesis.addEventListener("voiceschanged", done);
  });
}
function englishVoice(voices){
  const en = voices.filter(v => /^en([-_]|$)/i.test(v.lang));
  const score = v => (/^en[-_]GB/i.test(v.lang) ? 4 : /^en[-_]US/i.test(v.lang) ? 2 : 0)
                   + (/natural|neural|online|google|premium|enhanced/i.test(v.name) ? 3 : 0)
                   + (v.localService ? 0 : 1);
  return en.sort((a, b) => score(b) - score(a))[0] || null;
}
function noVoiceHelp(){
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Telefonunda İngilizce ses yok. Ayarlar → Metin okuma çıkışı bölümünden İngilizce ses verisini indir.";
  if (/iPhone|iPad|Mac/i.test(ua)) return "Cihazında İngilizce ses yok. Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler bölümünden İngilizce bir ses indir.";
  if (/Windows/i.test(ua)) return "Bilgisayarında İngilizce ses yok. Ayarlar → Saat ve dil → Konuşma → Ses ekle ile English (United Kingdom) ekle ya da Chrome/Edge kullan.";
  return "Bu tarayıcıda İngilizce ses bulunamadı. Chrome ya da Edge ile deneyebilirsin.";
}
async function speak(text){
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  const v = englishVoice(await loadVoices());
  // İngilizce ses yoksa okuma: tarayıcı varsayılan (çoğu zaman Türkçe) sesle okur, yanlış telaffuz öğretir.
  if (!v) { toast(noVoiceHelp(), 8000); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v; u.lang = v.lang.replace("_", "-"); u.rate = 0.9;
  speechSynthesis.speak(u);
}
if (canSpeak) speechSynthesis.getVoices(); // bazı tarayıcılar ses listesini ilk çağrıda yüklemeye başlar

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
let editing = null;
let session = null;
function go(v){ view = v; editing = null; window.scrollTo(0, 0); render(); }

const app = document.getElementById("app");
function render(){
  if (view.name === "deck" && !store.decks[view.id]) view = { name: "home" };
  if (view.name === "home") renderHome();
  else if (view.name === "deck") renderDeck();
  else if (view.name === "study") renderStudy();
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

function renderHome(){
  const decks = Object.entries(store.decks).sort((a,b) => (a[1].created||0) - (b[1].created||0));
  const all = decks.flatMap(([,d]) => d.cards || []);
  const due = todayCount(all);
  const used = new Set(decks.map(([,d]) => d.template || (d.starter ? "paket1" : null)).filter(Boolean));
  app.innerHTML = header() + `
    <section class="today">
      <div><h2>Bugün çalışılacak</h2><div class="n">${due}<span>kart</span></div></div>
      <button class="btn hl" data-act="studyAll" ${due ? "" : "disabled"}>Çalışmaya başla</button>
    </section>
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
    <h3 class="sec">Hazır şablonlar</h3>
    <div class="tpl">
      ${TEMPLATES.map(t => `<div class="tpl-item">
        <div class="lvl">${esc(t.level)}</div>
        <div><div class="nm">${esc(t.name)}</div><div class="ds">${esc(t.desc)} · ${t.cards.length} kelime</div></div>
        ${used.has(t.key) ? `<span class="added">Eklendi</span>` : `<button class="btn small" data-act="addTpl" data-key="${esc(t.key)}">Ekle</button>`}
      </div>`).join("")}
    </div>
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
    <button class="back" data-act="home">← Destelere dön</button>
    <div class="dtitle"><input type="text" value="${esc(d.name)}" data-field="deckname" aria-label="Deste adı" maxlength="60"></div>
    ${barHTML(c, cs.length)}
    <div style="margin:8px 0 16px">${legendHTML(c)}</div>
    <div class="row">
      <button class="btn hl" data-act="study" data-id="${id}" ${due ? "" : "disabled"}>Bugünküleri çalış (${due})</button>
      <button class="btn ghost" data-act="studyEvery" data-id="${id}" ${cs.length ? "" : "disabled"}>Hepsini çalış</button>
    </div>
    <div class="row" style="margin-top:12px">
      <span class="hint">Kartın ön yüzü:</span>
      <div class="seg" role="group" aria-label="Kart yönü">
        <button data-act="dir" data-v="en" aria-pressed="${direction==="en"}">İngilizce</button>
        <button data-act="dir" data-v="tr" aria-pressed="${direction==="tr"}">Türkçe</button>
      </div>
    </div>
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
            ${canSpeak ? `<button class="ib" data-act="say" data-id="${k.id}" aria-label="${esc(k.en)} kelimesini sesli oku" title="Sesli oku">🔊</button>` : ""}
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

/* ---------- çalışma ---------- */
function cardOf(it){ const d = store.decks[it.deck]; return d && (d.cards || []).find(k => k.id === it.id); }
function startSession(deckIds, everything){
  const items = [];
  deckIds.forEach(id => (store.decks[id].cards || []).forEach(k => items.push({ deck: id, id: k.id, k })));
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
        <p class="hint">Öğrendiklerin 3, sonra 6, 12, 24 gün sonra tekrar karşına çıkacak. Öğreniyorum dediklerin yarın.</p>
        <button class="btn hl" data-act="endStudy">Tamam</button>
      </div>`;
    return;
  }
  const it = s.queue[s.i], k = cardOf(it);
  if (!k) { s.i++; return renderStudy(); }
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
  // Türkçe yönde İngilizceyi okumak cevabı söylemek olur; ses yalnızca İngilizce yüz görünürken çıkar
  const showSay = canSpeak && (frontEn ? !s.flipped : s.flipped);
  app.innerHTML = `
    <div class="top studytop"><button class="back" data-act="endStudy">← Çık</button><span class="sync">${STATUS[k.status].label}</span></div>
    <div class="prog"><div class="track"><i style="width:${pct}%"></i></div><span>${s.i + 1} / ${s.queue.length}</span></div>
    <div class="stage">
      <button class="flip ${s.flipped ? "on" : ""}" data-act="flip" aria-label="Kartı çevir" aria-live="polite">
        <div class="face front-f"><span class="tag">${frontEn ? "İngilizce" : "Türkçe"}</span><span class="deckn">${esc(deckName)}</span>${front}<span class="tap">Anlamını düşün, sonra çevir</span></div>
        <div class="face back-f"><span class="tag">${frontEn ? "Türkçe" : "İngilizce"}</span><span class="deckn">${esc(deckName)}</span>${back}</div>
      </button>
      ${showSay ? `<button class="say" data-act="say" aria-label="Sesli oku" title="Sesli oku (S)">🔊</button>` : ""}
    </div>
    <div class="answers">
      <button class="ans a1" data-act="ans" data-v="unknown" ${s.flipped ? "" : "disabled"}>Bilmiyorum<small>birazdan tekrar</small></button>
      <button class="ans a2" data-act="ans" data-v="learning" ${s.flipped ? "" : "disabled"}>Öğreniyorum<small>yarın</small></button>
      <button class="ans a3" data-act="ans" data-v="known" ${s.flipped ? "" : "disabled"}>Öğrendim<small>${nextKnown} gün sonra</small></button>
    </div>
    <div class="keys">Klavye: Boşluk çevir · 1 Bilmiyorum · 2 Öğreniyorum · 3 Öğrendim${canSpeak ? " · S sesli oku" : ""}</div>
  `;
}
function answer(v){
  const s = session; if (!s || !s.flipped) return;
  const it = s.queue[s.i], k = cardOf(it);
  if (k) {
    if (v === "unknown") { k.interval = 0; k.due = now(); }
    else if (v === "learning") { k.interval = 1; k.due = now() + DAY; }
    else { k.interval = k.status === "known" ? Math.max(3, (k.interval || 3) * 2) : 3; k.due = now() + k.interval * DAY; }
    k.status = v; k.seen = (k.seen || 0) + 1; k.last = now();
    store.save(it.deck);
    if (s.i < s.total) s.res[v]++;
    if (v === "unknown" && !s.retried.has(it.id)) { s.retried.add(it.id); s.queue.push({ ...it }); }
  }
  s.i++; s.flipped = false; renderStudy();
}
function endStudy(){
  const back = session && session.from; session = null;
  if (canSpeak) speechSynthesis.cancel();
  go(back && back.name === "deck" && store.decks[back.id] ? back : { name: "home" });
}
function sayCurrent(){
  const s = session; if (!s || s.i >= s.queue.length) return;
  if (direction === "tr" && !s.flipped) return; // cevabı ele vermesin
  const k = cardOf(s.queue[s.i]); if (k) speak(k.en);
}

/* ---------- yedekleme (GitHub sürümü) ---------- */
function exportBackup(){
  const blob = new Blob([JSON.stringify({ app: "fislik", version: 1, exported: new Date().toISOString(), decks: store.decks }, null, 1)], { type: "application/json" });
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
  else if (act === "addTpl") {
    const t = TEMPLATES.find(x => x.key === b.dataset.key); if (!t) return;
    const did = uid();
    store.decks[did] = { name: t.name, created: now(), template: t.key,
      cards: t.cards.map(([en,pos,tr,def,ex], i) => makeCard({en,pos,tr,def,ex}, i)) };
    store.save(did); toast(`${t.cards.length} kelimelik deste eklendi.`); render();
  }
  else if (act === "dir") { direction = b.dataset.v; render(); }
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
  else if (act === "say") {
    if (view.name === "study") sayCurrent();
    else { const k = (store.decks[view.id]?.cards || []).find(c => c.id === id); if (k) speak(k.en); }
  }
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

app.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
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
  if (view.name !== "study" || !session) return;
  if (e.target.matches("input,textarea")) return;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); session.flipped = !session.flipped; renderStudy(); }
  else if (e.key === "1") answer("unknown");
  else if (e.key === "2") answer("learning");
  else if (e.key === "3") answer("known");
  else if (e.key === "s" || e.key === "S") sayCurrent();
  else if (e.key === "Escape") endStudy();
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
