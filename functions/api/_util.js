/* 혼곳 API 공통 */
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export const bad = (msg, status = 400) => json({ error: msg }, status);

export const uid = (p = 'p') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const now = () => new Date().toISOString();

export async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const salt = env.IP_SALT || 'hongot';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + ip));
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const clean = (s, max) => String(s ?? '').replace(/\r/g, '').trim().slice(0, max);

const CATS = new Set(['today', 'story', 'review', 'ask']);
export const validCat = (c) => CATS.has(c);

/* 연락처·링크 패턴 차단 (필요 시 확장) */
const BLOCK = [/01[016789]-?\d{3,4}-?\d{4}/, /카톡\s*아이디|카카오톡\s*아이디|오픈채팅|인스타\s*아이디|@[a-z0-9_.]{4,}/i, /https?:\/\//i];
export const looksBlocked = (s) => BLOCK.some((r) => r.test(s));

/* 도배 제한: 같은 ip_hash 로 10분 내 n 건 이상 */
export async function tooMany(env, table, hash, limit = 5) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ip_hash = ? AND created_at > ?`).bind(hash, since).first();
  return (r?.n || 0) >= limit;
}
