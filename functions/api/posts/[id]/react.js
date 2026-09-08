import { json, bad } from '../../_util.js';
const TYPES = new Set(['metoo', 'thanks', 'going']);
export async function onRequestPost({ params, request, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  if (!TYPES.has(b.type)) return bad('반응 종류가 올바르지 않습니다');
  const r = await env.DB.prepare(`UPDATE posts SET ${b.type} = ${b.type} + 1 WHERE id = ? AND hidden = 0`).bind(params.id).run();
  if (!r.meta.changes) return bad('글을 찾을 수 없습니다', 404);
  return json({ ok: true });
}
