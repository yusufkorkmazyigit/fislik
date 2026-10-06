import re, sys, os, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stories_src import STORIES

# app.js ile aynı kurallar
TOKEN = re.compile(r"\{([^}]+)\}|([^\W\d_]+(?:['’-][^\W\d_]+)*)")
STOP = set("""a an the i you he she it we they me him her us them my your his its our their
is am are was were be been being and or but to of 's
i'm you're he's she's it's we're they're i've you've we've they've i'd you'd he'd she'd we'd they'd
i'll you'll he'll she'll we'll they'll that's there's what's let's
don't doesn't didn't can't couldn't won't wouldn't isn't aren't wasn't weren't hasn't haven't hadn't shouldn't""".split())

def key_of(word):
    k = word.lower().replace("’", "'")
    if k.endswith("'s") and k not in STOP: k = k[:-2]
    return k

def tokens(text):
    for m in TOKEN.finditer(text):
        yield (m.group(1) or m.group(2)), bool(m.group(1))

if __name__ == "__main__":
    cnt = collections.Counter()
    for s in STORIES:
        n = 0
        for w, multi in tokens(s["text"]):
            n += len(w.split()) if multi else 1
            k = key_of(w)
            if k in STOP: continue
            cnt[k] += 1
        print(s["id"], n, "kelime", file=sys.stderr)
    print(len(cnt), "benzersiz", file=sys.stderr)
    print(" ".join(sorted(cnt)))
