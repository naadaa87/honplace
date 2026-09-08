import { json, bad, uid, now, clean } from './_util.js';
export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);
  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }
  const name = clean(b.name, 80), note = clean(b.note, 1500);
  if (!name || !note) return bad('이름과 내용은 꼭 적어 주세요');
  const talk = parseInt(b.talk, 10);
  await env.DB.prepare(`INSERT INTO submissions (id, fix_id, name, area, cat, solo, talk, note, time, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('s'), clean(b.fix_id, 60) || null, name, clean(b.area, 80) || null, clean(b.cat, 20) || null,
      parseInt(b.solo, 10) || null, Number.isInteger(talk) ? talk : null, note, clean(b.time, 80) || null, now()).run();
  return json({ ok: true }, 201);
}
