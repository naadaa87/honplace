/* 호스트센터 — 내 공간의 사진
   GET    /api/host/photos                 내가 올린 사진 목록
   POST   /api/host/photos { data, thumb, w, h, alt, rights:true }   올리기 (브라우저에서 줄인 사진)
   POST   /api/host/photos { action:'cover', id }                     대표 사진으로
   DELETE /api/host/photos?id=ID           내가 올린 사진 지우기
   (Authorization: Bearer <host_key>) */
import { json, bad } from '../_util.js';
import { hostFromRequest } from './_auth.js';
import { COLS, toPublic, parsePhoto, insertPhoto, makeCover } from '../_photos.js';

const LIMIT = 8;
const auth = async (request, env) => {
  if (!env.DB) return [null, bad('데이터베이스가 연결되지 않았습니다', 503)];
  const h = await hostFromRequest(request, env);
  if (!h) return [null, bad('호스트 키가 맞지 않거나 아직 인증되지 않았습니다', 401)];
  return [h, null];
};
const mine = (env, h) => env.DB.prepare(`SELECT ${COLS} FROM photos WHERE space_id = ? AND host_id = ? ORDER BY sort ASC, created_at ASC`).bind(h.space_id, h.id).all();

export async function onRequestGet({ request, env }) {
  const [h, err] = await auth(request, env); if (err) return err;
  if (!h.space_id) return json({ photos: [], limit: LIMIT, ready: false });
  try {
    const { results } = await mine(env, h);
    return json({ photos: results.map((r) => ({ ...toPublic(r), hidden: !!r.hidden })), limit: LIMIT, ready: true });
  } catch { return bad('사진 기능이 아직 준비되지 않았습니다. 운영자에게 알려 주세요', 503); }
}

export async function onRequestPost({ request, env }) {
  const [h, err] = await auth(request, env); if (err) return err;
  if (!h.space_id) return bad('공간 페이지가 만들어진 뒤에 사진을 올릴 수 있습니다. 운영자가 등록을 마치면 알려 드립니다');
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  try {
    if (b.action === 'cover') {
      const row = await env.DB.prepare('SELECT id FROM photos WHERE id = ? AND space_id = ? AND host_id = ?').bind(String(b.id || ''), h.space_id, h.id).first();
      if (!row) return bad('내가 올린 사진이 아닙니다', 403);
      await makeCover(env, row.id, h.space_id);
      return json({ ok: true });
    }
    if (!b.rights) return bad('직접 찍었거나 사용할 권리가 있는 사진인지 확인해 주세요');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE space_id = ? AND host_id = ?').bind(h.space_id, h.id).first();
    if ((n?.n || 0) >= LIMIT) return bad(`사진은 ${LIMIT}장까지 올릴 수 있습니다. 지우고 다시 올려 주세요`);
    const p = parsePhoto({ ...b, kind: 'upload' });
    if (p.error) return bad(p.error);
    p.credit = `${h.space_name} 제공`; p.license = ''; p.source = '';
    const row = await insertPhoto(env, h.space_id, p, { by: 'host', hostId: h.id });
    return json({ photo: { ...toPublic(row), hidden: false } }, 201);
  } catch { return bad('사진 기능이 아직 준비되지 않았습니다. 운영자에게 알려 주세요', 503); }
}

export async function onRequestDelete({ request, env }) {
  const [h, err] = await auth(request, env); if (err) return err;
  const id = new URL(request.url).searchParams.get('id') || '';
  try {
    const r = await env.DB.prepare('DELETE FROM photos WHERE id = ? AND space_id = ? AND host_id = ?').bind(id, h.space_id || '', h.id).run();
    if (!r.meta?.changes) return bad('지울 수 있는 사진이 아닙니다', 403);
    return json({ ok: true });
  } catch { return bad('사진 기능이 아직 준비되지 않았습니다', 503); }
}
