export const BRAND_STORAGE_KEY = 'scp:brandId';
export const BRAND_COOKIE_NAME = 'scp-brand-id';
export const NOVAWEAR_BRAND_NAME = 'NovaWear';

export function persistBrandId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BRAND_STORAGE_KEY, id);
  document.cookie = `${BRAND_COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readStoredBrandId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BRAND_STORAGE_KEY);
}

export function clearBrandId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BRAND_STORAGE_KEY);
  document.cookie = `${BRAND_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
