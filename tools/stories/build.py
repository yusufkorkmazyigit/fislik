import json, re, sys, glob, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from stories_src import STORIES
from tokens import tokens, key_of, STOP
from quizzes import QUIZZES

lex, names, over = {}, set(), {}
for f in sorted(glob.glob(os.path.join(HERE, "lexicon", "*.txt"))):
    for ln, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.strip()
        if not line: continue
        story = None
        if line.startswith("@"):
            story, line = line[1:].split(" ", 1)
        if ":" not in line:
            names.add(line.lower()); continue
        k, rest = line.split(":", 1)
        parts = [p.strip() for p in rest.split("|")]
        if len(parts) == 2: parts = [k.strip()] + parts
        assert len(parts) == 3 and all(parts), (f, ln, line)
        lemma, pos, tr = parts
        entry = [pos, tr] if lemma == k.strip() else [lemma, pos, tr]
        if story: over.setdefault(story, {})[k.strip()] = entry
        else:
            assert k.strip() not in lex, ("duplicate", k)
            lex[k.strip()] = entry

ids = {s["id"] for s in STORIES}
assert set(over) <= ids, set(over) - ids
used, missing = set(), {}
for s in STORIES:
    for w, multi in tokens(s["text"]):
        k = key_of(w)
        if k in STOP or k in names: continue
        if k in over.get(s["id"], {}) or k in lex: used.add(k); continue
        missing.setdefault(k, s["id"])
print("eksik:", missing)
print("kullanılmayan:", sorted(set(lex) - used))
if missing: sys.exit(1)

# sorular: her hikâyede olmalı, cevap T / F / NG, açıklama boş olmamalı
qmin = {"A1": 3, "A2": 3, "B1": 4, "B2": 5}
assert set(QUIZZES) == ids, ("soru eşleşmesi", set(QUIZZES) ^ ids)
for s in STORIES:
    q = QUIZZES[s["id"]]
    assert len(q) >= qmin[s["level"]], (s["id"], "az soru")
    for st, ans, why in q:
        assert st.strip() and why.strip() and ans in ("T", "F", "NG"), (s["id"], st)
    assert {a for _, a, _ in q} >= {"T", "F", "NG"}, (s["id"], "her türden en az bir soru olmalı")

out = {
    "stories": [dict(id=s["id"], level=s["level"], title=s["title"], tr=s["tr"],
                     text=s["text"].strip(), quiz=[list(q) for q in QUIZZES[s["id"]]],
                     **({"gloss": over[s["id"]]} if s["id"] in over else {}))
                for s in STORIES],
    "lexicon": {k: lex[k] for k in sorted(used)},
}
dst = os.path.normpath(os.path.join(HERE, "..", "..", "data", "stories.js"))
with open(dst, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("/* Fişlik hikâyeleri: Fişlik için yazılmış özgün metinler. Lisans: DATA_LICENSE.md (CC BY-SA 4.0)\n"
             "   text içinde {kalıp} tek parça tıklanan ifadedir. lexicon: kelime -> [tür, türkçe] ya da [kök, tür, türkçe];\n"
             "   bir hikâyedeki gloss, aynı kelime için lexicon'u ezer. quiz: [ifade, T|F|NG, Türkçe açıklama]. */\n")
    fh.write("window.FISLIK_STORIES = ")
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")
print("yazıldı:", dst, os.path.getsize(dst), "bayt,", len(out["lexicon"]), "kelime")
