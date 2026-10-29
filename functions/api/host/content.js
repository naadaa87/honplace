/* 호스트센터 — 공개 안내 수정
   POST /api/host/content   (Authorization: Bearer <host_key>)
   body: { title, note, seats, hours, link }
   저장하면 공간 페이지에 바로 반영됩니다. */
import { json, bad, clean, now } from '../_util.js';
import { hostFromRequest } from './_auth.js';

/* 홍보 문구가 아니라 안내여야 한다는 원칙 — 과한 표현 몇 가지는 막습니다 */
const HYPE = [/최고/, /1등|일등/, /무조건/, /강추/, /대박/, /맛집\s*인정/, /믿고\s*(가|오)/];
const looksHype = (s) => HYPE.filter((r) => r.test(s)).length >= 2;

const validLink = (s) => !s || /^https?:\/\/[^\s]+$/i.test(s);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  const h = await hostFromRequest(request, env);
  if (!h) return bad('호스트 키가 맞지 않거나 아직 인증되지 않았습니다', 401);

  let b;
  try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }

  const title = clean(b.title, 40) || '운영자가 직접 쓴 안내';
  const note = clean(b.note, 1200);
  const seats = clean(b.seats, 80);
  const hours = clean(b.hours, 120);
  const link = clean(b.link, 300);

  if (!note || note.length < 20) return bad('안내 본문을 20자 이상 적어 주세요');
  if (looksHype(note)) return bad('홍보 문구보다는 혼자 오는 손님이 알아야 할 사실을 적어 주세요. 예: 1인 좌석 수, 혼자 와도 편한 시간대, 주문 방법');
  if (!validLink(link)) return bad('링크는 http:// 또는 https:// 로 시작해야 합니다');

  await env.DB.prepare(
    `UPDATE hosts SET pub_title = ?, pub_note = ?, pub_seats = ?, pub_hours = ?, pub_link = ?, pub_updated_at = ? WHERE id = ?`
  ).bind(title, note, seats || null, hours || null, link || null, now(), h.id).run();

  return json({ ok: true, pub: { title, note, seats, hours, link, updated_at: now() } });
}
