/* 플레이스 '가고 싶어요'
   GET  /api/like?space=ID&vid=VID       → { n, liked }
   POST /api/like  { space_id, vid, on }  → { n, liked }
   한 브라우저(vid)당 한 번. 같은 IP 해시에서 한 시간에 60번 넘게 누르면 막습니다. */
import { json, bad, now, ipHash } from './_util.js';

const ID = /^[a-z0-9]{6,24}$/;
const SPACE = /^[a-z0-9-]{2,60}$/;

async function state(env, space, vid) {
  const [n, me] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM likes WHERE space_id = ?').bind(space),
    env.DB.prepare('SELECT 1 AS y FROM likes WHERE space_id = ? AND vid = ?').bind(space, vid || '')
  ]);
  return { n: n.results[0]?.n || 0, liked: !!me.results.length };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ready: false }, 503);
  const u = new URL(request.url);
  const space = u.searchParams.get('space') || '';
  const vid = u.searchParams.get('vid') || '';
  if (!SPACE.test(space)) return bad('잘못된 요청입니다');
  try { return json(await state(env, space, ID.test(vid) ? vid : '')); }
  catch { return json({ ready: false }, 503); }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ready: false }, 503);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  const space = String(b.space_id || ''), vid = String(b.vid || '');
  if (!SPACE.test(space) || !ID.test(vid)) return bad('잘못된 요청입니다');
  try {
    if (b.on) {
      const hash = await ipHash(request, env);
      const since = new Date(Date.now() - 3600 * 1000).toISOString();
      const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM likes WHERE ip_hash = ? AND created_at > ?').bind(hash, since).first();
      if ((r?.n || 0) >= 60) return bad('잠시 후 다시 눌러 주세요', 429);
      await env.DB.prepare('INSERT OR IGNORE INTO likes (space_id, vid, ip_hash, created_at) VALUES (?,?,?,?)').bind(space, vid, hash, now()).run();
    } else {
      await env.DB.prepare('DELETE FROM likes WHERE space_id = ? AND vid = ?').bind(space, vid).run();
    }
    return json(await state(env, space, vid));
  } catch {
    return json({ ready: false }, 503);
  }
}
