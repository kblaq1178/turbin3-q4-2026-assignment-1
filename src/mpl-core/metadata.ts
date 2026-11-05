import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { ROOT } from '../lib/config.js';

export interface Metadata {
  name: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string | number }[];
}
export interface Target { name: string; uri: string; image: string; metadataSha256: string; imageSha256: string }
export interface Plan { original: Target; updated: Target }

export function httpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.port || !url.hostname.includes('.') ||
      /(^|\.)(example\.(com|org|net)|localhost|local|invalid|test)$/.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith('[')) {
    throw new Error('Use a public stable HTTPS URL without credentials, fragment, or custom port.');
  }
  return url.href;
}

export function metadata(value: unknown): Metadata {
  if (!value || typeof value !== 'object') throw new Error('Metadata must be an object.');
  const m = value as Metadata;
  if (typeof m.name !== 'string' || !m.name.trim() || Buffer.byteLength(m.name) > 32 ||
      typeof m.description !== 'string' || !m.description.trim() || typeof m.image !== 'string' ||
      !Array.isArray(m.attributes) || !m.attributes.every(a => a && typeof a.trait_type === 'string' &&
        a.trait_type.trim() && (typeof a.value === 'string' || (typeof a.value === 'number' && Number.isFinite(a.value))))) {
    throw new Error('Invalid name (maximum 32 UTF-8 bytes), description, image, or attributes.');
  }
  httpsUrl(m.image);
  return m;
}
export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

// GET rather than HEAD: reject HTML/login pages, redirects, errors, empty or oversized bodies.
export async function download(url: string, kind: 'json' | 'image', fetcher = fetch): Promise<Uint8Array> {
  httpsUrl(url);
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!response.ok || !(kind === 'json' ? mime === 'application/json' || mime.endsWith('+json') :
    /^image\/(png|jpeg|gif|webp|svg\+xml|avif)$/.test(mime))) {
    throw new Error(`Public ${kind} GET failed or returned an unexpected Content-Type (HTTP ${response.status}).`);
  }
  const limit = kind === 'json' ? 100_000 : 10_000_000;
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty HTTP response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > limit) throw new Error('HTTP response exceeds size limit.');
      chunks.push(next.value);
    }
  } finally { await reader.cancel(); }
  if (!size) throw new Error('Empty HTTP response.');
  const bytes = Buffer.concat(chunks);
  if (kind === 'image') {
    const valid = mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
      mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
      mime === 'image/gif' ? /^GIF8[79]a/.test(bytes.toString('ascii', 0, 6)) :
      mime === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' :
      mime === 'image/avif' ? bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32)) :
      /<svg[\s>]/i.test(bytes.toString('utf8')) && !/<html[\s>]/i.test(bytes.toString('utf8'));
    if (!valid) throw new Error('Image bytes do not match the image Content-Type.');
  }
  return bytes;
}

export async function validatePlan(fetcher = fetch): Promise<Plan> {
  const uris = [process.env.NFT_ORIGINAL_URI, process.env.NFT_UPDATED_URI];
  if (!uris[0] || !uris[1]) throw new Error('Set NFT_ORIGINAL_URI and NFT_UPDATED_URI to hosted JSON URLs.');
  if (httpsUrl(uris[0]) === httpsUrl(uris[1])) throw new Error('Original and updated metadata need distinct URLs.');
  const targets: Target[] = [];
  for (const [index, file] of ['original.json', 'updated.json'].entries()) {
    const local: unknown = JSON.parse(await readFile(resolve(ROOT, 'metadata', file), 'utf8'));
    const expected = metadata(local);
    const uri = uris[index]!;
    if (Buffer.byteLength(uri) > 200) throw new Error('Metadata URI exceeds the project limit of 200 UTF-8 bytes.');
    const raw = await download(uri, 'json', fetcher);
    const hosted: unknown = JSON.parse(Buffer.from(raw).toString('utf8'));
    metadata(hosted);
    if (!isDeepStrictEqual(local, hosted)) throw new Error(`Hosted metadata differs from metadata/${file}.`);
    const image = await download(expected.image, 'image', fetcher);
    targets.push({ name: expected.name, uri, image: expected.image, metadataSha256: sha256(raw), imageSha256: sha256(image) });
  }
  if (targets[0]!.name === targets[1]!.name) throw new Error('Updated name must differ from original.');
  return { original: targets[0]!, updated: targets[1]! };
}
