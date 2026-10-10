import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

import { BadRequestError } from '../lib/errors.js';

/**
 * Rangos de IP que NO se pueden visitar (privados, loopback, metadata, etc.).
 */
const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.aws.internal',
  'instance-data',
]);

/**
 * Verifica si una IP (v4 o v6) está en un rango prohibido.
 */
export function isForbiddenIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();

    // ipaddr.js devuelve 'unicast' para IPs públicas normales.
    // Cualquier otro rango lo bloqueamos.
    if (range !== 'unicast') {
      return true;
    }

    return false;
  } catch {
    // Si no se puede parsear, la bloqueamos por seguridad.
    return true;
  }
}

/**
 * Valida una URL y lanza errores si:
 *  - El protocolo no es http/https.
 *  - El hostname está en la lista negra.
 *  - La IP resuelta por DNS está en un rango prohibido.
 *
 * Devuelve la URL normalizada si pasa todas las validaciones.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError('URL inválida');
  }

  // Capa 1 — Protocolo
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestError(
      'Solo se permiten URLs con protocolo http o https'
    );
  }

  // Capa 2 — Hostname prohibido (por string)
  const hostname = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    throw new BadRequestError('Hostname no permitido');
  }

  // Capa 3 — Si el hostname es una IP, validarla directamente
  if (ipaddr.isValid(hostname)) {
    if (isForbiddenIp(hostname)) {
      throw new BadRequestError('IP no permitida');
    }
    return url;
  }

  // Capa 4 — Resolver DNS
  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new BadRequestError('No se pudo resolver el dominio');
  }

  if (addresses.length === 0) {
    throw new BadRequestError('El dominio no resuelve a ninguna IP');
  }

  // Capa 5 — Verificar TODAS las IPs resueltas
  for (const address of addresses) {
    if (isForbiddenIp(address)) {
      throw new BadRequestError(
        `El dominio resuelve a una IP no permitida (${address})`
      );
    }
  }

  return url;
}

/**
 * Configuración de límites para fetch seguros.
 */
export const FETCH_LIMITS = {
  timeoutMs: 30_000,
  maxResponseBytes: 5 * 1024 * 1024, // 5 MB
  maxRedirects: 5,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 PriceTracker/0.1',
};