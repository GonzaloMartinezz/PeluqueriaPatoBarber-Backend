// Portadas de los reels de Instagram: se piden UNA vez al servidor (oEmbed público) y se guardan en memoria,
// así el visitante no contacta a Instagram hasta que toca un reel, y la portada llega rápida y desde el propio sitio.
const TTL = 12 * 60 * 60 * 1000; // las portadas cambian poco
const FAIL_TTL = 10 * 60 * 1000; // si falla, se reintenta más tarde
const MAX_BYTES = 3 * 1024 * 1024;
const HOST_OK = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

const cache = new Map(); // url -> { at, ok, title, type, buf }

async function load(url) {
  const meta = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 PatoBarberBot' },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`oembed ${r.status}`))));

  const thumb = new URL(meta.thumbnail_url);
  if (thumb.protocol !== 'https:' || !HOST_OK.test(thumb.hostname)) throw new Error('host de imagen no permitido');

  const img = await fetch(thumb, { signal: AbortSignal.timeout(10000) });
  if (!img.ok) throw new Error(`imagen ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('imagen demasiado grande');
  return { ok: true, at: Date.now(), title: String(meta.title || '').slice(0, 140), type: img.headers.get('content-type') || 'image/jpeg', buf };
}

async function getReel(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (hit.ok ? TTL : FAIL_TTL)) return hit;
  try {
    const fresh = await load(url);
    cache.set(url, fresh);
    return fresh;
  } catch {
    const failed = hit?.ok ? { ...hit, at: Date.now() - TTL + FAIL_TTL } : { ok: false, at: Date.now() };
    cache.set(url, failed);
    return failed;
  }
}

module.exports = { getReel };
