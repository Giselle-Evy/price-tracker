import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * Errores propios del paquete shared.
 * No dependemos del AppError del API para mantener el paquete aislado.
 */
export class SharedBadRequestError extends Error {
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    statusCode = 400,
    options: { retryable?: boolean } = {}
  ) {
    super(message);
    this.name = 'SharedBadRequestError';
    this.statusCode = statusCode;
    this.retryable = options.retryable ?? false;
  }
}

const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.aws.internal',
  'instance-data',
]);

const DNS_LOOKUP_RETRIES = 2;
const DNS_RETRY_DELAY_MS = 100;
const TRANSIENT_DNS_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ESERVFAIL',
  'ETIMEOUT',
]);
const RETRYABLE_DNS_ERROR_CODES = new Set([
  ...TRANSIENT_DNS_ERROR_CODES,
  'ENODATA',
  'ENOTFOUND',
]);

function getDnsErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

async function lookupHostname(hostname: string): Promise<string[]> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const records = await dns.lookup(hostname, { all: true });
      return records.map((record) => record.address);
    } catch (error) {
      const code = getDnsErrorCode(error);
      const canRetry =
        code !== undefined &&
        RETRYABLE_DNS_ERROR_CODES.has(code) &&
        attempt < DNS_LOOKUP_RETRIES;

      if (canRetry) {
        await new Promise((resolve) =>
          setTimeout(resolve, DNS_RETRY_DELAY_MS * (attempt + 1))
        );
        continue;
      }

      const isTransient =
        code !== undefined && TRANSIENT_DNS_ERROR_CODES.has(code);
      const codeDetail = code ? ` (${code})` : '';
      throw new SharedBadRequestError(
        `No se pudo resolver el dominio "${hostname}"${codeDetail}`,
        isTransient || !code ? 502 : 400,
        { retryable: isTransient }
      );
    }
  }
}

export function isForbiddenIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();

    if (range !== 'unicast') {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SharedBadRequestError('URL invalida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SharedBadRequestError(
      'Solo se permiten URLs con protocolo http o https'
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    throw new SharedBadRequestError('Hostname no permitido');
  }

  if (ipaddr.isValid(hostname)) {
    if (isForbiddenIp(hostname)) {
      throw new SharedBadRequestError('IP no permitida');
    }
    return url;
  }

  const addresses = await lookupHostname(hostname);

  if (addresses.length === 0) {
    throw new SharedBadRequestError('El dominio no resuelve a ninguna IP');
  }

  for (const address of addresses) {
    if (isForbiddenIp(address)) {
      throw new SharedBadRequestError(
        `El dominio resuelve a una IP no permitida (${address})`
      );
    }
  }

  return url;
}

export const FETCH_LIMITS = {
  timeoutMs: 30_000,
  maxResponseBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 PriceTracker/0.1',
};