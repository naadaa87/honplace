/* 방문 통계 수집 — 혼플 페이지가 보내는 아주 작은 기록
   POST /api/t
     { t:'pv', id, vid, sid, path, kind, sp, rt, rh, kw, dv, nw, en }   페이지 조회
     { t:'dw', id, vid, ms }                                           체류시간 (화면을 보고 있던 시간)
     { t:'ev', vid, sid, path, sp, type, label }                       클릭·행동

   이름·연락처·IP 원문은 받지도 저장하지도 않습니다. 방문자는 브라우저가 만든 무작위 id 로만 구분합니다.
   데이터베이스가 없으면 503 을 돌려주고, 페이지는 그 방문 동안 더 보내지 않습니다. */
import { now, kst, isBot } from './_util.js';

const ok = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const ID = /^[a-z0-9]{6,24}$/;
const KINDS = new Set(['home', 'place', 'cat', 'area', 'guide', 'magazine', 'test', 'board', 'spaces', 'host', 'hostcenter', 'submit', 'etc']);
const REFS = new Set(['direct', 'search', 'social', 'ref', 'campaign', 'internal']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const TYPES = new Set(['map', 'out', 'mail', 'like', 'unlike', 'share', 'search', 'filter', 'test_start', 'test_result', 'post', 'host_apply', 'submit', 'cta']);

const s = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '') || null;
const pathOf = (v) => {
  const p = s(v, 200);
  if (!p || p[0] !== '/') return null;
  return p.split('?')[0].split('#')[0].replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
};
const spaceOf = (v) => { const x = s(v, 60); return x && /^[a-z0-9-]+$/.test(x) ? x : null; };

export async function onRequestPost({ request, env }) {
  if (!env.DB) return new Response(null, { status: 503 });
  if (isBot(request)) return ok();

  let b;
  try { b = JSON.parse(await request.text()); } catch { return ok(); }
  if (!b || typeof b !== 'object' || !ID.test(b.vid || '')) return ok();

  const { day, hour } = kst();
  try {
    if (b.t === 'pv') {
      const path = pathOf(b.path);
      if (!ID.test(b.id || '') || !ID.test(b.sid || '') || !path) return ok();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO pv (id, day, hour, vid, sid, path, kind, space_id, ref_type, ref_host, kw, device, is_new, entry, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        b.id, day, hour, b.vid, b.sid, path,
        KINDS.has(b.kind) ? b.kind : 'etc',
        spaceOf(b.sp),
        REFS.has(b.rt) ? b.rt : 'direct',
        s(b.rh, 60), s(b.kw, 80),
        DEVICES.has(b.dv) ? b.dv : 'desktop',
        b.nw ? 1 : 0, b.en ? 1 : 0, now()
      ).run();

      /* 가끔 오래된 기록 정리 (400일 넘은 것) */
      if (Math.random() < 0.002) {
        const old = kst(new Date(Date.now() - 400 * 86400000)).day;
        await env.DB.batch([
          env.DB.prepare('DELETE FROM pv WHERE day < ?').bind(old),
          env.DB.prepare('DELETE FROM ev WHERE day < ?').bind(old)
        ]);
      }
    } else if (b.t === 'dw') {
      const ms = Math.round(Number(b.ms));
      if (!ID.test(b.id || '') || !Number.isFinite(ms) || ms < 0) return ok();
      /* 30분이 넘는 값은 자리를 비운 것으로 보고 30분으로 자릅니다 */
      await env.DB.prepare('UPDATE pv SET dwell_ms = MAX(dwell_ms, ?) WHERE id = ? AND vid = ?')
        .bind(Math.min(ms, 1800000), b.id, b.vid).run();
    } else if (b.t === 'ev') {
      if (!TYPES.has(b.type)) return ok();
      await env.DB.prepare(
        `INSERT INTO ev (day, hour, vid, sid, path, space_id, type, label, created_at) VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(day, hour, b.vid, ID.test(b.sid || '') ? b.sid : null, pathOf(b.path), spaceOf(b.sp), b.type, s(b.label, 80), now()).run();
    }
  } catch {
    /* 테이블이 아직 없으면(마이그레이션 전) 조용히 넘어갑니다 */
    return new Response(null, { status: 503 });
  }
  return ok();
}
