/* 지점 사진 — 관리자·호스트 API 가 함께 쓰는 조각 */
import { uid, now, clean } from './_util.js';

export const SPACE_ID = /^[a-z0-9-]{2,60}$/;
/* 목록을 읽을 때 쓰는 열 (base64 본문은 뺍니다) */
export const COLS = 'id, space_id, kind, url, thumb_url, mime, w, h, alt, credit, license, source, by, host_id, sort, hidden, created_at';

const MAX_DATA = 1_250_000;   // base64 글자 수 ≈ 원본 약 930KB
const MAX_THUMB = 220_000;    // ≈ 160KB

/* base64 앞머리로 형식을 판별합니다. 그 밖의 형식은 받지 않습니다 */
const sniff = (b64) => (b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('iVBORw0KGgo') ? 'image/png' : b64.startsWith('UklGR') ? 'image/webp' : '');
const b64ok = (s) => typeof s === 'string' && s.length > 100 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
const httpsUrl = (s, max = 600) => {
  const v = clean(s, max);
  if (!v) return '';
  try { const u = new URL(v); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
};

/* 화면에 내보낼 모양 */
export const toPublic = (r) => ({
  id: r.id,
  src: r.kind === 'url' ? r.url : `/api/photo/${r.id}`,
  thumb: r.kind === 'url' ? (r.thumb_url || r.url) : `/api/photo/${r.id}?s=t`,
  w: r.w || null, h: r.h || null,
  alt: r.alt || '', credit: r.credit || '', license: r.license || '', source: r.source || '',
  by: r.by
});

/* 입력 검사 → 저장할 값. 문제가 있으면 { error } */
export function parsePhoto(b) {
  const out = {
    alt: clean(b.alt, 80), credit: clean(b.credit, 60), license: clean(b.license, 40),
    source: httpsUrl(b.source, 400),
    w: Number.isFinite(+b.w) ? Math.min(Math.max(Math.round(+b.w), 0), 20000) : null,
    h: Number.isFinite(+b.h) ? Math.min(Math.max(Math.round(+b.h), 0), 20000) : null
  };
  if (b.kind === 'url') {
    const url = httpsUrl(b.url);
    if (!url) return { error: '사진 주소는 https:// 로 시작해야 합니다' };
    return { ...out, kind: 'url', url, thumb_url: httpsUrl(b.thumb_url) || null, data: null, thumb: null, mime: null };
  }
  if (!b64ok(b.data)) return { error: '사진 파일을 읽지 못했습니다' };
  if (b.data.length > MAX_DATA) return { error: '사진이 너무 큽니다. 다시 골라 주세요' };
  const mime = sniff(b.data);
  if (!mime) return { error: 'JPG, PNG, WebP 사진만 올릴 수 있습니다' };
  let thumb = null;
  if (b.thumb) {
    if (!b64ok(b.thumb) || b.thumb.length > MAX_THUMB || !sniff(b.thumb)) return { error: '작은 그림을 만들지 못했습니다. 다시 올려 주세요' };
    thumb = b.thumb;
  }
  return { ...out, kind: 'upload', url: null, thumb_url: null, data: b.data, thumb: thumb || b.data, mime };
}

export async function insertPhoto(env, spaceId, p, { by, hostId = null }) {
  const id = uid('ph');
  /* 새 사진은 맨 뒤에 */
  const last = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM photos WHERE space_id = ?').bind(spaceId).first();
  const sort = (last?.m || 0) + 10;
  const created = now();
  await env.DB.prepare(
    `INSERT INTO photos (id, space_id, kind, url, thumb_url, data, thumb, mime, w, h, alt, credit, license, source, by, host_id, sort, hidden, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`
  ).bind(id, spaceId, p.kind, p.url, p.thumb_url, p.data, p.thumb, p.mime, p.w, p.h, p.alt || null, p.credit || null, p.license || null, p.source || null, by, hostId, sort, created).run();
  return { id, space_id: spaceId, kind: p.kind, url: p.url, thumb_url: p.thumb_url, mime: p.mime, w: p.w, h: p.h, alt: p.alt, credit: p.credit, license: p.license, source: p.source, by, host_id: hostId, sort, hidden: 0, created_at: created };
}

/* 이 사진을 맨 앞(대표)으로 */
export async function makeCover(env, id, spaceId) {
  const first = await env.DB.prepare('SELECT COALESCE(MIN(sort), 10) AS m FROM photos WHERE space_id = ?').bind(spaceId).first();
  await env.DB.prepare('UPDATE photos SET sort = ? WHERE id = ? AND space_id = ?').bind((first?.m ?? 10) - 10, id, spaceId).run();
}
