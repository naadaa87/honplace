/* 운영자용. Pages 설정에서 환경변수 ADMIN_KEY 를 만들고 ?key=... 로 호출합니다.
   GET  /api/admin?key=KEY                 신고가 쌓였거나 숨겨진 글
   GET  /api/admin?key=KEY&what=submissions  공간 제보·수정 제안 (status=new)
   POST /api/admin?key=KEY  body: {"action":"hide"|"unhide"|"delete","id":"p-..."}
   POST /api/admin?key=KEY  body: {"action":"submission","id":"s-...","status":"done"|"skip"} */
import { json, bad } from '../_util.js';
const auth = (request, env) => env.ADMIN_KEY && new URL(request.url).searchParams.get('key') === env.ADMIN_KEY;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad('DB 없음', 503);
  if (!auth(request, env)) return bad('권한이 없습니다', 401);
  const what = new URL(request.url).searchParams.get('what') || 'reported';
  if (what === 'submissions') {
    const { results } = await env.DB.prepare(`SELECT * FROM submissions WHERE status = 'new' ORDER BY created_at DESC LIMIT 200`).all();
    return json({ submissions: results });
  }
  const { results } = await env.DB.prepare(`SELECT id, category, nickname, body, reports, hidden, created_at FROM posts WHERE reports > 0 OR hidden = 1 ORDER BY reports DESC, created_at DESC LIMIT 200`).all();
  return json({ posts: results });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('DB 없음', 503);
  if (!auth(request, env)) return bad('권한이 없습니다', 401);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  if (b.action === 'hide') await env.DB.prepare(`UPDATE posts SET hidden = 1 WHERE id = ?`).bind(b.id).run();
  else if (b.action === 'unhide') await env.DB.prepare(`UPDATE posts SET hidden = 0, reports = 0 WHERE id = ?`).bind(b.id).run();
  else if (b.action === 'delete') await env.DB.batch([env.DB.prepare(`DELETE FROM comments WHERE post_id = ?`).bind(b.id), env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(b.id)]);
  else if (b.action === 'submission') await env.DB.prepare(`UPDATE submissions SET status = ? WHERE id = ?`).bind(b.status === 'skip' ? 'skip' : 'done', b.id).run();
  else return bad('알 수 없는 작업입니다');
  return json({ ok: true });
}
