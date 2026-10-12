import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * Errores propios del paquete shared.
 * No dependemos del AppError del API para mantener el paquete aislado.
 */
export class SharedBadRequestError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'SharedBadRequestError';
    this.statusCode = statusCode;
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

  const hostname = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    throw new SharedBadRequestError('Hostname no permitido');
  }

  if (ipaddr.isValid(hostname)) {
    if (isForbiddenIp(hostname)) {
      throw new SharedBadRequestError('IP no permitida');
    }
    return url;
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new SharedBadRequestError('No se pudo resolver el dominio');
  }

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