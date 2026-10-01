# Fişlik — IELTS kelime kartları

Fişlik, IELTS'e hazırlananlar için yapılmış sade bir kelime kartı uygulamasıdır. Kelimeler kategorilere (destelere) ayrılır. Her kartı çevirdikten sonra **Bilmiyorum**, **Öğreniyorum** ya da **Öğrendim** dersin. Uygulama da her kelimeyi unutmaya başlayacağın zamana denk gelecek şekilde yeniden karşına çıkarır (*spaced repetition*, aralıklı tekrar).

Sunucu, hesap ya da kurulum gerekmez. Tek bir HTML sayfasıdır ve verilerin tarayıcında saklanır.

## Özellikler

- **Hazır desteler:** A2, B1, B2 ve IELTS 7+ (C1) seviyelerinde, her biri en sık kullanılan 500 kelimeden oluşur. Toplam 2000+ kelime ve hepsinin Türkçe anlamı var. Bunlara ek olarak tanım ve örnek cümleleriyle 24 kelimelik *Paket #1 · Memory & Learning* destesi de gelir.
- **Seviyeli hikâyeler:** A1, A2, B1 ve B2 seviyelerinde beşer kısa hikâye. Okurken bir kelimeye dokununca Türkçe anlamı ve hikâyedeki cümle görünür; istersen kelimeyi o cümleyle birlikte istediğin desteye eklersin (varsayılan: *Hikâye kelimeleri*). Çekimli hâller köke bağlanır (*went → go*), *look after* gibi kalıplar tek parça seçilir.
- **Aralıklı tekrar:**
  - *Bilmiyorum* → kart aynı oturumun sonunda bir kez daha gelir.
  - *Öğreniyorum* → kart ertesi gün gelir.
  - *Öğrendim* → kart 3, 6, 12, 24… gün sonra gelir.
- **Günlük yeni kelime sınırı:** Bir oturumda en fazla 20 yeni kelime gelir, tekrarı gelenler her zaman önce gösterilir. 500 kelimelik bir deste seni boğmaz.
- **Kendi destelerin:** İstediğin kategoriyi açabilirsin. Her kelime için İngilizce, tür, Türkçe anlam, tanım ve örnek cümle ekleyebilirsin.
- **Kart yönü:** İngilizce → Türkçe ya da Türkçe → İngilizce çalışabilirsin.
- **Arama ve filtre:** Deste içinde kelime arayabilir, kartları duruma göre süzebilirsin.
- **Yedekleme:** İlerlemeni JSON dosyası olarak indirip başka bir cihaza yükleyebilirsin.
- **Klavye kısayolları:** Boşluk kartı çevirir, 1 / 2 / 3 cevap verir, Esc oturumdan çıkar.
- **Telefona kurulabilir:** GitHub Pages üzerinden açınca tarayıcıdan *Ana ekrana ekle* diyebilirsin. Uygulama bir kez açıldıktan sonra internetsiz de çalışır.
- **Görünüm:** Mobil uyumlu, karanlık mod destekli.

## Çalıştırma

Klasörü indirip `index.html` dosyasını tarayıcıda açman yeterli. Çevrimdışı çalışma ve ana ekrana ekleme yalnızca sayfa bir web sunucusundan açıldığında çalışır (GitHub Pages ya da yerelde `python -m http.server`).

### GitHub Pages ile yayınlama

1. Bu klasörü bir GitHub deposuna yükle.
2. **Settings → Pages** bölümünde *Source* olarak `main` dalını ve `/ (root)` klasörünü seç.
3. Birkaç dakika sonra uygulama `https://<kullanici-adin>.github.io/<depo-adi>/` adresinde yayında olur.

## Proje yapısı

```
index.html          Sayfa iskeleti
css/style.css       Tasarım (açık/koyu tema)
js/app.js           Uygulama mantığı (bağımlılık yok)
data/decks.js       Uygulamanın yüklediği hazır desteler
data/*.json         Aynı desteler, başka projelerde kullanmak için JSON olarak
data/stories.js     Hikâyeler ve hikâye sözlüğü
manifest.webmanifest, icons/   Ana ekrana ekleme bilgileri ve ikonlar
sw.js               Çevrimdışı çalışma (service worker)
```

