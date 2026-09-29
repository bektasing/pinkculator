# Pinkculator

Toz pembe bir hesap makinesi; `=` kalp tuşuna 3 saniye basılı tutunca gizli oyun menüsü
açılır (Kalp Sektirme, Kalp Birleştir, Kalp Kulesi). Sadece Android, sadece dikey.

Vite + React + TypeScript, oyunlar Canvas 2D, Android paketi Capacitor 8.

## Geliştirme

```bash
npm install
npm run dev          # tarayıcıda (Chrome DevTools → 390×844 mobil görünüm)
npm test             # Vitest: hesap makinesi motoru ve oyun mantıkları
npm run typecheck
```

## Gereksinimler (APK için)

- **Android Studio** (Android SDK ile birlikte). SDK yolu: `~/Library/Android/sdk`
- **JDK 21.** Gradle, JDK 25 ile çalışmaz. Android Studio'nun içindeki JDK 21 kullanılabilir:

  ```bash
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  ```

  (Bunu `~/.zshrc` dosyasına eklersen her terminalde geçerli olur.)
- `android/local.properties` içinde `sdk.dir=/Users/<kullanıcı>/Library/Android/sdk` satırı olmalı.
  Android Studio projeyi ilk açışta bunu kendisi yazar. Bu dosya repoya girmez.

## Debug APK

Proje kök klasöründe:

```bash
npm run build                 # web kodunu dist/ klasörüne derler
npx cap sync android          # dist/'i ve eklentileri Android projesine kopyalar
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Telefona yüklemek için:

- **USB ile:** Telefonda *Geliştirici seçenekleri → USB hata ayıklama*'yı aç, telefonu bağla:

  ```bash
  ~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```

- **Dosya olarak:** APK'yı telefona gönder (AirDrop yok; Drive, e-posta vb.), dosyaya dokun,
  "bilinmeyen kaynaklardan yüklemeye" izin ver.

Debug APK'da WebView uzaktan hata ayıklama açıktır: telefon USB ile bağlıyken bilgisayarda
Chrome'da `chrome://inspect` sayfasından konsol açılabilir.

## İmzalı release APK

Release APK hediye edilecek sürümdür: daha küçük ve hızlıdır, hata ayıklama kapalıdır.

### 1. Keystore oluştur (sadece bir kez)

Proje kökündeyken:

```bash
"$JAVA_HOME/bin/keytool" -genkeypair -v \
  -keystore android/pinkculator-release.jks \
  -alias pinkculator \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Senden keystore şifresi ve ad/kurum bilgileri istenir. Bu bilgiler APK'da görünmez; istediğini yazabilirsin.
- Anahtar şifresi ayrıca sorulursa aynı şifreyi kullanabilirsin.
- **Keystore dosyasını ve şifreyi kaybetme.** Aynı uygulamanın güncellemesi sadece aynı
  anahtarla imzalanırsa telefondaki kurulu sürümün üstüne yüklenebilir. Dosyanın bir
  yedeğini repo dışında (ör. şifreli bir yerde) sakla.

### 2. `android/keystore.properties` dosyasını oluştur

```properties
storeFile=pinkculator-release.jks
storePassword=KEYSTORE_ŞİFREN
keyAlias=pinkculator
keyPassword=ANAHTAR_ŞİFREN
```

`storeFile` yolu `android/` klasörüne göredir. `*.jks` ve `keystore.properties` `.gitignore`
içinde; ikisi de **asla repoya girmez**. Commit öncesi `git status` ile kontrol edebilirsin.

### 3. Derle

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

`keystore.properties` yoksa aynı komut imzasız bir `app-release-unsigned.apk` üretir.
Bu dosya telefona yüklenemez.

### Güncelleme yayınlarken

`android/app/build.gradle` içinde `versionCode` değerini her yeni APK'da 1 artır
(`versionName` görünen sürümdür, ör. `"1.1"`). Aynı keystore ile imzala.

## Uygulama adı, ikon ve açılış ekranı

- **Ad:** `src/app/appInfo.ts` içindeki `APP_NAME`. Capacitor ayarları, sayfa başlığı ve
  (`cap sync` sonrası) Android'deki uygulama adı buradan okunur.
- **İkon:** Kaynak `design/icon.svg`. Android ikonu adaptive icon'dur:
  - Krem zemin `@color/ic_launcher_background`
  - Kalp `mipmap-*/ic_launcher_foreground.png`
  - Android 13+ temalı ikon `drawable/ic_launcher_monochrome.xml`
  - Eski cihazlar için `ic_launcher.png` / `ic_launcher_round.png`

  SVG değişirse PNG'lerin yeniden üretilmesi gerekir. Bunun için Android Studio'da
  *res → New → Image Asset* kullanılabilir.
- **Açılış ekranı:** Android 12+ SplashScreen API'si kullanılır: krem zemin, ortada aynı kalp
  (`values/styles.xml`). Fontlar yüklenip ilk kare çizilince JS kapatır (`src/platform/splash.ts`).
- **Sesler:** `src/assets/sounds/*.wav` dosyaları `scripts/generate-sounds.mjs` ile sentezlenir
  (dış kaynak veya örnek kullanılmaz). Sesi değiştirmek için betikteki ilgili fonksiyonu düzenleyip
  `node scripts/generate-sounds.mjs` çalıştır. Dosyalar 4 bit IMA ADPCM WAV'dır; uygulama
  bunları kendi çözer (`src/audio/wav.ts`). Seslerin birbirine göre seviyesi `src/audio/sounds.ts`
  içindeki `VOLUMES` tablosundadır.
- **Gizli tarih ekranları:** Kodlar, fotoğraf adları ve mesaj listeleri `src/calculator/secretCode.ts`
  içindeki `SECRET_ENTRIES` dizisindedir; yeni tarih için bir madde eklemek yeterli. Fotoğraflar
  `design/secrets/<kod>.jpg` (ör. `29062023.jpg`). Uzun kenarı ~1200 px'e küçültülmüş JPEG önerilir;
  dosya yoksa ekran fotoğrafsız açılır. Fotoğraf ekleyip değiştirdikten sonra `npm run build` ve
  `npx cap sync android` gerekir.
