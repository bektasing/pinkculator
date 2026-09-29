import type { CalculatorAction, CalculatorState } from './engine';

/**
 * Gizli tarih ekranları. Yeni bir tarih eklemek için listeye bir madde eklemek yeterli.
 *
 * - `code`: ekrana yazılacak rakamlar (başka karakter olmadan)
 * - `photo`: `design/secrets/` klasöründeki dosya adı. Dosya yoksa ekran fotoğrafsız açılır.
 *   Dosya ekleyip değiştirdikten sonra uygulamayı yeniden derlemek gerekir (npm run build).
 * - `messages`: ekran her açıldığında aralarından biri seçilir (art arda aynısı gelmez)
 */
export interface SecretEntry {
  code: string;
  photo: string;
  messages: string[];
}

export const SECRET_ENTRIES: SecretEntry[] = [
  {
    // Tanıştığımız gün
    code: '29062023',
    photo: '29062023.jpg',
    messages: [
      'Seni seviyorum.',
      'O gün seninle tanıştığım için hâlâ şanslı hissediyorum.',
      'Bu hesap makinesi çok şey hesaplayabilir ama seni ne kadar sevdiğimi asla.',
      'İyi ki o gün karşıma çıktın.',
    ],
  },
  {
    // Onun doğum günü
    code: '08072008',
    photo: '08072008.jpg',
    messages: [
      'İyi ki doğdun aşkım. Dünyaya geldiğin gün, benim de en şanslı günlerimden biri oldu.',
      'Bugün senin günün. Seni kutluyorum, seni seviyorum.',
      'Sen doğduğun için dünya biraz daha güzel bir yer.',
      'Nice mutlu, sağlıklı ve birlikte geçireceğimiz yaşlara.',
    ],
  },
  {
    // Benim doğum günüm
    code: '25062007',
    photo: '25062007.jpg',
    messages: [
      "25 Haziran 2007'de doğdum, ama hayatımın en güzel kısmı seninle başladı.",
      'Bugün benim doğum günüm ama asıl hediye seni tanımak oldu.',
      'O gün doğdum ki bir gün sana denk geleyim.',
    ],
  },
];

/**
 * Yazılan rakam dizisi. Hesap makinesi baştaki sıfırı ekranda göstermez (0 → 8 yazınca "8"),
 * bu yüzden "08072008" gibi kodlar ekrandan değil, basılan tuşlardan eşleştirilir.
 * Rakam dışındaki her tuş (backspace hariç) diziyi sıfırlar.
 */
export function trackTypedDigits(typed: string, before: CalculatorState, action: CalculatorAction): string {
  if (action.type === 'digit') {
    const continuing = before.entry === 'typing' && !before.awaitingOperand && !before.error;
    return (continuing ? typed : '') + action.digit;
  }
  if (action.type === 'backspace') return typed.slice(0, -1);
  return '';
}

const withoutLeadingZeros = (digits: string) => digits.replace(/^0+(?=\d)/, '');

/**
 * `=` kısa basıldığında hangi gizli ekran açılmalı? Sadece bir kod tam olarak yazılmışsa
 * (ekrandaki sayı da o tuşlarla oluşmuşsa) ve bekleyen bir işlem yoksa (`+ − × ÷` zincirine
 * girilmemişse) o giriş döner, yoksa null.
 */
export function findSecretEntry(
  state: CalculatorState,
  typed: string,
  entries: readonly SecretEntry[] = SECRET_ENTRIES,
): SecretEntry | null {
  if (state.error || state.entry !== 'typing' || state.operator !== null) return null;
  if (state.display !== withoutLeadingZeros(typed)) return null;
  return entries.find((entry) => entry.code === typed) ?? null;
}

/**
 * Listeden rastgele bir indeks seçer; liste 2+ elemanlıysa `last` hariç tutulur
 * (aynı mesaj art arda iki kez gelmez).
 */
export function pickMessageIndex(count: number, last: number | null, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  const excluded = last !== null && last >= 0 && last < count;
  const pool = excluded ? count - 1 : count;
  const index = Math.min(pool - 1, Math.floor(random() * pool));
  return excluded && index >= last ? index + 1 : index;
}

/** Her girişin en son gösterilen mesajı (uygulama açık kaldığı sürece; diske yazılmaz) */
const lastShown = new Map<string, number>();

/** Girişin bir sonraki mesajı: son gösterilen hariç rastgele. Girişlerin geçmişi birbirinden bağımsız. */
export function nextSecretMessage(entry: SecretEntry, random: () => number = Math.random): string {
  const index = pickMessageIndex(entry.messages.length, lastShown.get(entry.code) ?? null, random);
  lastShown.set(entry.code, index);
  return entry.messages[index] ?? '';
}