Service worker dosyaları önce önbellekten verir, arkada da yenilerini indirir. Bu yüzden yayınladığın bir değişiklik kullanıcıya sayfanın ikinci açılışında ulaşır. Önbellekteki dosya listesini değiştirirsen `sw.js` içindeki `CACHE` adını artır (ör. `fislik-v2`).

Her desteye ait JSON dosyasındaki `cards` alanı `[ingilizce, tür, türkçe, tanım?, örnek?]` dizilerinden oluşur.

## Hikâye nasıl eklenir?

`data/stories.js` içindeki `stories` listesine `{ id, level, title, tr, text }` biçiminde bir nesne ekle. `text` içinde paragrafları boş satırla ayır; birden fazla kelimelik kalıpları `{look after}` gibi süslü paranteze al.

Tıklanan kelimenin anlamı `lexicon` sözlüğünden gelir: `"apples": ["apple", "n", "elma"]` (çekimli hâl → kök, tür, Türkçe) ya da kök ile aynıysa `"apple": ["n", "elma"]`. Sözlükte olmayan kelimeler (özel isimler, *the*, *is* gibi) tıklanmaz. Bir kelime bir hikâyede farklı anlamdaysa o hikâyeye `gloss: { "lives": ["life", "n", "hayat"] }` ekleyerek sözlüğü ezebilirsin.

## Deste nasıl eklenir?

`data/decks.js` içindeki `window.FISLIK_TEMPLATES` listesine aynı biçimde yeni bir nesne ekle:

```js
{ "key": "environment", "name": "Environment", "level": "B2",
  "desc": "Çevre konulu IELTS kelimeleri", "source": "kendi listem",
  "cards": [["pollution", "n", "kirlilik", "harmful substances in the environment", "Air pollution is a major problem in cities."]] }
```

## Kelime listelerinin kaynağı

- Kelimelerin seviyeleri **CEFR-J Wordlist 1.5** ve **Octanove Vocabulary Profile C1/C2 1.0** listelerinden alındı.
- Her seviyede, alt seviyelerde hiç geçmeyen kelimeler seçildi.
- Bu kelimeler [wordfreq](https://github.com/rspeer/wordfreq) kütüphanesindeki kullanım sıklığına göre sıralandı ve her seviyeden ilk 500 kelime alındı.
- Türkçe anlamlar bu proje için hazırlandı.
- Hikâyeler ve hikâye sözlüğü Fişlik için yazıldı; başka bir eserden alınmadı.

Hata gördüğün bir anlam olursa *issue* açabilir ya da düzeltmeyi *pull request* olarak gönderebilirsin.

Kaynaklar:

- The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from http://www.cefr-j.org/download.html (via [openlanguageprofiles/olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj)).
- Octanove Vocabulary Profile C1/C2 ver 1.0, Octanove Labs, CC BY-SA 4.0.

## Lisans

- **Kod** (`index.html`, `css/`, `js/`): [MIT](LICENSE)
- **Kelime verisi** (`data/`): [DATA_LICENSE.md](DATA_LICENSE.md)

## Geliştirici

**Yusuf Korkmazyiğit**

---

### English

Fişlik is a lightweight, dependency-free flashcard web app for IELTS vocabulary. It uses spaced repetition and ships with four ready-made decks (CEFR A2, B1, B2 and C1, 500 words each) with Turkish translations, plus a small themed starter pack. It also includes 20 original graded stories (A1–B2): tap any word to see its Turkish meaning and add it, with its sentence, to a deck. The app can be installed to the home screen and used offline.

To use it, open `index.html` in a browser or host the folder on GitHub Pages. Your progress is stored in the browser and can be exported as JSON.

Code is MIT-licensed. Word data is licensed under CC BY-SA 4.0 (see `DATA_LICENSE.md`).

Developed by Yusuf Korkmazyiğit.
