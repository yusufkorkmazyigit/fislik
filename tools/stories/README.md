# Hikâye araçları

`data/stories.js` bu klasördeki kaynaklardan üretilir. Hikâye ya da sözlükte değişiklik yaptıktan sonra proje kökünden çalıştır:

```
python tools/stories/build.py
```

Betik her hikâyedeki her kelimenin sözlükte karşılığı olup olmadığını kontrol eder. Eksik varsa listeler ve dosyayı **yazmaz**.

## Dosyalar

- `stories_src.py`, `stories_more.py`: hikâye metinleri. `{look after}` gibi süslü parantezler tek parça tıklanan kalıptır.
- `lexicon/*.txt`: sözlük. Her satır bir kelime:
  - `apples: apple | n | elma`: çekimli hâl, kök, tür, Türkçe
  - `apple: n | elma`: kök hâli kendisiyse
  - `@a2-football lost: lose | v | kaybetmek`: yalnızca o hikâyede geçerli anlam
  - `ahmet`: iki nokta yoksa özel isim, tıklanmaz
- `quizzes.py`: True / False / Not Given soruları, `(ifade, "T" | "F" | "NG", Türkçe açıklama)`. Her hikâyede A1–A2 için en az 3, B1 için 4, B2 için 5 soru ve her türden en az bir tane olmalı; betik bunu kontrol eder.
- `tokens.py`: kelime ayırma kuralları (`js/app.js` ile aynı olmalı).
- `build.py`: kontrol eder ve `data/stories.js` dosyasını yazar.
