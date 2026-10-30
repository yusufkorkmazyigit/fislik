// IELTS Reading verisini kontrol eder: soru sayısı, cevap geçerliliği, boşluk cevaplarının metinde geçmesi.
// Kullanım: node tools/check_reading.js
global.window = {};
require("../data/reading.js");
const R = window.FISLIK_READING;
const problems = [];
for (const t of R.tests) {
  let total = 0;
  t.passages.forEach((p, pi) => {
    const text = p.paras.map(x => x[1]).join(" "), low = text.toLowerCase();
    let n = 0;
    for (const g of p.groups) {
      for (const it of g.items) {
        n++;
        if (!it.why) problems.push(`açıklama yok: ${it.q}`);
        if (g.type === "gap") it.a.forEach(a => {
          if (!low.includes(a)) problems.push(`boşluk cevabı metinde yok: ${a}`);
          if (a.split(" ").length > g.words) problems.push(`kelime sınırı aşıldı: ${a}`);
        });
        if (["mc", "heading", "match"].includes(g.type)) {
          const opts = g.type === "mc" ? it.options : g.options;
          if (!(it.a >= 0 && it.a < opts.length)) problems.push(`geçersiz seçenek: ${it.q}`);
        }
        if (g.type === "tfng" && !["T", "F", "NG"].includes(it.a)) problems.push(`tfng cevabı: ${it.q}`);
        if (g.type === "ynng" && !["Y", "N", "NG"].includes(it.a)) problems.push(`ynng cevabı: ${it.q}`);
      }
      if (g.type === "heading" || g.type === "match") {
        const s = g.items.map(i => i.a);
        if (new Set(s).size !== s.length) problems.push(`aynı seçenek iki kez cevap: ${g.instr.slice(0, 20)}`);
      }
    }
    console.log(`${t.id} pasaj ${pi + 1}: ${text.split(/\s+/).length} kelime, ${n} soru`);
    total += n;
  });
  console.log(`${t.id}: toplam ${total} soru`);
  if (total !== 40) problems.push(`${t.id}: 40 soru olmalı, ${total} var`);
}
console.log(problems.length ? problems : "sorun yok");
process.exit(problems.length ? 1 : 0);
