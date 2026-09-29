import type { CalculatorState } from './engine';

/**
 * Gizli tarih ekranı. Değiştirmek için sadece bu iki satırı düzenlemek yeterli.
 * Kod: ekrana yazılacak rakamlar (başka karakter olmadan).
 */
export const SECRET_CODE = '29062023';
export const SECRET_MESSAGE = 'Seni seviyorum';
// Ekrandaki fotoğraf: src/assets/photos/us.jpg (aynı adla değiştirmek yeterli; 3:4 dikey önerilir).

/**
 * `=` kısa basıldığında gizli ekran açılmalı mı? Sadece kod yazılmışsa ve bekleyen
 * bir işlem yoksa (`+ − × ÷` zincirine girilmemişse) doğrudur.
 */
export function isSecretEntry(state: CalculatorState): boolean {
  return !state.error && state.entry === 'typing' && state.operator === null && state.display === SECRET_CODE;
}
