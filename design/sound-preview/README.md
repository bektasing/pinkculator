# Ses önizlemeleri

Karşılaştırma için 16 bit PCM WAV (Mac'te Finder'da boşluk tuşuyla dinlenebilir).
Uygulamanın kendisi aynı sesleri IMA ADPCM olarak `src/assets/sounds/` içinde kullanır.

| Klasör | Karakter |
|---|---|
| `0-eski/` | Aşama 8'deki ilk sürüm (tiz, sert atak) — sadece karşılaştırma için |
| `sicak/` | **Uygulamada kullanılan (önerilen).** FM çanlar (1:1, yumuşak indeks), yuvarlak harmonikler, keçe dokunuşlu "pop", kısa oda yankısı |
| `cam/` | Daha berrak, cam/kristal çanlar (FM 3.5 oranı), su damlası gibi yukarı kayan tık, biraz daha fazla yankı |
| `ahsap/` | Her şey marimba/tahta tınısında; en "akustik" ve içi boş-sıcak olanı |

Başka bir varyasyonu uygulamaya almak için:

```bash
node scripts/generate-sounds.mjs --variant cam
```

Seçim yapıldıktan sonra bu klasör silinebilir (uygulama kullanmaz).
