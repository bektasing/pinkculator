# Pinkculator — Claude Code Proje Spec'i

Sen bu projede kıdemli bir mobil frontend geliştiricisi ve oyun geliştiricisisin. Kız arkadaşıma hediye edeceğim, **sadece Android telefonda (APK olarak) çalışacak**, toz pembe, çok kaliteli bir hesap makinesi uygulaması yapacağız. Hesap makinesinin içinde gizli bir oyun menüsü ve 3 sonsuz mini oyun olacak.

Kalite çıtası: Bu bir hediye ve görsel kalite her şeyden önemli. "Çalışıyor" yetmez; her dokunuş, her animasyon, her boşluk özenli olmalı. Dribbble kalitesinde, native uygulama hissi veren bir iş istiyorum. Web sayfası gibi hissettirmemeli.

---

## 0. Çalışma şekli (önemli)

- Proje aşağıdaki **7 aşamaya** bölündü (sonradan eklenen özellikler Aşama 8 ve sonrası olarak en sona yazılır). Aşamaları sırayla yap. Bazı aşamalar A/B alt bölümlerinden oluşuyor; alt bölümlerin arasında durma, aşamanın tamamını bitirince dur.
- Her aşamanın sonunda: kodu çalıştır, gerekiyorsa testleri koş, ne yaptığını ve nasıl test edeceğimi kısaca özetle, sonra **benim onayımı bekle**. Onay vermeden bir sonraki aşamaya geçme.
- Görsel referanslar `design/` klasöründe:
  - `design/calculator.png` → hesap makinesi ana ekranı
  - `design/games-menu.png` → oyun menüsü
  Bu görsellere **birebir** sadık kal. UI ile ilgili her aşamada bu görsellere tekrar bak ve kendi ekran çıktını onlarla karşılaştır. Görsellerdeki telefon çerçevesi ve dış arka plan tasarımın parçası değil; sadece ekranın içi uygulanacak.
- Emin olmadığın bir tasarım kararında görsele en yakın olanı seç ve özette belirt.
- **Git: Commit ve push'ları ben manuel yapacağım.** Hiçbir koşulda `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, `git reset` veya geçmişi/uzak depoyu değiştiren başka bir git komutu çalıştırma; commit yapmayı teklif etme. `git status` ve `git diff` gibi sadece okuyan komutlar serbest. Aşama sonunda, istersem kullanabileceğim kısa bir commit mesajı önerisi yazabilirsin.
- `.gitignore` en baştan şunları içermeli: `node_modules`, build çıktıları, `android/app/build`, `*.jks`, `*.keystore`, `keystore.properties` ve imza şifrelerini içeren her dosya. Keystore ve şifreler asla repoya girmemeli.
- Uygulama **sadece mobil, sadece dikey (portrait)**. Masaüstü, tablet, yatay mod, fare/klavye desteği düşünme. Her şey dokunmatik için tasarlanacak.

---

## 1. Teknoloji yığını

- **Vite + React 18 + TypeScript** (strict mode)
- **Motion** (`motion/react`, eski adıyla Framer Motion) → UI animasyonları, yay (spring) geçişleri, ekran geçişleri
- **Oyunlar: HTML Canvas 2D** + kendi yazacağın hafif oyun döngüsü (requestAnimationFrame, fixed timestep). Oyunlar için React render döngüsü kullanma; React sadece oyunun etrafındaki UI (skor, butonlar, oyun sonu kartı) için.
- **Capacitor** (Android) + eklentiler:
  - `@capacitor/haptics` → titreşim
  - `@capacitor/preferences` → rekorlar ve oyun durumu kaydı
  - `@capacitor/status-bar` → durum çubuğu rengi
  - `@capacitor/splash-screen` → açılış ekranı
  - `@capacitor/app` → Android geri tuşu, uygulama arka plana gidince oyunu duraklatma
