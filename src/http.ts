/**
 * Fetches a JSON document and parses it with default Skillex headers.
 *
 * @param url - Target URL.
 * @param init - Fetch init overrides.
 * @returns Parsed JSON payload.
 */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, withDefaultHeaders(init));
  if (!response.ok) {
    throw new Error(`Falha ao buscar JSON ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Fetches a UTF-8 text resource with default Skillex headers.
 *
 * @param url - Target URL.
 * @param init - Fetch init overrides.
 * @returns Response text body.
 */
export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, withDefaultHeaders(init));
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo ${url} (${response.status})`);
  }
  return response.text();
}

/**
 * Fetches a UTF-8 text resource and returns `null` when the resource does not exist.
 *
 * @param url - Target URL.
 * @param init - Fetch init overrides.
 * @returns Response text body or `null` for HTTP 404.
 */
export async function fetchOptionalText(url: string, init: RequestInit = {}): Promise<string | null> {
  const response = await fetch(url, withDefaultHeaders(init));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo ${url} (${response.status})`);
  }
  return response.text();
}

/**
 * Fetches a JSON document and returns `null` when the resource does not exist.
 *
 * @param url - Target URL.
 * @param init - Fetch init overrides.
 * @returns Parsed JSON payload or `null` for HTTP 404.
 */
export async function fetchOptionalJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const response = await fetch(url, withDefaultHeaders(init));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Falha ao buscar JSON ${url} (${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * Applies default HTTP headers expected by GitHub-hosted catalog requests.
 *
 * @param init - User-supplied fetch options.
 * @returns Fetch options with default headers merged in.
 */
function withDefaultHeaders(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers || {});
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "skillex");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/vnd.github+json");
  }
  return {
    ...init,
    headers,
  };
}
