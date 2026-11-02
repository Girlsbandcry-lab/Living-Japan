const encoder = new TextEncoder();
export const packJsonBytes = value => encoder.encode(JSON.stringify(value));
const shaConstants = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
async function sha256Fallback(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input.buffer || input, input.byteOffset || 0, input.byteLength);
  const padded = new Uint8Array(Math.ceil((bytes.byteLength + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.byteLength] = 0x80;
  const view = new DataView(padded.buffer), words = new Uint32Array(64);
  view.setUint32(padded.length - 8, Math.floor(bytes.byteLength / 0x20000000));
  view.setUint32(padded.length - 4, bytes.byteLength * 8);
  const state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    if (offset && offset % 1048576 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a,b,c,d,e,f,g,h] = state;
    for (let i = 0; i < 64; i++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + shaConstants[i] + words[i]) >>> 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    const result = [a,b,c,d,e,f,g,h]; for (let i = 0; i < 8; i++) state[i] += result[i];
  }
  return [...state].map(x => x.toString(16).padStart(8, '0')).join('');
}
export async function packSha256(bytes) {
  if (!globalThis.crypto?.subtle) return sha256Fallback(bytes);
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function packBase64(bytes) {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 32768) binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
  return btoa(binary);
}
export const unpackBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));
export async function checkPackBytes(bytes, expected) {
  if (bytes.byteLength !== expected.bytes || await packSha256(bytes) !== expected.sha256) throw new Error('地区资源字节或摘要校验失败');
}
export async function decodePackBundle(bytes) {
  const raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const bundle = JSON.parse(new TextDecoder().decode(raw));
  if (bundle.schemaVersion !== 1 || !bundle.files || typeof bundle.files !== 'object') throw new Error('地区内容块格式无效');
  return { bundle, bytes: raw.byteLength };
}

export function createPackResourceFetcher({ snapshot, baseUrl, fetcher = globalThis.fetch } = {}) {
  const base = new URL('./', baseUrl), cache = new Map(), pending = new Map();
  async function bundleAt(url, chunkId) {
    if (cache.has(url)) { const value = cache.get(url); cache.delete(url); cache.set(url, value); return value.bundle; }
    if (!pending.has(url)) pending.set(url, (async () => {
      const response = await fetcher(url, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`地区内容块读取失败（${response.status}）`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const chunk = snapshot.chunks?.[chunkId];
      if (chunk) await checkPackBytes(bytes, chunk);
      const decoded = await decodePackBundle(bytes);
      if (decoded.bytes <= 16 * 1024 * 1024) {
        cache.set(url, decoded);
        while (cache.size > 3 || [...cache.values()].reduce((sum, value) => sum + value.bytes, 0) > 16 * 1024 * 1024) cache.delete(cache.keys().next().value);
      }
      return decoded.bundle;
    })().finally(() => pending.delete(url)));
    return pending.get(url);
  }
  const resourceFetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'object' && 'url' in input ? input.url : String(input), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return fetcher(input, options);
    const path = decodeURIComponent(url.pathname.slice(base.pathname.length));
    const owned = path.startsWith('data/') || path === 'src/legacy/transit-data.json' || path === 'src/metro-name-catalog.js';
    if (!owned) return fetcher(input, options);
    const file = snapshot.files?.[path];
    if (!file) return new Response('此地区资源尚未安装或未启用', { status: 404 });
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const bundle = await bundleAt(file.url, file.chunkId);
    if (!Object.hasOwn(bundle.files, path)) throw new Error('地区内容块缺少清单资源：' + path);
    const bytes = unpackBase64(bundle.files[path]);
    await checkPackBytes(bytes, file);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(bytes, { headers: { 'Content-Type': path.endsWith('.gz') ? 'application/gzip' : path.endsWith('.js') ? 'text/javascript' : 'application/json', 'Content-Length': String(bytes.byteLength) } });
  };
  resourceFetch.clear = () => cache.clear();
  resourceFetch.stats = () => ({ blocks: cache.size, decodedBytes: [...cache.values()].reduce((sum, value) => sum + value.bytes, 0) });
  return resourceFetch;
}
