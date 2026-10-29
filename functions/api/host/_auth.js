/* 호스트센터 인증 공통
   요청 헤더 Authorization: Bearer <host_key> 로 인증합니다.
   키는 운영자가 승인할 때 발급해 호스트에게 메일로 전달합니다. */

export function readKey(request) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : '';
}

/* 인증 성공 시 host 행을, 실패 시 null 을 돌려줍니다. */
export async function hostFromRequest(request, env) {
  const key = readKey(request);
  if (!key || key.length < 8) return null;
  try {
    return await env.DB.prepare(
      `SELECT id, space_id, space_name, cat, area, addr, owner_name, email, link,
              solo_seats, solo_note, status, verified_at,
              pub_title, pub_note, pub_seats, pub_hours, pub_link, pub_updated_at
         FROM hosts WHERE host_key = ? AND status = 'verified' LIMIT 1`
    ).bind(key).first();
  } catch {
    /* host_key 열이 아직 없는 DB — 마이그레이션 전 */
    return null;
  }
}

/* 호스트 키 생성: hk- 뒤에 영숫자 14자. 헷갈리는 글자(0/O, 1/l/I)는 뺍니다. */
export function newHostKey() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint8Array(14);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += chars[b % chars.length];
  return 'hk-' + s;
}
