"""
Uygulama ikonunu design/icon-source.jpg'den üretir (Android adaptive icon + eski cihaz PNG'leri).

    python3 scripts/generate-icons.py          # gerekir: Pillow (pip install pillow)

İkon ana ekranda yuvarlak köşeli KARE görünür: Android 8+ başlatıcıları ikonu kendi biçimleriyle
(Pixel'de daire) kırptığı için arka plan saydam bırakılır ve kaynaktaki krem kartın kendisi,
dairesel maskenin içine köşeleri kesilmeden sığacak en büyük boyutta ön plana konur.

Katmanlar:
- background : saydam → values/ic_launcher_background.xml
- foreground : kaynaktaki yuvarlak köşeli krem kart (kalp dahil), gri zeminden ayrılmış
- monochrome : kalbin gövdesi (tek renk silüet, "=" boşluk olarak) → Android 13+ temalı ikon
- ic_splash  : açılış ekranı için sadece kalp (+ gölgesi), krem zeminden "fark matlaştırma" ile
               saydam çıkarılır; kalp 66 dp'lik güvenli dairenin içine sığar
- legacy     : API < 26 için kart PNG'leri
Katman/maske önizlemeleri geçici klasöre yazılır (yolu en sonda yazdırılır).
"""
import re
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design/icon-source.jpg"
RES = ROOT / "android/app/src/main/res"
# Katman ve maske önizlemeleri (repoya girmez)
PREVIEW = Path(tempfile.gettempdir()) / "pinkculator-icon-preview"

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
MASTER = 1296  # 108 dp × 12 px: tüm boyutlar bundan küçültülür
UNIT = MASTER / 108
# Kalbin en uzak noktası merkezden bu kadar dp uzakta olur (güvenli daire yarıçapı 33 dp)
HEART_RADIUS_DP = 31.5
# Kartın köşeleri merkezden en fazla bu kadar dp uzakta (dairesel maskenin yarıçapı 36 dp)
TILE_RADIUS_DP = 35.2
# Kaynakta kartın içi (gri dış zemin ve kartın kenar gölgeleri hariç)
CARD_INNER = (728, 285, 1272, 812)
# Krem zeminden bu kadar (0–255 uzaklık) az farklı pikseller tamamen saydam kabul edilir
# (kartın kendi hafif gölgelenmesi foreground'a sızmasın)
NOISE_FLOOR = 11
FULL_OPACITY_AT = 70


def median_color(im, box):
    pixels = sorted(im.crop(box).getdata(), key=lambda p: sum(p))
    return pixels[len(pixels) // 2]


def heart_masks(src, cream, matte):
    """
    Kalbin silüeti (içi dolu) ve "=" çubukları.
    Gövde: fark matlaştırmada tamamen opak çıkan pikseller (gölge yarı saydam kalır, dışarıda kalır).
    Parlama lekeleri ve çubuklar da içeride kalsın diye dış hattan doldurulur.
    Çubuklar: silüetin içinde kreme çok yakın pikseller.
    """
    body = matte.getchannel("A").point(lambda v: 255 if v > 225 else 0)
    # Kenarı pürüzsüzleştir: bulanıklaştırıp yeniden eşikle (küçük girinti/çıkıntılar yok olur)
    body = body.filter(ImageFilter.GaussianBlur(4)).point(lambda v: 255 if v > 128 else 0)
    # Dış hattan doldur: dışarıdan erişilemeyen her şey (parlama, çubuklar) silüetin içidir
    outside = body.copy()
    ImageDraw.floodfill(outside, (0, 0), 128)
    silhouette = outside.point(lambda v: 0 if v == 128 else 255)
    bars = Image.new("L", src.size, 0)
    s, sil, bm = src.load(), silhouette.load(), bars.load()
    cr, cg, cb = cream
    x0, y0, x1, y1 = silhouette.getbbox()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if sil[x, y]:
                r, g, b = s[x, y]
                if max(abs(r - cr), abs(g - cg), abs(b - cb)) < 36:
                    bm[x, y] = 255
    bars = bars.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))  # tek tük pikselleri at
    return silhouette, bars


def difference_matte(src, cream, box):
    """Kartın içinde: P = a·F + (1−a)·C → saydamlık a ve renk F."""
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    s, o = src.load(), out.load()
    cr, cg, cb = cream
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = s[x, y]
            d = max(abs(r - cr), abs(g - cg), abs(b - cb))
            if d <= NOISE_FLOOR:
                continue
            a = min(1.0, (d - NOISE_FLOOR) / (FULL_OPACITY_AT - NOISE_FLOOR))
            f = lambda p, c: max(0, min(255, round(c + (p - c) / a)))
            o[x, y] = (f(r, cr), f(g, cg), f(b, cb), round(a * 255))
    # Kartın kenarına yakın bölgeyi yumuşakça söndür (kenar gölgesi sızmasın)
    fade = Image.new("L", src.size, 0)
    ImageDraw.Draw(fade).rounded_rectangle(box, radius=90, fill=255)
    fade = fade.filter(ImageFilter.GaussianBlur(14))
    alpha = Image.composite(out.getchannel("A"), Image.new("L", src.size, 0), fade)
    out.putalpha(alpha)
    return out


