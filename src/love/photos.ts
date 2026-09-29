/**
 * Gizli ekran fotoğrafları: `design/secrets/` klasöründeki dosyalar derleme sırasında
 * bulunur ve uygulamaya gömülür. Dosya yoksa null döner; ekran fotoğrafsız açılır.
 */
const files = import.meta.glob<string>('../../design/secrets/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function secretPhotoUrl(fileName: string): string | null {
  for (const [path, url] of Object.entries(files)) {
    if (path.endsWith(`/${fileName}`)) return url;
  }
  return null;
}
