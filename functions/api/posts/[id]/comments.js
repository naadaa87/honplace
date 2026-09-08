import { json, bad, uid, now, ipHash, clean, looksBlocked, tooMany } from '../../_util.js';
export async function onRequestPost({ params, request, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  const body = clean(b.body, 300); const nickname = clean(b.nickname, 30) || '이름 없음';
  if (!body) return bad('내용을 적어 주세요');
  if (looksBlocked(body)) return bad('연락처나 링크는 남길 수 없어요');
  const exists = await env.DB.prepare(`SELECT id FROM posts WHERE id = ? AND hidden = 0`).bind(params.id).first();
  if (!exists) return bad('글을 찾을 수 없습니다', 404);
  const hash = await ipHash(request, env);
  if (await tooMany(env, 'comments', hash, 10)) return bad('잠시 후 다시 써 주세요', 429);
  const c = { id: uid('c'), post_id: params.id, nickname, body, created_at: now() };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO comments (id, post_id, nickname, body, ip_hash, created_at) VALUES (?,?,?,?,?,?)`).bind(c.id, c.post_id, c.nickname, c.body, hash, c.created_at),
    env.DB.prepare(`UPDATE posts SET comments = comments + 1 WHERE id = ?`).bind(params.id)
  ]);
  return json({ comment: c }, 201);
}