- **Fontlar uygulamanın içine gömülü** olacak (`@fontsource/nunito` veya `@fontsource/baloo-2`). İnternet olmadan da birebir aynı görünmeli. Hiçbir harici CDN, font veya görsel URL'si kullanma.
- **Vitest** → hesap makinesi mantığı ve oyun mantığı için birim testleri
- CSS: CSS Modules veya düz CSS + CSS değişkenleri (design token'lar). Tailwind kullanma.

---

## 2. Tasarım sistemi

Renkleri `design/` görsellerinden ölç, aşağıdakiler başlangıç değerleri. Görselle çelişirse görsel kazanır.

### Renkler (token'lar)

| Token | Kullanım | Başlangıç değeri |
|---|---|---|
| `--bg-calc` | Hesap makinesi ekran arka planı (krem, hafif pembemsi) | `#FBF3EE` |
| `--display-bg` | Ekran paneli (içe gömük krem kutu) | `#FAF2EA` |
| `--key-num` | Rakam tuşları (krem beyaz) | `#FFF8F1` |
| `--key-fn` | AC, ±, % tuşları (toz pembe) | `#F4CCD5` |
| `--key-op` | ÷ × − + tuşları (koyu gül kurusu) | `#C4687F` |
| `--key-eq` | Kalp şeklindeki = tuşu | `#C4687F` → üstte daha açık parlak ton |
| `--key-shadow` | Tuşların altındaki pembe gölge/kenar | `#EDB9C5` |
| `--ink` | Rakamlar ve ana yazılar (koyu gül-kahve) | `#6E3A47` |
| `--ink-soft` | İkincil yazılar (işlem satırı, "Rekor") | `#A8858C` |
| `--on-op` | Operatör tuşlarındaki semboller | `#FFF6F0` |
| `--bg-menu` | Oyun menüsü arka planı (toz pembe) | `#F3C7D0` |
| `--card` | Oyun kartları (krem) | `#FFF7F0` |

Genel renk karakteri: **toz pembe / gül kurusu / krem**. Asla neon, fuşya, parlak "barbie" pembesi yok. Siyah ve saf gri yok; gölgeler bile pembeye çalan tonlarda.

### Tipografi

- Yuvarlak, dolgun, samimi bir sans-serif: **Nunito** (ExtraBold/Bold/SemiBold). Görseldeki rakamlara ve "Oyunlar" başlığına en yakın ağırlıkları kullan.
- Ekrandaki büyük sonuç: çok kalın (800), büyük, sağa hizalı, `font-variant-numeric: tabular-nums`.
- Sayı formatı **Türkçe**: binlik ayraç nokta, ondalık ayraç virgül (`1.402`, `100,15`).

### Tuşların "puffy" 3D görünümü (en kritik görsel öğe)

Görseldeki tuşlar yumuşak, şişkin, marshmallow/şeker gibi. Bunu tek bir `box-shadow` ile değil, katmanlı olarak yap:

- Büyük köşe yarıçapı (kare tuşlarda ~%32, 0 tuşunda tam hap şekli)
- Alt kısımda tuşun kendi renginden daha koyu, **pembeye çalan** bir "kalınlık" kenarı (0 6px 0 benzeri)
- Onun altında geniş, yumuşak, pembe tonlu bir gölge
- Üst tarafta hafif iç parlama (inset highlight) ve belki çok hafif bir radial gradient ile hacim hissi
- Basınca: tuş 4–5px aşağı iner, kalınlık kenarı küçülür, yay animasyonuyla geri gelir (spring, hafif sekme). Tepki gecikmesi hissedilmemeli: `pointerdown` anında görsel tepki ver.

### Kalp şeklindeki = tuşu

- Görseldeki gibi parlak, hacimli, gül kurusu bir kalp; ortasında krem "=" işareti.
- SVG ile yap: ana kalp + üst sol parlama + alt koyu kalınlık katmanı + pembe gölge. Diğer tuşlarla aynı "basılma" fiziğine sahip olsun.
- Uygulamanın imza öğesi bu. En çok özeni burada göster.

### Hareket prensipleri

- Tüm UI geçişleri spring tabanlı (Motion). Doğrusal (linear) geçiş kullanma.
- `prefers-reduced-motion` açıksa parçacık miktarını azalt, sekmeleri kıs.

---

## 3. Mobil kurallar (her aşamada geçerli)

- Viewport: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
- Safe area: üst çentik ve alt gesture bar için `env(safe-area-inset-*)` kullan. Hiçbir içerik bunların altında kalmamalı.
- Ekranı `100dvh` ile değil, gerçek görünür yükseklikle doldur; kaydırma (scroll) olmayacak. Hesap makinesi ve oyunlar tek ekrana sığmalı.
- Metin seçimi, uzun basma menüsü (context menu / callout), çift dokunma zoom'u, overscroll/pull-to-refresh, tap highlight tamamen kapalı.
- Tüm etkileşimler Pointer Events ile (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). `click`'e güvenme (gecikme ve uzun basma çakışması yüzünden).
- Dokunma alanları en az 48x48dp.
- Küçük ekranlara (360x640) ve büyük ekranlara (412x915 ve üstü) uyum: tuş boyutları ekran genişliğinden türetilsin, oranlar görseldeki gibi kalsın.
- Hedef: orta seviye bir Android telefonda sabit 60 FPS.

---

## AŞAMA 1 — Proje kurulumu ve hesap makinesi motoru

### 1A — Proje kurulumu

1. Vite + React + TS projesini kur, yukarıdaki bağımlılıkları ekle.
2. Klasör yapısı:
   ```
   src/
     app/            # App, ekran yönlendirme (calculator | menu | game:<id>)
     theme/          # tokens.css, global.css, fontlar
     calculator/     # engine.ts (saf mantık), engine.test.ts, UI bileşenleri
     effects/        # kalp parçacıkları (HeartBurst), haptics sarmalayıcı
     menu/           # GamesMenu ve kart illüstrasyonları
     games/
       shared/       # oyun döngüsü, canvas kurulumu (DPR), GameShell, GameOver kartı, skor kaydı
       bounce/       # Kalp Sektirme
       merge/        # Kalp Birleştir
       stack/        # Kalp Kulesi
     platform/       # storage.ts, haptics.ts, backButton.ts (Capacitor sarmalayıcıları, web'de güvenli fallback)
   design/           # referans görseller
   ```
3. Ekran yönetimi için router kütüphanesi kullanma; basit bir state (`screen`) ve Motion `AnimatePresence` ile geçişler yeterli.
4. `platform/` sarmalayıcıları hem Capacitor içinde hem tarayıcıda (geliştirme için) çalışmalı. Tarayıcıda Preferences yerine localStorage, Haptics yerine `navigator.vibrate` veya no-op.
5. Geliştirme sırasında tarayıcıda mobil görünümde (Chrome DevTools, 390x844) test edilebilir olsun.

### 1B — Hesap makinesi motoru (saf mantık + testler)

`calculator/engine.ts` içinde UI'dan tamamen bağımsız, saf bir durum makinesi yaz (reducer tarzı: `state + action → newState`).

Davranış (iOS hesap makinesi mantığına yakın, anında hesaplama):

- Rakam girişi: en fazla 12 hane. Baştaki 0 yerine yeni rakam yazılır.
- Virgül (`,`): bir sayıda tek virgül. İşlemden sonra basılırsa `0,` ile başlar.
- Operatörler `+ − × ÷`: zincirleme işlem desteklenir (`2 + 3 ×` → önce 5 hesaplanır). Art arda operatöre basılırsa son operatör geçerli olur.
- `=`: sonucu hesaplar. Tekrar `=` basılırsa son işlemi tekrarlar (`5 + 2 = = =` → 7, 9, 11).
- `AC / C`: ekranda girilmiş bir sayı varsa tuş "C" yazar ve sadece mevcut girişi siler; sonra "AC" olur ve her şeyi sıfırlar.
- `±`: işaret değiştirir.
- `%`: tek başına /100; `+` veya `−` işleminde `a + b%` → `a + a*b/100`.
- Sıfıra bölme: ekranda "Tanımsız" yazar; sonraki herhangi bir tuş sıfırlar.
- Kayan nokta hataları gizlenir (`0,1 + 0,2 = 0,3`). 12 anlamlı basamağa yuvarla. Çok büyük/küçük sayılar bilimsel gösterime geçer.
- Ekranın üstündeki küçük satır: devam eden işlemi gösterir (`14 × 100,15` gibi, görseldeki gibi). `=` sonrası tam ifade kalır, yeni giriş başlayınca temizlenir.
- Silme: ekran alanında sağa veya sola kaydırma (swipe) son haneyi siler (iOS'taki gibi). Bunu motor tarafında `backspace` aksiyonu olarak tanımla.
- Aktif operatör bilgisi state'te tutulsun (UI'da o tuş vurgulanacak).
- Türkçe formatlama fonksiyonu (`1.402`, `100,15`, `−8`).

**Testler:** Yukarıdaki her kural için Vitest testleri. En az 30 test; zincirleme işlemler, tekrarlı eşittir, yüzde, sıfıra bölme, kayan nokta, hane sınırı, formatlama dahil.

**Aşama sonu:** Fontları gömülü, token'ları tanımlı, çalışan proje; hesap makinesi motorunun tüm testleri yeşil.

---

## AŞAMA 2 — Hesap makinesi arayüzü ve etkileşimler

### 2A — Hesap makinesi arayüzü

`design/calculator.png` görselini birebir uygula.

Yerleşim (yukarıdan aşağıya):

1. Safe area boşluğu.
2. **Ekran paneli:** Geniş, yumuşak köşeli, hafif içe gömük (inset gölge) krem kutu. İçinde sağa hizalı: üstte küçük işlem satırı (`--ink-soft`), altında büyük sonuç (`--ink`, 800 ağırlık). Uzun sayılarda yazı boyutu otomatik küçülsün (taşma asla olmasın), yazı boyutu değişimi yumuşak animasyonlu olsun.
3. **Tuş takımı (4 sütun):**
   ```
   AC   ±    %    ÷
   7    8    9    ×
   4    5    6    −
   1    2    3    +
   0 (2 sütun)  ,   ♥=
   ```
   - AC, ±, % → toz pembe (`--key-fn`), yazı `--ink`
   - Rakamlar ve `,` → krem (`--key-num`), yazı `--ink`
   - Operatörler → gül kurusu (`--key-op`), sembol krem
   - `=` → kalp şeklinde tuş
   - Ondalık tuşu Türkçe formata uygun olarak `,` gösterir.
   - Aktif operatör (işlem seçilmiş, ikinci sayı henüz girilmemiş) görsel olarak belirgin olsun: renkleri ters çevrilsin (krem zemin, gül kurusu sembol), yumuşak geçişle.
4. Tuş takımı ekranın alt kısmına oturur, alt safe area'ya saygı duyar. Ekran paneli kalan alanı kaplar.

Görselde olmayan hiçbir öğe ekleme (başlık, logo, ayar butonu, oyun butonu yok). Oyun menüsü gizli olacak.

Arayüz bitince ekran görüntüsü alıp `design/calculator.png` ile karşılaştır ve farkları düzelt.

### 2B — Etkileşim: kalpler, titreşim, gizli menü

#### Kalp parçacıkları

- Her tuşa basışta, **parmağın dokunduğu noktadan** 2–4 küçük kalp çıksın.
- Kalpler: farklı pembe tonlarında (toz pembe → gül kurusu arası, görseldeki küçük kalpler gibi), hafif hacimli (tek renk düz değil, küçük bir parlama noktası olsun), boyutları rastgele (12–24px).
- Hareket: yukarı doğru süzülür, hafif sağa sola salınır, döner, küçülerek ve solarak ~900ms'de kaybolur.
- `=` tuşunda daha büyük bir patlama (10–14 kalp).
- Performans: parçacıkları tek bir tam ekran canvas katmanında çiz (DOM elemanı oluşturma). Bu katman dokunmaları engellemesin (`pointer-events: none`). Aynı anda 200 parçacıkta bile 60 FPS.

#### Titreşim

- Her tuşta çok hafif titreşim (`ImpactStyle.Light`).
- `=` tuşunda biraz daha güçlü (`Medium`).
- Hata ("Tanımsız") durumunda `NotificationType.Error`.

#### Gizli oyun menüsü: = tuşuna 3 saniye basılı tutma

- `=` tuşuna basılı tutulduğunda 3 saniyelik bir "dolum" başlar.
- **Görsel geri bildirim:** Basılı tutarken kalp tuşunun içi alttan yukarı doğru daha açık/parlak bir tonla dolsun ve kalp hafifçe büyüyüp küçülerek "atmaya" başlasın; atış hızı süre ilerledikçe artsın. İlk ~300ms'de hiçbir şey görünmesin (normal kısa basışlarda titreme olmasın), sonra dolum görünür hale gelsin.
- **Titreşim:** Dolum sırasında kalp atışlarıyla senkron hafif titreşimler.
- **3 saniye dolunca:** güçlü titreşim, ekranı kaplayan büyük bir kalp patlaması, ardından oyun menüsüne yumuşak geçiş (menü alttan yukarı kayarak ya da kalbin olduğu noktadan büyüyerek açılsın).
- **İptal:** Parmak 3 saniye dolmadan kalkarsa veya tuşun alanından belirgin şekilde dışarı kayarsa dolum yumuşakça geri iner, hiçbir şey olmaz.
- **Çakışma kuralı:** Uzun basma menüyü açtıysa parmak kalktığında `=` işlemi **yapılmaz**. Kısa basışta (menü açılmadıysa) `=` normal çalışır. Dolum başlamış ama tamamlanmamışsa (ör. 1,5 sn basılı tutup bırakma) `=` işlemi yine normal yapılsın.
- Uygulamada bu özelliğe dair hiçbir ipucu, yazı, simge olmayacak.

**Aşama sonu:** Görselle yan yana konduğunda ayırt edilemeyecek kadar yakın, kalpleri, titreşimi ve 3 saniyelik basılı tutmasıyla tamamen bitmiş hesap makinesi. (Menü bu aşamada boş bir yer tutucu ekran olabilir.)

---

## AŞAMA 3 — Oyun menüsü ve ortak oyun altyapısı

### 3A — Oyun menüsü

`design/games-menu.png` görselini birebir uygula.

- Arka plan: toz pembe (`--bg-menu`). Başlığın etrafında küçük, soluk kalpler ve parıltılar (sparkle) — görseldeki gibi; çok hafif, yavaş bir parıldama animasyonu olabilir.
- Sol üstte yuvarlak krem geri butonu (`<` ok simgesi). Hesap makinesine döner.
- Ortada büyük, kalın başlık: **"Oyunlar"** (`--ink`).
- Alt alta 3 büyük kart (krem, çok yuvarlak köşeli, puffy gölgeli, hesap makinesi tuşlarıyla aynı görsel dil):
  1. **Kalp Sektirme** — sağda: çubuğun üstünde zıplayan hacimli pembe kalp illüstrasyonu (hareket çizgileriyle)
  2. **Kalp Birleştir** — sağda: pembe zeminli 4x4 minik ızgara, farklı pembe tonlarında kalpler, ortada bir altın kalp
  3. **Kalp Kulesi** — sağda: pastel pembe tonlarında üst üste dizilmiş, hafif kaymış bloklardan bir kule, tepesinde küçük bir kalp
- Her kartın solunda: oyun adı (kalın, iki satıra bölünebilir) ve altında "Rekor: X" (`--ink-soft`). Hiç oynanmamışsa "Rekor: —".
- İllüstrasyonları **SVG bileşenleri** olarak çiz (görsel dosyası kullanma), görseldeki hacimli/parlak stile yakın olsun. İllüstrasyonlarda hafif sürekli animasyon olabilir: kalp yavaşça zıplasın, altın kalp parıldasın, kulenin tepesindeki kalp hafifçe sallansın. Abartma.
- Karta dokununca kart basılma animasyonu (tuşlarla aynı fizik) ve oyun ekranına geçiş.
- Menü açılışında kartlar sırayla (stagger) yay animasyonuyla yerine otursun — tek, orkestre edilmiş bir giriş anı.

### 3B — Ortak oyun altyapısı

`games/shared/` içinde:

- **Canvas kurulumu:** Ekran boyutuna ve `devicePixelRatio`'ya göre keskin çizim; boyut değişince yeniden kurulum.
- **Oyun döngüsü:** Sabit zaman adımlı (fixed timestep, 60Hz) güncelleme + interpolasyonlu çizim. Uygulama arka plana geçince (`App` `pause` olayı / `visibilitychange`) otomatik duraklat.
- **GameShell:** Her oyunun ortak çerçevesi:
  - Sol üstte kapatma (✕) butonu → menüye döner
  - Sağ üstte "EN İYİ 013" tarzı rekor göstergesi (3 haneli, soluk)
  - Safe area uyumu
- **Başlangıç durumu:** Oyun açıldığında "Başlamak için dokun" gibi kısa, soluk bir yazı; ilk dokunuşla oyun başlar.
- **Oyun sonu kartı:** Yumuşak bulanık arka plan üzerinde krem kart: "Oyun bitti", büyük skor, rekorsa "Yeni rekor!" + ekranı kaplayan kalp yağmuru ve güçlü titreşim. Butonlar: **"Tekrar oyna"** (gül kurusu, puffy) ve **"Menüye dön"** (sade metin butonu). Kalp yağmuru yazıların ve butonların **arkasında** kalsın, okunabilirliği asla bozmasın.
- **Rekor kaydı:** `platform/storage.ts` üzerinden oyun başına en iyi skor. Menü kartlarındaki "Rekor" değerleri buradan okunur.
- **Kalp çizim yardımcısı:** Canvas'ta hacimli, parlak kalp çizen tek bir fonksiyon (renk, boyut, dönüş, opaklık parametreli); üç oyun da bunu kullanır. Performans için kalpleri önceden offscreen canvas'a çizip cache'le.
- Ortak parçacık sistemi (hesap makinesindeki kalp patlamalarıyla aynı görünüm).

**Aşama sonu:** Görselle birebir menü; kartlardan oyun ekranlarına geçiş; ortak altyapı (GameShell, oyun sonu kartı, rekor kaydı, kalp çizimi) boş bir test sahnesiyle çalışır halde.

---

## AŞAMA 4 — Oyun 1: Kalp Sektirme (Instagram DM emoji oyunu tarzı)

Referans: Instagram mesajlarındaki gizli emoji sektirme oyunu. Aynı his, bizim renklerimiz ve kalbimizle.

**Görünüm:**
- Arka plan: toz pembe tonlarında yumuşak bir dikey gradient.
- Ekranın ortasında **çok büyük, soluk skor** (arka plan renginin biraz koyusu, ~%25 opaklık, ekran genişliğinin ~%40'ı yüksekliğinde). Oyun elemanları bu skorun önünde.
- Sağ üstte "EN İYİ 013", sol üstte ✕.
- Altta gül kurusu, yuvarlak uçlu, puffy bir **çubuk (hap şekli)**. Genişlik: ekran genişliğinin ~%30'u.
- Hacimli pembe kalp (topun yerine), ~56dp.

**Kontroller:**
- Parmak ekranın herhangi bir yerinde sürüklendiğinde çubuk yatayda parmağın x konumunu takip eder (hafif yumuşatmayla, ama gecikme hissettirmeden). Çubuk dikeyde sabit, alt safe area'nın biraz üstünde.

**Fizik:**
- Kalp yerçekimiyle düşer.
- Çubuğa çarpınca yukarı doğru sabit bir hızla fırlar (her vuruşta ekranın üst ~%20'lik kısmına kadar çıkabilecek kadar).
- Yatay hız, kalbin çubuğun neresine çarptığına bağlı: ortaya çarparsa düz yukarı, kenarlara yakın çarparsa o yöne açılı.
- Kalp dönerek hareket eder; dönüş yönü ve hızı yatay hızla ilişkili.
- Yan duvarlardan seker. Üst sınır yok (ekranın üstünden kısa süre çıkabilir, geri gelir) ama ekran dışına kaçıp kaybolmamalı.
- Her vuruşta yerçekimi ve fırlatma hızı birlikte biraz artar → oyun giderek hızlanır ama her zaman oynanabilir kalır (bir üst sınır koy).
- Kalp çubuğun altına düşüp ekranın altından çıkarsa oyun biter.

**Skor ve his:**
- Her başarılı vuruş +1. Vuruşta: çubuk hafifçe basılır (squash), kalp anlık yassılaşıp geri gelir (squash & stretch), 3–4 kalp parçacığı, hafif titreşim, arkadaki büyük skor rakamı küçük bir "pop" animasyonu yapar.
- Her 10 puanda arka plan gradient'i bir sonraki pembe tonuna yumuşakça geçer (ör. toz pembe → şeftali pembe → lila pembe → gül → tekrar başa). Tonlar hep bizim paletimizin içinde kalsın.
- Oyun başında kalp ekranın ortasının biraz üstünde durur; ilk dokunuşla düşmeye başlar.

---

## AŞAMA 5 — Oyun 2: Kalp Birleştir (2048)

**Görünüm:**
- Arka plan krem. Üstte skor ve en iyi skor, iki küçük puffy rozet içinde ("Skor", "En iyi").
- Ortada 4x4 ızgara: toz pembe zeminli, yuvarlak köşeli, hafif içe gömük tahta; boş hücreler biraz daha koyu pembe yuvalar (menü kartındaki illüstrasyon gibi).
- Taşlar: yuvarlak köşeli krem kareler, her birinin içinde hacimli bir kalp ve kalbin üstünde değeri (küçük, kalın, okunaklı).
- Değer → kalp rengi ilerlemesi (açıktan koyuya, sonra özel): 2 açık pudra, 4 pudra, 8 toz pembe, 16 pembe, 32 gül, 64 gül kurusu, 128 koyu gül, 256 mürdüm, 512 şarap, 1024 bordo, **2048 altın kalp** (parıltılı), 4096+ altın + ışık halesi.
- Değer büyüdükçe kalp hafifçe daha "gösterişli" olsun (parlama artsın).

**Kontroller ve mantık:**
- Dört yöne kaydırma (swipe). Minimum mesafe eşiği ve baskın yön tespiti; yanlışlıkla çapraz kaydırmalar doğru yöne yorumlansın.
- Klasik 2048 kuralları: kaydırma yönünde taşlar kayar, aynı değerli iki taş birleşir (bir hamlede bir taş en fazla bir kez birleşir), her geçerli hamleden sonra boş bir hücreye 2 (%90) veya 4 (%10) gelir. Hiçbir şey değişmeyen hamle geçersizdir, yeni taş gelmez.
- Skor: birleşen taşların toplam değeri.
- Oyun mantığını saf bir modülde yaz ve Vitest ile test et (kayma, tek birleşme kuralı, geçersiz hamle, oyun sonu tespiti).

**Animasyonlar:**
- Kayma: ~110ms, ease-out.
- Birleşme: yeni taş "pop" yapar (büyüyüp geri gelir) + küçük kalp parçacıkları + hafif titreşim.
- Yeni taş: sıfırdan büyüyerek belirir.
- Skor artışı: skor rozetinin yanından "+32" gibi bir yazı yukarı süzülür.
- Animasyonlar arka arkaya hızlı kaydırmalarda bozulmamalı (hamle kuyruğu veya animasyonu anında tamamlayıp yeni hamleyi uygulama).

**Diğer:**
- 2048'e ulaşınca: altın kalp parıltısı, kalp yağmuru ve "2048!" kartı. Butonlar: "Devam et" (sonsuz devam) ve "Yeniden başla".
- Hamle kalmayınca ortak oyun sonu kartı.
- **Tek adım geri alma** butonu (skor rozetlerinin yanında küçük yuvarlak bir buton).
- Devam eden oyun kaydedilsin: uygulama kapanıp açılınca oyun kaldığı yerden devam etsin. Rekor, en yüksek skor olarak kaydedilsin.

---

## AŞAMA 6 — Oyun 3: Kalp Kulesi (Stack tarzı)

**Görünüm:**
- 2D yandan görünüm (menü illüstrasyonundaki gibi), arka plan açık pembe → kreme doğru dikey gradient. Kule yükseldikçe gradient'in tonu yavaşça değişir.
- Bloklar: yuvarlak köşeli (ama tuşlardan daha az yuvarlak), puffy, alt kenarında kalınlık hissi olan pastel pembe dikdörtgenler. Her kat bir öncekinden biraz farklı tonda (toz pembe → pudra → gül → şeftali pembe arasında yumuşak döngü).
- Kulenin en üst bloğunun üstünde küçük bir kalp durur ve her yeni kat eklendiğinde yeni tepeye zıplar.
- Skor (kat sayısı) ekranın üst ortasında büyük ve kalın.

**Oynanış:**
- Zemin bloğu ekranın alt kısmında sabit.
- Yeni blok ekranın bir tarafından gelip yatayda ileri geri kayar. Ekrana dokununca olduğu yerde bırakılır ve alttaki bloğun üstüne oturur.
- Alttaki blokla örtüşmeyen (taşan) kısım kesilir: kesilen parça ayrı bir parça olarak dönerek ve düşerek ekrandan çıkar (basit fizik: yerçekimi + dönme). Kalan kısım bir sonraki katın genişliği olur.
- Hiç örtüşme yoksa blok düşer ve oyun biter.
- **Mükemmel yerleştirme:** Kayma farkı çok küçükse (ör. ≤ 5dp) blok tam hizaya "snap" olur, kesilme olmaz. Mükemmel yerleştirmede: blok kısa bir parlama yapar, etrafında halka şeklinde kalp parçacıkları, hafif titreşim, üst üste mükemmel yerleştirmelerde artan bir kombo sayacı ("Mükemmel x3"). 3 ve üzeri komboda blok biraz genişler (başlangıç genişliğini aşmadan).
- Kule yükseldikçe kamera yumuşakça yukarı kayar; ekranda her zaman son ~6–8 kat görünür.
- Blokların kayma hızı katlarla birlikte yavaşça artar (bir üst sınıra kadar).
- Skor = konulan kat sayısı.

**Oyun sonu:** Son blok düştükten sonra kamera kısa bir süre geri çekilip (zoom-out) kulenin tamamını gösterir, ardından ortak oyun sonu kartı açılır.

---

## AŞAMA 7 — Android paketleme, cila ve kalite kontrol

### 7A — Android paketleme

1. Capacitor Android platformunu ekle, `appId` olarak `com.bektasing.pinkculator` kullan.
2. **Sadece dikey:** `AndroidManifest.xml`'de `android:screenOrientation="portrait"`.
3. **Durum çubuğu:** Hesap makinesi ekranında krem, menüde toz pembe arka plan; ikonlar koyu. Ekran değiştikçe durum çubuğu rengi de değişsin. Uygulama edge-to-edge çizilsin, safe area'ya saygı duyulsun.
4. **Android geri tuşu:**
   - Oyun içinde → oyunu duraklatır/kapatır, menüye döner
   - Menüde → hesap makinesine döner
   - Hesap makinesinde → uygulamayı arka plana alır
5. **Uygulama ikonu:** Krem zemin üzerinde gül kurusu, hacimli kalp; içinde krem "=" işareti (hesap makinesinin kalp tuşuyla aynı). Adaptive icon (foreground + background katmanları) olarak hazırla. *(Güncelleme: ikonun kaynağı artık `design/icon-source.jpg`; katmanlar, Android 13+ tek renkli ikon ve eski cihaz PNG'leri `scripts/generate-icons.py` ile bu görselden üretilir. Eski `design/icon.svg` kaldırıldı.)*
6. **Açılış ekranı (splash):** Krem arka plan, ortada aynı kalp. Kısa sürsün, uygulamaya yumuşak geçiş.
7. **Uygulama adı:** "Pinkculator" (tek bir sabit olarak tut).
8. WebView'de metin ölçeklendirmesini (sistem yazı boyutu) devre dışı bırak ki tasarım bozulmasın.
9. Build talimatları: debug APK nasıl alınır, imzalı release APK nasıl alınır (keystore oluşturma dahil), APK'nın çıktı yolu. Bunları `README.md` içine adım adım yaz.

### 7B — Cila ve kalite kontrol

Aşağıdaki listeyi tek tek kontrol et ve sonuçları raporla:

- [ ] Hesap makinesi ve menü ekran görüntüleri `design/` görselleriyle yan yana karşılaştırıldı; renk, oran, köşe yarıçapı, gölge ve tipografi farkları giderildi.
- [ ] 360x640, 390x844 ve 412x915 ekran boyutlarında hiçbir şey taşmıyor, kesilmiyor, kaydırma yok.
- [ ] Hesap makinesi motoru testleri ve 2048 mantık testleri yeşil.
- [ ] Hiçbir tuşta algılanan gecikme yok; hızlı art arda basışlar kaçırılmıyor.
- [ ] Uzun basma: kısa basışta tetiklenmiyor, 3 sn'de tetikleniyor, iptal düzgün çalışıyor, menü açıldığında `=` işlemi yapılmıyor.
- [ ] Üç oyun da 60 FPS; 5 dakika oynamada bellek sızıntısı yok (parçacıklar temizleniyor).
- [ ] Uygulama arka plana alınıp geri gelince oyunlar duraklatılmış oluyor, kalp "kendiliğinden düşmüş" olmuyor.
- [ ] Rekorlar uygulama kapatılıp açılınca korunuyor; 2048'de devam eden oyun korunuyor.
- [ ] İnternet kapalıyken her şey (fontlar dahil) birebir aynı görünüyor.
- [ ] Android geri tuşu her ekranda doğru davranıyor.
- [ ] Metin seçimi, zoom, uzun basma menüsü, overscroll hiçbir yerde görünmüyor.
- [ ] Tüm kullanıcıya görünen metinler Türkçe ve yazım hatası yok.
- [ ] Konsolda hata veya uyarı yok.

Son olarak: projeyi kısa bir mimari özetle, bilinen sınırlamalarla ve "sonraki adım" önerileriyle birlikte bana raporla.

---

## AŞAMA 8 — Ses efektleri ve gizli tarih ekranı

İki parça; aralarında durma, ikisi bitince dur. Git kuralları aynen geçerli.

### 8A — Ses efektleri

Zevkli ama abartısız, "arka planda kalan" sesler. Uygulama içinde ses ayarı veya kapatma tuşu yok; seviye telefonun medya sesiyle ayarlanır, sessiz mod / rahatsız etmeyin davranışı Android'e bırakılır.

| Nerede | Ses |
|---|---|
| Rakam ve fonksiyon tuşları (AC, ±, %, operatörler) | Yumuşak, kısa "tık/pop"; görsel basışla (pointerdown) senkron |
| `=` kalp tuşu, kısa basış | Biraz daha belirgin, tatlı "ding" |
| 3 sn basılı tutma | Dolum ilerledikçe artan hafif nabız sesi; dolunca ayrı, belirgin "açılış" sesi |
| Menü kartı seçimi | Hafif tık |
| Kalp Sektirme vuruşu | Kısa "boing" |
| Kalp Birleştir | Birleşmede kısa ses; 2048'de ayrı kutlama sesi |
| Kalp Kulesi | Blok oturunca ses; "Mükemmel"de ayrı, daha parlak ses |
| Yeni rekor (her oyun) | Oyun sonu kartıyla birlikte kısa kutlama sesi |

- Sesler küçük, gömülü dosyalar (WAV/OGG, birkaç KB hedef); hiçbir harici URL yok, internetsiz çalışır.
- Seviyeler birbirine göre dengeli; hiçbiri rahatsız edici yüksek değil.
- Üst üste tetiklenen sesler bozulmamalı (aynı sesin eski kopyaları kısaca susturulur / karıştırılır).
- Tarayıcının "kullanıcı etkileşimi olmadan ses yok" kısıtlaması: ses altyapısı ilk dokunuşta güvenle başlar, konsola hata düşmez.
- Sesler mevcut titreşim/parçacık tetikleyicilerine eklenir, onların yerine geçmez; testler bozulmaz.
- Rapor: seslerin kaynağı (sentez mi, hangi kaynak), dosya boyutları, toplam eklenen boyut.
- **Ses karakteri (revizyon):** İlk sürüm tiz ve "ucuz" bulundu. Hedef: yumuşak, sıcak, "pahalı uygulama" hissi (iOS sistem sesleri, Monument Valley / Alto's Odyssey tarzı). Yumuşak atak ve sönüş (ani başlangıç/kesilme yok); tonlar ~1 oktav pes ama telefon hoparlörünün duyurabildiği bantta; tek sinüs yerine katmanlı tını (harmonikler, çanlarda kısa FM sentez, tahta seslerde marimba partiyelleri); uzun seslerde 10–30 ms'lik kısa oda yankısı. Tap sesi en çok cilalanan: sert tık yerine parmak ucuyla yumuşak yüzeye dokunma hissi veren "pop". Birkaç varyasyon üretilip dinlendi (`sicak` seçildi, önizleme klasörü sonra silindi); seçilen uygulamaya yazılır, VOLUMES yeni tınılara göre dengelenir. Format (gömülü ADPCM), olay→ses eşlemesi ve polifoni yönetimi aynı kalır.

### 8B — Gizli tarih ekranları

3 saniyelik menü mekanizmasından tamamen bağımsız ikinci gizli özellik. Birden fazla gizli tarih vardır; her birinin kendi kodu, fotoğrafı ve mesaj listesi olur.

| Kod | Anlamı | Fotoğraf | Mesajlar |
|---|---|---|---|
| `29062023` | Tanışma tarihi | `design/secrets/29062023.jpg` | "Seni seviyorum." · "O gün seninle tanıştığım için hâlâ şanslı hissediyorum." · "Bu hesap makinesi çok şey hesaplayabilir ama seni ne kadar sevdiğimi asla." · "İyi ki o gün karşıma çıktın." |
| `08072008` | Onun doğum günü | `design/secrets/08072008.jpg` | "İyi ki doğdun aşkım. Dünyaya geldiğin gün, benim de en şanslı günlerimden biri oldu." · "Bugün senin günün. Seni kutluyorum, seni seviyorum." · "Sen doğduğun için dünya biraz daha güzel bir yer." · "Nice mutlu, sağlıklı ve birlikte geçireceğimiz yaşlara." |
| `25062007` | Benim doğum günüm | `design/secrets/25062007.jpg` | "25 Haziran 2007'de doğdum, ama hayatımın en güzel kısmı seninle başladı." · "Bugün benim doğum günüm ama asıl hediye seni tanımak oldu." · "O gün doğdum ki bir gün sana denk geleyim." |

- **Tetikleme:** Kodlardan biri tam olarak yazılıp `=` **kısa** basılırsa ve bekleyen bir işlem yoksa (`+ − × ÷` zincirine girilmemişse) normal hesaplama yapılmaz, o girişin ekranı açılır. Hesap makinesi baştaki sıfırı ekranda göstermediği için (`08072008` → ekranda `8.072.008`) eşleşme basılan tuşlarla yapılır.
- **Rastgele mesaj:** Ekran her açıldığında o girişin listesinden rastgele biri; son gösterilen hariç tutulur (art arda aynı mesaj gelmez). Her girişin geçmişi ayrıdır; uygulama açık kaldığı sürece hatırlanır, diske yazılmaz.
- **Fotoğraf:** Dosya `design/secrets/` içinde yoksa (veya bozuksa) uygulama çökmez; ekran sadece mesaj + kalplerle açılır. Dosya ekleyince yeniden derlemek gerekir.
- **Görünüm (tek bileşen, üçü için aynı):** Toz pembe / gül kurusu / krem tema. Fotoğraf üst-ortada, krem puffy çerçeveli kartta (menü kartlarıyla aynı dil), oranı korunur. Altında mesaj (Nunito, kalın, ortalı; uzun mesajda yazı küçülür). Kalpler fotoğrafın ve yazının arkasında/etrafında kalır, üstlerine binmez; bazıları yavaşça yukarı süzülür, bazıları sabit durur (mevcut kalp çizimi ve parçacık sistemi). 360×640'ta da fotoğraf + mesaj + Kapat sığar.
- **Açılış:** Güçlü titreşim + geniş kalp patlaması + açılış sesi, ardından yumuşak geçiş.
- **Kapatma:** Diğer overlay'lerle tutarlı küçük bir "Kapat" butonu ve Android geri tuşu hesap makinesine döndürür; dönünce hesap makinesi sıfırlanır.
- Menüyle çakışmaz: bu ekran açıkken `=`'e uzun basılması hiçbir şey yapmaz.
- Uygulamada bu özelliğe dair hiçbir ipucu yok.
- **Kod organizasyonu:** `src/calculator/secretCode.ts` içinde tek bir `SECRET_ENTRIES` dizisi, her madde `{ code, photo, messages }`. Yeni tarih = yeni madde.
- **Testler:** Üç kodun doğru girişi tetiklemesi, bekleyen işlemde tetiklenmemesi, mesajların art arda tekrar etmemesi.
