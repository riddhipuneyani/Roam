/** Environment-driven URLs, parsed once. */

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** CLIENT_URL may be a comma-separated list (e.g. prod + preview domains). */
export function clientUrls(): string[] {
  return (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** The canonical frontend URL — used for share links and the PDF print view. */
export function primaryClientUrl(): string {
  return clientUrls()[0];
}
