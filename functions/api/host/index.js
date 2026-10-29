/* 호스트 등록 신청 접수
   POST /api/host
   공간을 운영하는 사람이 신청하면 hosts 테이블에 쌓이고, 운영자가 /admin 에서 확인합니다. */
import { json, bad, uid, now, clean, ipHash, tooMany } from '../_util.js';

const CATS = new Set(['honsul', 'honbap', 'cafe', 'culture', 'play', 'move', 'rest', 'learn', 'social']);

/* 사업자등록번호 10자리 검증식 (국세청 체크섬) */
function validBizNo(raw) {
  const n = String(raw || '').replace(/\D/g, '');
  if (n.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[i]) * w[i];
  sum += Math.floor((Number(n[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(n[9]);
}

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 아직 연결되지 않았습니다', 503);

  let b;
  try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }

  const spaceName = clean(b.space_name, 80);
  const ownerName = clean(b.owner_name, 40);
  const email = clean(b.email, 120);
  const bizNo = clean(b.biz_no, 20);
  const soloNote = clean(b.solo_note, 1000);

  if (!spaceName) return bad('공간 이름을 적어 주세요');
  if (!ownerName) return bad('담당자 이름을 적어 주세요');
  if (!validEmail(email)) return bad('회신받을 이메일 주소를 정확히 적어 주세요');
  if (!validBizNo(bizNo)) return bad('사업자등록번호를 다시 확인해 주세요');
  if (!soloNote) return bad('혼자 오는 손님을 위한 안내를 적어 주세요');

  const cat = clean(b.cat, 20);
  if (cat && !CATS.has(cat)) return bad('알 수 없는 분류입니다');

  const hash = await ipHash(request, env);
  if (await tooMany(env, 'hosts', hash, 3)) {
    return bad('잠시 후 다시 시도해 주세요', 429);
  }

  /* 같은 사업자번호로 이미 처리 중인 신청이 있으면 중복 접수를 막습니다 */
  const dup = await env.DB
    .prepare(`SELECT id, status FROM hosts WHERE biz_no = ? AND status IN ('new','reviewing','verified') LIMIT 1`)
    .bind(bizNo.replace(/\D/g, ''))
    .first();
  if (dup) {
    return bad(
      dup.status === 'verified'
        ? '이미 인증된 공간입니다. 정보를 고치시려면 문의 메일로 연락해 주세요.'
        : '이미 접수된 신청이 있습니다. 확인 후 메일로 연락드리겠습니다.',
      409
    );
  }

  await env.DB.prepare(
    `INSERT INTO hosts
     (id, space_id, space_name, cat, area, addr, biz_no, owner_name, phone, email, link,
      solo_seats, solo_note, message, status, ip_hash, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?)`
  ).bind(
    uid('h'),
    clean(b.space_id, 60) || null,
    spaceName,
    cat || null,
    clean(b.area, 80) || null,
    clean(b.addr, 200) || null,
    bizNo.replace(/\D/g, ''),
    ownerName,
    clean(b.phone, 30) || null,
    email,
    clean(b.link, 300) || null,
    clean(b.solo_seats, 120) || null,
    soloNote,
    clean(b.message, 1000) || null,
    hash,
    now()
  ).run();

  return json({ ok: true }, 201);
}
