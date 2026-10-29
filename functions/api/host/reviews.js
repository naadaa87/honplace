/* 호스트센터 — 내 공간의 후기와 답글
   GET  /api/host/reviews                       내 공간에 달린 글 목록 (답글 포함)
   POST /api/host/reviews  { post_id, body }    호스트 답글 달기 (호스트 표시가 붙음)
   (Authorization: Bearer <host_key>) */
import { json, bad, uid, now, clean, looksBlocked } from '../_util.js';
import { hostFromRequest } from './_auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  const h = await hostFromRequest(request, env);
  if (!h) return bad('호스트 키가 맞지 않거나 아직 인증되지 않았습니다', 401);
  if (!h.space_id) return json({ posts: [] });

  const { results: posts } = await env.DB.prepare(
    `SELECT id, category, nickname, body, metoo, thanks, going, comments, created_at
       FROM posts WHERE space_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 100`
  ).bind(h.space_id).all();

  const ids = posts.map((p) => p.id);
  const replies = {};
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const { results: cs } = await env.DB.prepare(
      `SELECT id, post_id, nickname, body, is_host, created_at FROM comments
        WHERE hidden = 0 AND post_id IN (${ph}) ORDER BY created_at ASC`
    ).bind(...ids).all();
    for (const c of cs) (replies[c.post_id] = replies[c.post_id] || []).push(c);
  }
  return json({ posts: posts.map((p) => ({ ...p, replies: replies[p.id] || [] })) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  const h = await hostFromRequest(request, env);
  if (!h) return bad('호스트 키가 맞지 않거나 아직 인증되지 않았습니다', 401);

  let b;
  try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  const postId = clean(b.post_id, 60);
  const body = clean(b.body, 400);
  if (!postId || !body) return bad('내용을 적어 주세요');
  if (looksBlocked(body)) return bad('답글에는 연락처나 링크를 넣을 수 없습니다. 공식 채널은 호스트 안내의 링크 칸을 써 주세요');

  /* 내 공간의 글에만 답할 수 있습니다 */
  const post = await env.DB.prepare(
    `SELECT id FROM posts WHERE id = ? AND space_id = ? AND hidden = 0`
  ).bind(postId, h.space_id).first();
  if (!post) return bad('이 글은 내 공간의 후기가 아닙니다', 403);

  /* 한 글에 호스트 답글은 하나만 (수정은 삭제 후 다시) */
  const dup = await env.DB.prepare(
    `SELECT id FROM comments WHERE post_id = ? AND is_host = 1 AND hidden = 0 LIMIT 1`
  ).bind(postId).first();
  if (dup) return bad('이미 답글을 달았습니다. 하나의 후기에는 호스트 답글을 하나만 달 수 있습니다', 409);

  const nickname = `${h.space_name} 호스트`;
  const c = { id: uid('c'), post_id: postId, nickname, body, is_host: 1, created_at: now() };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO comments (id, post_id, nickname, body, is_host, created_at) VALUES (?,?,?,?,1,?)`
    ).bind(c.id, c.post_id, c.nickname, c.body, c.created_at),
    env.DB.prepare(`UPDATE posts SET comments = comments + 1 WHERE id = ?`).bind(postId)
  ]);
  return json({ comment: c }, 201);
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  const h = await hostFromRequest(request, env);
  if (!h) return bad('권한이 없습니다', 401);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return bad('답글 id가 필요합니다');

  /* 내 공간의 글에 달린 내 답글만 지울 수 있습니다 */
  const c = await env.DB.prepare(
    `SELECT c.id, c.post_id FROM comments c JOIN posts p ON p.id = c.post_id
      WHERE c.id = ? AND c.is_host = 1 AND p.space_id = ?`
  ).bind(id, h.space_id).first();
  if (!c) return bad('지울 수 있는 답글이 아닙니다', 403);

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM comments WHERE id = ?`).bind(id),
    env.DB.prepare(`UPDATE posts SET comments = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND hidden = 0) WHERE id = ?`).bind(c.post_id, c.post_id)
  ]);
  return json({ ok: true });
}