def placement(mask, radius_dp):
    """Şeklin merkezi (kaynak px) ve 108 dp tuvale ölçek: en uzak nokta merkezden radius_dp'de."""
    bbox = mask.point(lambda v: 255 if v > 128 else 0).getbbox()
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    m = mask.load()
    far = 0.0
    for y in range(bbox[1], bbox[3], 2):
        for x in range(bbox[0], bbox[2], 2):
            if m[x, y] > 128:
                far = max(far, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
    return cx, cy, (radius_dp * UNIT) / far, bbox


def to_canvas(layer, cx, cy, scale):
    """Kaynak katmanı 108 dp'lik tuvalin ortasına ölçekleyerek yerleştirir."""
    w, h = round(layer.width * scale), round(layer.height * scale)
    scaled = layer.resize((w, h), Image.LANCZOS)
    canvas = Image.new(layer.mode, (MASTER, MASTER), (0, 0, 0, 0) if layer.mode == "RGBA" else 0)
    canvas.paste(scaled, (round(MASTER / 2 - cx * scale), round(MASTER / 2 - cy * scale)))
    return canvas


def save_sizes(image, name, dp):
    for density, k in DENSITIES.items():
        size = round(dp * k)
        folder = RES / f"mipmap-{density}"
        image.resize((size, size), Image.LANCZOS).save(folder / f"{name}.png", optimize=True)


def tile_layer(src):
    """Kaynaktaki yuvarlak köşeli krem kart: gri zeminden ayrılmış, kenarları yumuşak (RGBA)."""
    mask = Image.new("L", src.size, 0)
    s, m = src.load(), mask.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b = s[x, y]
            m[x, y] = 255 if (r - b) > 14 else 0  # krem ve kalp sıcak (r > b), gri zemin ve gölgesi nötr
    mask = mask.filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 128 else 0)
    outside = mask.copy()
    ImageDraw.floodfill(outside, (0, 0), 128)
    silhouette = outside.point(lambda v: 0 if v == 128 else 255)
    tile = src.convert("RGBA")
    tile.putalpha(silhouette.filter(ImageFilter.GaussianBlur(1.2)))
    return tile, silhouette


def main():
    src = Image.open(SOURCE).convert("RGB")
    cream = median_color(src, (760, 300, 1240, 330))  # kartın üst şeridi

    # Foreground: kartın tamamı; köşeleri dairesel maskenin içinde kalacak şekilde ölçeklenir
    tile, tile_mask = tile_layer(src)
    tx, ty, tile_scale, tile_box = placement(tile_mask, TILE_RADIUS_DP)
    fg = to_canvas(tile, tx, ty, tile_scale)

    # Açılış ekranı ve temalı ikon: sadece kalp
    matte = difference_matte(src, cream, CARD_INNER)
    body, bars = heart_masks(src, cream, matte)
    cx, cy, scale, bbox = placement(body, HEART_RADIUS_DP)
    splash = to_canvas(matte, cx, cy, scale)
    mono_src = Image.composite(Image.new("L", src.size, 0), body, bars)
    mono_alpha = to_canvas(mono_src.filter(ImageFilter.GaussianBlur(1.2)), cx, cy, scale)
    mono = Image.new("RGBA", (MASTER, MASTER), (255, 255, 255, 0))
    mono.putalpha(mono_alpha)

    # Eski cihazlar: kart, 48 dp'nin içinde 1 dp pay ile
    card = tile.crop(tile_box)
    side = MASTER * 46 // 48
    legacy = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    legacy.paste(card.resize((side, side), Image.LANCZOS), ((MASTER - side) // 2, (MASTER - side) // 2))

    save_sizes(fg, "ic_launcher_foreground", 108)
    save_sizes(mono, "ic_launcher_monochrome", 108)
    save_sizes(splash, "ic_splash", 108)
    save_sizes(legacy, "ic_launcher", 48)
    save_sizes(legacy, "ic_launcher_round", 48)

    colors = RES / "values/ic_launcher_background.xml"
    text = colors.read_text()
    text = re.sub(r'(<color name="ic_launcher_background">)#[0-9A-Fa-f]{6,8}(</color>)', r"\g<1>#00000000\g<2>", text)
    colors.write_text(text)

    # Önizlemeler: başlatıcı maskeleri (daire, squircle, yuvarlak kare) koyu duvar kağıdında
    PREVIEW.mkdir(exist_ok=True)
    wallpaper = (28, 30, 44, 255)
    visible = (MASTER * 18 // 108, MASTER * 18 // 108, MASTER * 90 // 108, MASTER * 90 // 108)

    def launcher(shape):
        m = Image.new("L", (MASTER, MASTER), 0)
        d = ImageDraw.Draw(m)
        if shape == "daire":
            d.ellipse(visible, fill=255)
        elif shape == "squircle":
            d.rounded_rectangle(visible, radius=MASTER * 0.2, fill=255)
        else:
            d.rounded_rectangle(visible, radius=MASTER * 0.08, fill=255)
        layer = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
        layer.paste(fg, (0, 0), Image.composite(fg.getchannel("A"), Image.new("L", fg.size, 0), m))
        return Image.alpha_composite(Image.new("RGBA", (MASTER, MASTER), wallpaper), layer).crop(visible)

    sheet = Image.new("RGB", (4 * 250 + 50, 250), wallpaper[:3])
    for i, icon in enumerate([launcher("daire"), launcher("squircle"), launcher("kare"), legacy]):
        sheet.paste(icon.convert("RGB").resize((230, 230), Image.LANCZOS) if i < 3 else
                    Image.alpha_composite(Image.new("RGBA", legacy.size, wallpaper), legacy).convert("RGB").resize((230, 230), Image.LANCZOS),
                    (10 + i * 250, 10))
    sheet.save(PREVIEW / "shapes.png")

    print(f"kart kutusu {tile_box}, kalp kutusu {bbox}, önizleme {PREVIEW}")


if __name__ == "__main__":
    main()
