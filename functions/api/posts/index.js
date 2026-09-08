import { json, bad, uid, now, ipHash, clean, validCat, looksBlocked, tooMany } from '../_util.js';

const SEL = `id, category, nickname, body, space_id, space_name, metoo, thanks, going, comments, created_at`;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ready: false, posts: [] }, 503);
  const u = new URL(request.url);
  const category = u.searchParams.get('category') || '';
  const space = u.searchParams.get('space') || '';
  const limit = Math.min(parseInt(u.searchParams.get('limit') || '30', 10) || 30, 100);
  let sql = `SELECT ${SEL} FROM posts WHERE hidden = 0`;
  const args = [];
  if (category && validCat(category)) { sql += ' AND category = ?'; args.push(category); }
  if (space) { sql += ' AND space_id = ?'; args.push(space); }
  sql += ' ORDER BY created_at DESC LIMIT ?'; args.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  const ids = results.map((p) => p.id);
  const replies = {};
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const { results: cs } = await env.DB.prepare(`SELECT id, post_id, nickname, body, created_at FROM comments WHERE hidden = 0 AND post_id IN (${ph}) ORDER BY created_at ASC`).bind(...ids).all();
    for (const c of cs) (replies[c.post_id] = replies[c.post_id] || []).push(c);
  }
  return json({ ready: true, posts: results.map((p) => ({ ...p, replies: replies[p.id] || [] })) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  const category = clean(b.category, 20);
  const nickname = clean(b.nickname, 30) || '이름 없음';
  const body = clean(b.body, 600);
  if (!validCat(category)) return bad('글 종류가 올바르지 않습니다');
  if (body.length < 1) return bad('내용을 적어 주세요');
  if (looksBlocked(body)) return bad('연락처나 링크는 남길 수 없어요');
  const hash = await ipHash(request, env);
  if (await tooMany(env, 'posts', hash, 5)) return bad('잠시 후 다시 써 주세요', 429);
  const post = {
    id: uid('p'), category, nickname, body,
    space_id: clean(b.space_id, 60) || null, space_name: clean(b.space_name, 60) || null,
    metoo: 0, thanks: 0, going: 0, comments: 0, created_at: now()
  };
  await env.DB.prepare(`INSERT INTO posts (id, category, nickname, body, space_id, space_name, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(post.id, post.category, post.nickname, post.body, post.space_id, post.space_name, hash, post.created_at).run();
  return json({ post: { ...post, replies: [] } }, 201);
}
