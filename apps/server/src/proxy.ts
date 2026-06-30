export interface CrawlProxy {
  id: number;
  url: string;
}

export interface AxiosProxyOptions {
  protocol: string;
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

export function normalizeProxyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('INVALID_PROXY_URL');
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('INVALID_PROXY_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('UNSUPPORTED_PROXY_PROTOCOL');
  }
  if (!parsed.hostname || !parsed.port) {
    throw new Error('INVALID_PROXY_URL');
  }

  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function proxyUrlToAxiosProxy(url: string): AxiosProxyOptions {
  const parsed = new URL(normalizeProxyUrl(url));
  const proxy: AxiosProxyOptions = {
    protocol: parsed.protocol.replace(/:$/, ''),
    host: parsed.hostname,
    port: Number(parsed.port),
  };

  if (parsed.username || parsed.password) {
    proxy.auth = {
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }

  return proxy;
}