// QR credentials live in the fragment, which is not sent in HTTP requests.
// Accept only the QR format; do not fall back to URL query parameters.
export function tableTokenFromHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const tokens = params.getAll("table");
  if (tokens.length !== 1) return null;
  const token = tokens[0];
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
