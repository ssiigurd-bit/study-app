// Mørk/lys modus. Valget lagres i localStorage så det kan brukes før appen starter (index.html).
export type ThemeChoice = 'system' | 'light' | 'dark';

export function getTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#f8fafc');
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem('theme', choice);
  } catch {
    /* privat modus: valget gjelder bare denne gangen */
  }
  apply(choice);
}

export function initTheme() {
  apply(getTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(getTheme()));
}
