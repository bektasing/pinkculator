/**
 * Mobil görünüm korumaları:
 * - --app-height: gerçek görünür yükseklik (100dvh yerine), boyut değişince güncellenir
 * - uzun basma bağlam menüsü, çoklu dokunma zoom'u ve sürükleme kapalı
 */
function updateAppHeight(): void {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
}

export function installViewportGuards(): void {
  updateAppHeight();
  window.addEventListener('resize', updateAppHeight);
  window.visualViewport?.addEventListener('resize', updateAppHeight);

  const prevent = (event: Event) => event.preventDefault();
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('dragstart', prevent);
  document.addEventListener('selectstart', prevent);
  // Çoklu parmakla pinch zoom'u engelle.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );
}
