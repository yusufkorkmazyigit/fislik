/* Fişlik Speaking ve Listening içeriği. Sorular, örnek cevaplar ve açıklamalar Fişlik için yazılmış
   özgün metinlerdir. Lisans: DATA_LICENSE.md (CC BY-SA 4.0) */
window.FISLIK_SPEAKING = {

format: [
  ["Part 1", "4–5 dakika", "Kendin, evin, işin ya da okulun, günlük alışkanlıkların gibi tanıdık konularda kısa sorular. Her cevap 2–3 cümle: cevap + sebep + küçük bir örnek."],
  ["Part 2", "3–4 dakika", "Bir konu kartı (cue card) alırsın. 1 dakika not alarak hazırlanır, sonra 1–2 dakika kesintisiz konuşursun. Hedef: 2 dakikanın tamamını doldurmak."],
  ["Part 3", "4–5 dakika", "Part 2'nin konusuyla ilgili daha soyut, toplumsal sorular. Görüş bildirip gerekçelendirmen, karşılaştırma ve tahmin yapman beklenir."],
],

criteria: [
  { name: "Fluency and Coherence", tr: "Akıcılık ve tutarlılık", band7: "Fazla duraksamadan, uzun konuşabilmek; fikirleri bağlaçlarla mantıklı sıralamak.", tip: "Mükemmel kelimeyi aramak için durma; 'Well, let me think...' gibi doğal kalıplarla zaman kazan ve devam et." },
  { name: "Lexical Resource", tr: "Kelime bilgisi", band7: "Konuya uygun, bazen daha az yaygın kelimeler ve kalıplar; bilmediğin kelimeyi başka türlü anlatabilmek (paraphrase).", tip: "'good, bad, nice' yerine 'rewarding, frustrating, memorable' gibi daha belirgin sıfatlar kullan." },
  { name: "Grammatical Range and Accuracy", tr: "Dilbilgisi", band7: "Basit ve karmaşık cümleleri karışık kullanmak; hatalar anlamı bozmamalı.", tip: "Geçmiş zaman, koşul cümleleri (If I had more time, I would...) ve yan cümleleri (which, although) bilinçli kullan." },
  { name: "Pronunciation", tr: "Telaffuz", band7: "Kolay anlaşılır olmak; vurgu ve tonlamayı anlamı destekleyecek şekilde kullanmak. Aksan sorun değildir.", tip: "Kendi kaydını dinle: kelime sonlarını (-ed, -s) yutuyor musun, cümle vurgusu doğru yerde mi?" },
],

phrases: [
  { group: "Zaman kazanmak", items: [
    ["That's an interesting question. Let me think...", "Bu ilginç bir soru. Bir düşüneyim..."],
    ["I've never really thought about that, but...", "Bunu hiç düşünmemiştim ama..."],
    ["Well, it depends on what you mean by...", "Şey, ...'den ne kastettiğine bağlı."],
  ]},
  { group: "Görüş bildirmek", items: [
    ["Personally, I'd say that...", "Kişisel olarak ... derim."],
    ["As far as I'm concerned,...", "Bana kalırsa..."],
    ["I'm fairly convinced that...", "... olduğuna oldukça eminim."],
  ]},
  { group: "Örnek vermek ve genişletmek", items: [
    ["For instance, when I was at school,...", "Örneğin okuldayken..."],
    ["A good example of this would be...", "Bunun iyi bir örneği ... olur."],
    ["What I mean is that...", "Demek istediğim şu..."],
  ]},
  { group: "Karşılaştırmak ve tahmin etmek", items: [
    ["Compared to my parents' generation,...", "Ebeveynlerimin kuşağına kıyasla..."],
    ["It's likely that in the future...", "Gelecekte muhtemelen..."],
    ["I suspect that more and more people will...", "Sanırım giderek daha fazla insan..."],
  ]},
  { group: "Bilmediğin kelimeyi anlatmak", items: [
    ["I'm not sure of the exact word, but it's a kind of...", "Tam kelimeyi bilmiyorum ama bir tür..."],
    ["It's the thing you use to...", "... için kullandığın şey."],
    ["Sorry, what I meant to say was...", "Pardon, demek istediğim şuydu..."],
  ]},
],

/* Part 1: konu, sorular, bir soruya band 7 tarzı örnek cevap */
part1: [
  { topic: "Hometown", tr: "Memleket", qs: ["Where is your hometown?", "What do you like most about it?", "Has your hometown changed much in recent years?", "Would you like to live there in the future?"],
    sample: ["What do you like most about it?", "I'd say the thing I appreciate most is the sea. My hometown is on the Aegean coast, so even in winter you can take a walk along the seafront, which is incredibly relaxing after a busy day. It's also small enough that you keep bumping into people you know."] },
  { topic: "Work or studies", tr: "İş ya da okul", qs: ["Do you work or are you a student?", "Why did you choose that subject or job?", "What is the most difficult part of it?", "What would you like to do in the future?"],
    sample: ["Why did you choose that subject?", "Mainly because I've always been fascinated by how cities work. I study civil engineering, and what attracted me was the idea that you can see the results of your work in the real world, like a bridge or a building that thousands of people use every day."] },
  { topic: "Home", tr: "Ev", qs: ["Do you live in a house or a flat?", "Which room do you spend the most time in?", "What would you change about your home?", "Is it common for young people in your country to live alone?"],
    sample: ["Which room do you spend the most time in?", "Probably my bedroom, to be honest, because it doubles as my study. I've set up a desk by the window, and that's where I do most of my reading and online classes. In the evenings, though, I tend to move to the living room to spend time with my family."] },
  { topic: "Daily routine", tr: "Günlük rutin", qs: ["What is your daily routine like?", "Are you a morning person or an evening person?", "Is there anything you would like to change about your routine?", "Do you prefer to plan your day or be spontaneous?"],
    sample: ["Are you a morning person or an evening person?", "Definitely an evening person. I find it really hard to concentrate early in the morning, whereas after about eight in the evening my mind seems much sharper. The downside is that I sometimes stay up too late and regret it the next day."] },
  { topic: "Free time", tr: "Boş zaman", qs: ["What do you do in your free time?", "Do you prefer spending free time alone or with others?", "Has the way you spend your free time changed since you were a child?", "Do you think people have enough free time nowadays?"],
    sample: ["Has the way you spend your free time changed since you were a child?", "Quite a lot, actually. As a child I spent almost every afternoon playing football in the street, whereas now most of my free time is spent indoors, reading or watching series. I'd like to get back to doing more physical activities, though."] },
  { topic: "Food", tr: "Yemek", qs: ["What kind of food do you like?", "Do you enjoy cooking?", "Is there any food you disliked as a child but like now?", "Do people in your country often eat out?"],
    sample: ["Is there any food you disliked as a child but like now?", "Yes, spinach is a good example. My mother used to cook it every week and I absolutely hated it. These days, though, I actually order it in restaurants, especially when it's cooked with yoghurt and garlic. I suppose my taste has simply matured."] },
  { topic: "Technology", tr: "Teknoloji", qs: ["How often do you use your phone?", "What do you mainly use the internet for?", "Is there any technology you couldn't live without?", "Do you think people spend too much time on their phones?"],
    sample: ["Is there any technology you couldn't live without?", "I'd have to say my laptop. I use it for almost everything, from attending lectures to keeping in touch with friends abroad. If it broke down tomorrow, I honestly don't know how I would keep up with my studies."] },
  { topic: "Reading", tr: "Okuma", qs: ["Do you like reading?", "What kind of books do you enjoy?", "Do you prefer paper books or e-books?", "Did you read a lot as a child?"],
    sample: ["Do you prefer paper books or e-books?", "I'm a bit old-fashioned in that respect. I much prefer paper books because I like being able to write notes in the margins and see how far I've got. That said, e-books are far more practical when I'm travelling, so I use both."] },
  { topic: "Travel", tr: "Seyahat", qs: ["Do you like travelling?", "Where did you go on your last holiday?", "Do you prefer travelling alone or with others?", "Where would you like to travel in the future?"],
    sample: ["Do you prefer travelling alone or with others?", "It really depends on the trip. For a relaxing beach holiday I'd rather go with friends, because sharing the experience is half the fun. But when I'm visiting a new city, I quite enjoy travelling alone, since I can follow my own schedule and I'm more likely to talk to local people."] },
  { topic: "Music", tr: "Müzik", qs: ["What kind of music do you like?", "Do you play a musical instrument?", "When do you usually listen to music?", "Has your taste in music changed over time?"],
    sample: ["When do you usually listen to music?", "Mostly when I'm commuting or exercising. Music makes a long bus journey feel much shorter, and when I'm running it helps me keep a steady pace. I rarely listen while studying, though, because I find lyrics quite distracting."] },
],

/* Part 2 cue card'ları ve ilgili Part 3 soruları; bazılarında örnek konuşma */
cards: [
  { id: "c01", title: "Describe a skill you learned that you are proud of.", say: ["what the skill is", "when and how you learned it", "how difficult it was to learn"], explain: "and explain why you are proud of it.",
    part3: ["What skills do young people need most today?", "Is it better to learn skills at school or through experience?", "Why do some people give up learning new skills?", "How will the skills people need change in the future?"],
    sample: "I'd like to talk about learning to swim properly, which I only managed when I was nineteen. As a child I could just about keep my head above water, but I was always slightly afraid of deep water, so I avoided it. In my first year at university, a friend persuaded me to join a beginners' course at the campus pool. It met twice a week, early in the morning, which was a challenge in itself for someone like me who isn't a morning person. There were about twelve of us in the group, and most of them were complete beginners too, which made me feel a bit less self-conscious.\n\nThe first few weeks were genuinely difficult. The instructor made us practise breathing with our faces in the water, and I kept panicking and swallowing water. There were moments when I felt quite embarrassed, especially because some of the other learners were making faster progress. What helped was that the instructor broke everything down into small steps, so I could see I was improving even if it was slowly. I also started going to the pool on my own at weekends, just to practise floating and breathing, and that extra practice made a real difference.\n\nBy the end of the term I could swim a full length of freestyle without stopping, and a few months later I swam in the sea for the first time without feeling anxious. I'm proud of it not because it's an impressive skill, since millions of people can swim, but because I faced something I'd been avoiding for most of my life. It taught me that fear often shrinks once you break a challenge into manageable pieces, and I've tried to apply that lesson to other things, like public speaking." },
  { id: "c02", title: "Describe a place you visited that left a strong impression on you.", say: ["where it was", "when you went there", "what you did there"], explain: "and explain why it impressed you.",
    part3: ["Why do people like to visit historical places?", "Does tourism do more good or harm to local communities?", "How has the way people travel changed in recent years?", "Should governments spend money on protecting old buildings?"],
    sample: "The place I'd like to describe is Cappadocia, in central Turkey, which I visited with my family about three years ago during the spring holiday. We stayed for four days in a small hotel that was actually carved into the rock, which was an experience in itself. My parents had been talking about visiting the region for years, so the trip felt quite special for the whole family.\n\nWe did the usual things that tourists do: we explored the underground cities, walked through a couple of valleys and visited churches with paintings that are hundreds of years old. But the moment I remember most clearly is the morning we got up before sunrise to watch the hot-air balloons. There were well over a hundred of them rising slowly over the valleys as the sky turned from dark blue to pink. Everyone around us went quiet, which is quite unusual in a crowd of tourists. I remember feeling slightly cold and very sleepy, but also completely amazed, and I took far too many photos.\n\nWhat impressed me was the combination of nature and human history. The landscape itself looks almost unreal, with those strange rock formations, and then you realise that people have been living inside those rocks for centuries, adapting to a very harsh environment. Our guide told us that some of the cave houses were still being used as homes and storage rooms until fairly recently, which I found fascinating. It made me think about how creative people can be when they have limited resources. I'd love to go back, perhaps in winter, because I've heard the region looks completely different under snow." },
  { id: "c03", title: "Describe a person who has had an important influence on your life.", say: ["who this person is", "how you know them", "what they are like"], explain: "and explain how they have influenced you.",
    part3: ["Who has more influence on children: parents or teachers?", "Do famous people have a responsibility to be good role models?", "How do friends influence young people's decisions?", "Has social media changed who young people look up to?"],
    sample: "The person I'd like to talk about is my secondary school chemistry teacher, Mrs Arslan. I was in her class for three years, between the ages of eleven and fourteen, and we still message each other occasionally. She's retired now, but she still follows what her former students are doing.\n\nShe was quite strict, and at first many of us were a little intimidated by her. She never accepted an answer without asking 'why?', and she would make us explain our reasoning in front of the class. Over time, though, we realised that she wasn't trying to embarrass anyone; she simply believed that every student was capable of thinking properly if they were pushed a little. Outside lessons she was surprisingly warm and funny, and she ran an after-school science club that I joined in my second year. We used to do small experiments there, like building simple batteries out of fruit, and those afternoons were some of my favourite memories of school.\n\nHer influence on me has been enormous. Before her lessons I had always thought of myself as someone who was bad at science, mainly because I found it hard to memorise formulas. She showed me that understanding a process is far more important than memorising it, and that change in attitude made me much more confident. My marks improved, of course, but more importantly I started to enjoy the subject. In fact, it's partly because of her that I decided to study engineering. More generally, she taught me to question things rather than accept them at face value, which I think is useful in every area of life." },
  { id: "c04", title: "Describe a time when you had to make an important decision.", say: ["what the decision was", "when you made it", "what options you had"], explain: "and explain how you felt about the decision afterwards.",
    part3: ["Do young people today have more choices than in the past?", "Should parents make important decisions for their children?", "Why do some people find it hard to make decisions?", "Is it better to make decisions quickly or slowly?"],
    sample: "One important decision I had to make was whether to stay in my hometown for university or move to Istanbul. This was about two years ago, just after I received my exam results.\n\nI had two realistic options. The university in my hometown had offered me a place with a scholarship, which meant I could live with my parents, save money and stay close to my friends. The university in Istanbul had a much stronger engineering department and better links with companies, but living there would be expensive and I didn't know anyone in the city. My parents said they would support whichever choice I made, which was kind of them, but it also meant the responsibility was entirely mine. I remember spending several sleepless nights going back and forth between the two options.\n\nIn the end, I chose Istanbul. I made a list of pros and cons, talked to a few students who were already studying there, and realised that the opportunities were simply too good to turn down. I also felt that living in a big city on my own would push me to grow up quickly, which I thought was a good thing at that age. The first semester was harder than I expected; I felt lonely at times and had to learn to manage my budget carefully. Looking back now, though, I'm glad I took the risk. I've become much more independent, and I've had opportunities, like an internship last summer, that I wouldn't have had otherwise. It taught me that the more comfortable option is not always the right one." },
  { id: "c05", title: "Describe a piece of technology you find useful.", say: ["what it is", "how long you have had it", "what you use it for"], explain: "and explain why you find it useful.",
    part3: ["How has technology changed the way people communicate?", "Are older people disadvantaged by modern technology?", "Should children be allowed to use smartphones?", "What technology do you think will be important in the future?"] },
  { id: "c06", title: "Describe a book or film that you enjoyed.", say: ["what it was", "when you read or watched it", "what it was about"], explain: "and explain why you enjoyed it.",
    part3: ["Why do people enjoy stories?", "Do people read less than they used to?", "Should films based on books stay faithful to the original?", "What can children learn from stories?"] },
  { id: "c07", title: "Describe a time you helped someone.", say: ["who you helped", "what the situation was", "how you helped them"], explain: "and explain how you felt about helping them.",
    part3: ["Why do some people volunteer for free?", "Should schools require students to do community service?", "Are people today less helpful than in the past?", "Who should be responsible for helping people in need?"] },
  { id: "c08", title: "Describe an environmental problem in your area.", say: ["what the problem is", "what causes it", "how it affects people"], explain: "and explain what could be done to solve it.",
    part3: ["Who is more responsible for protecting the environment: individuals or governments?", "Why do some people not care about environmental issues?", "Can technology solve environmental problems?", "How can children be taught to care about nature?"] },
  { id: "c09", title: "Describe a goal you would like to achieve in the future.", say: ["what the goal is", "when you first had this goal", "what you need to do to achieve it"], explain: "and explain why this goal is important to you.",
    part3: ["Is it important to set goals in life?", "Do people's goals change as they get older?", "Why do some people achieve their goals while others do not?", "Should schools teach students how to plan their future?"] },
  { id: "c10", title: "Describe a celebration or festival you enjoyed.", say: ["what it was", "where and when it took place", "what people did"], explain: "and explain why you enjoyed it.",
    part3: ["Why are traditional festivals important?", "Have celebrations changed in your country in recent years?", "Do festivals bring people together or are they too commercial?", "Should governments fund cultural events?"] },
],

/* Part 3 cevabını genişletmek için yapı */
part3tips: [
  ["Cevap", "Soruya ilk cümlede doğrudan cevap ver: 'I think it's mainly the parents' responsibility.'"],
  ["Sebep", "Nedenini açıkla: 'because children spend most of their early years at home...'"],
  ["Örnek", "Genel ya da kişisel bir örnek ver: 'For instance, in my country...'"],
  ["Karşı görüş", "Diğer tarafı kabul et: 'Having said that, teachers also play a role...'"],
  ["Sonuç", "Kısa bir toparlama ya da tahminle bitir: 'So overall, I'd say...'"],
],

listening: {
  format: "Yaklaşık 30 dakika, 4 bölüm, 40 soru. Kayıt yalnızca bir kez dinletilir. Bölüm 1 ve 2 günlük durumlar (form doldurma, bir yer hakkında bilgi), bölüm 3 ve 4 akademik (öğrenci tartışması, ders anlatımı). Kâğıt sınavda sonda cevapları aktarmak için 10 dakika, bilgisayarlı sınavda kontrol için 2 dakika verilir.",
  strategies: [
    ["Soruları önceden oku", "Her bölümden önce verilen sürede soruları oku ve anahtar kelimelerin altını çiz. Ne duyacağını tahmin etmek dinlemeyi çok kolaylaştırır."],
    ["Boşluğun türünü tahmin et", "Boşluğa isim mi, sayı mı, tarih mi, sıfat mı gelecek? 'on ____ Street' bir isim, 'costs £____' bir sayı ister."],
    ["Eş anlamlılara dikkat", "Kayıt, sorudaki kelimeleri nadiren aynen kullanır: soruda 'cheap' varsa kayıtta 'it won't cost much' duyabilirsin."],
    ["Tuzaklara dikkat", "Konuşmacılar sık sık fikir değiştirir: 'Let's meet on Monday... oh no, actually Tuesday is better.' Doğru cevap son söylenendir."],
    ["Kelime sınırına uy", "'NO MORE THAN TWO WORDS AND/OR A NUMBER' yazıyorsa üç kelime yazmak cevabı yanlış yapar."],
    ["Kaçırınca takılma", "Bir cevabı kaçırdıysan hemen bir sonraki soruya geç; kayıt durmaz, sonraki cevapları da kaçırma."],
  ],
  traps: [
    ["Yazım", "Yanlış yazılan kelime yanlış sayılır. Sık hatalar: accommodation, environment, government, necessary, February, Wednesday."],
    ["Harfle söylenen isimler", "İsimler ve sokak adları harf harf okunur (S-M-I-T-H). İngiliz alfabesindeki harflerin okunuşunu çalış; özellikle A/E/I, G/J ve double (WW = double W)."],
    ["Sayılar ve tarihler", "fifteen / fifty, thirteen / thirty gibi çiftleri ayırt et. Tarihler 'the third of May' ya da 'May the third' diye söylenebilir."],
    ["Tekil / çoğul", "Kayıtta 'two tickets' denmişse 'ticket' yazmak yanlış olur."],
  ],
  resources: [
    ["Resmî örnek sorular (ielts.org)", "https://ielts.org/take-a-test/preparation-resources/sample-test-questions", "Sınavı hazırlayan kurumların ücretsiz örnek Listening soruları ve ses dosyaları."],
    ["Resmî hazırlık kaynakları (ielts.org)", "https://ielts.org/take-a-test/preparation-resources", "Ücretsiz hazırlık materyallerinin tamamı."],
    ["IDP hazırlık sayfası", "https://ielts.idp.com/prepare", "IDP'nin ücretsiz deneme materyalleri ve ipuçları."],
    ["BBC Learning English", "https://www.bbc.co.uk/learningenglish", "Kısa haber ve günlük konuşma kayıtları; çoğunda metin de var."],
    ["TED Talks", "https://www.ted.com/talks", "Bölüm 4'teki ders anlatımlarına benzer konuşmalar; altyazıyı önce kapalı, sonra açık izle."],
  ],
},
};
