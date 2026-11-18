/* 관리자 KPI 집계
   GET /api/admin?key=KEY&what=kpi&days=7            최근 7일 (오늘 포함, 한국 시간)
   GET /api/admin?key=KEY&what=kpi&from=2026-11-01&to=2026-11-18

   pv·ev·likes 테이블(migrations/003-analytics.sql)이 없으면 방문 통계는 비우고
   schemaOk:false 를 돌려줍니다. 게시판·호스트 지표는 그대로 나옵니다. */
import { kst } from '../_util.js';

const DAY = 86400000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const isoStart = (d) => new Date(Date.parse(d + 'T00:00:00+09:00')).toISOString();

/* 체류시간: 1초 미만은 '보자마자 닫음'으로 빼고, 30분 넘는 값은 30분으로 자릅니다 */
const DWELL = `AVG(CASE WHEN dwell_ms >= 1000 THEN MIN(dwell_ms, 1800000) END)`;

export async function kpi(env, p) {
  const today = kst().day;
  let to = DATE.test(p.get('to') || '') ? p.get('to') : today;
  let from;
  if (DATE.test(p.get('from') || '')) from = p.get('from');
  else {
    const days = Math.min(Math.max(parseInt(p.get('days') || '7', 10) || 7, 1), 366);
    from = addDays(to, -(days - 1));
  }
  if (from > to) [from, to] = [to, from];
  const days = diffDays(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const range = { from, to, days, isoFrom: isoStart(from), isoTo: isoStart(addDays(to, 1)) };
  const prev = { from: prevFrom, to: prevTo, days, isoFrom: isoStart(prevFrom), isoTo: isoStart(from) };

  const out = { range: { from, to, days }, prev: { from: prevFrom, to: prevTo }, today, schemaOk: true };
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b);

  /* ── 1. 방문 통계 (한 번에 묶어서) ─────────────────── */
  const sumSql = `SELECT COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, COUNT(DISTINCT sid) AS sessions,
      COUNT(DISTINCT CASE WHEN is_new = 1 THEN vid END) AS newv,
      ${DWELL} AS dwell,
      SUM(CASE WHEN kind = 'place' THEN 1 ELSE 0 END) AS placePv,
      COUNT(DISTINCT CASE WHEN kind = 'place' THEN vid END) AS placeUv,
      COUNT(DISTINCT CASE WHEN kind = 'place' THEN sid END) AS placeSessions
    FROM pv WHERE day BETWEEN ? AND ?`;
  const sessSql = `SELECT COUNT(*) AS sessions, SUM(CASE WHEN c = 1 THEN 1 ELSE 0 END) AS bounces, AVG(d) AS sdwell
    FROM (SELECT sid, COUNT(*) AS c, SUM(MIN(dwell_ms, 1800000)) AS d FROM pv WHERE day BETWEEN ? AND ? GROUP BY sid)`;
  const evSumSql = `SELECT SUM(type = 'map') AS map, COUNT(DISTINCT CASE WHEN type = 'map' THEN sid END) AS mapSessions,
      COUNT(DISTINCT CASE WHEN type = 'map' THEN vid END) AS mapUv,
      SUM(type = 'out') AS out, SUM(type = 'share') AS share, SUM(type = 'search') AS search,
      SUM(type = 'test_result') AS testDone, SUM(type = 'test_start') AS testStart
    FROM ev WHERE day BETWEEN ? AND ?`;
  const likeSumSql = `SELECT COUNT(*) AS n FROM likes WHERE created_at >= ? AND created_at < ?`;

  const liveIso = new Date(Date.now() - 5 * 60000).toISOString();
  const liveDay = kst(new Date(Date.now() - 5 * 60000)).day;
  try {
    const r = await env.DB.batch([
      /* 0  */ q(sumSql, from, to),
      /* 1  */ q(sumSql, prevFrom, prevTo),
      /* 2  */ q(sessSql, from, to),
      /* 3  */ q(sessSql, prevFrom, prevTo),
      /* 4  */ q(evSumSql, from, to),
      /* 5  */ q(evSumSql, prevFrom, prevTo),
      /* 6  */ q(likeSumSql, range.isoFrom, range.isoTo),
      /* 7  */ q(likeSumSql, prev.isoFrom, prev.isoTo),
      /* 8  */ q(`SELECT day, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, COUNT(DISTINCT sid) AS sessions,
                   COUNT(DISTINCT CASE WHEN is_new = 1 THEN vid END) AS newv
                 FROM pv WHERE day BETWEEN ? AND ? GROUP BY day`, from, to),
      /* 9  */ q(`SELECT day, SUM(type = 'map') AS map, SUM(type = 'like') AS likes FROM ev WHERE day BETWEEN ? AND ? GROUP BY day`, from, to),
      /* 10 */ q(`SELECT hour, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv FROM pv WHERE day BETWEEN ? AND ? GROUP BY hour`, from, to),
      /* 11 */ q(`SELECT CAST(strftime('%w', day) AS INTEGER) AS wd, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv FROM pv WHERE day BETWEEN ? AND ? GROUP BY wd`, from, to),
      /* 12 */ q(`SELECT kind, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, ${DWELL} AS dwell FROM pv WHERE day BETWEEN ? AND ? GROUP BY kind ORDER BY pv DESC`, from, to),
      /* 13 */ q(`SELECT path, kind, space_id, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, ${DWELL} AS dwell, SUM(entry) AS entries
                 FROM pv WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY pv DESC LIMIT 300`, from, to),
      /* 14 */ q(`SELECT p.path, COUNT(*) AS bounces FROM pv p
                 JOIN (SELECT sid FROM pv WHERE day BETWEEN ? AND ? GROUP BY sid HAVING COUNT(*) = 1) s ON s.sid = p.sid
                 WHERE p.day BETWEEN ? AND ? GROUP BY p.path`, from, to, from, to),
      /* 15 */ q(`SELECT ref_type, ref_host, COUNT(*) AS sessions, COUNT(DISTINCT vid) AS uv FROM pv
                 WHERE entry = 1 AND day BETWEEN ? AND ? GROUP BY ref_type, ref_host ORDER BY sessions DESC LIMIT 60`, from, to),
      /* 16 */ q(`SELECT path, COUNT(*) AS n,
                   SUM(CASE WHEN ref_host = 'naver' THEN 1 ELSE 0 END) AS naver,
                   SUM(CASE WHEN ref_host = 'google' THEN 1 ELSE 0 END) AS google
                 FROM pv WHERE entry = 1 AND ref_type = 'search' AND day BETWEEN ? AND ? GROUP BY path ORDER BY n DESC LIMIT 40`, from, to),
      /* 17 */ q(`SELECT kw, ref_type, ref_host, COUNT(*) AS n FROM pv WHERE entry = 1 AND kw IS NOT NULL AND day BETWEEN ? AND ?
                 GROUP BY kw, ref_type ORDER BY n DESC LIMIT 40`, from, to),
      /* 18 */ q(`SELECT device, COUNT(DISTINCT vid) AS uv, COUNT(*) AS pv FROM pv WHERE day BETWEEN ? AND ? GROUP BY device ORDER BY uv DESC`, from, to),
      /* 19 */ q(`SELECT space_id, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, ${DWELL} AS dwell FROM pv
                 WHERE kind = 'place' AND space_id IS NOT NULL AND day BETWEEN ? AND ? GROUP BY space_id`, from, to),
      /* 20 */ q(`SELECT space_id, SUM(type = 'map') AS map, COUNT(DISTINCT CASE WHEN type = 'map' THEN vid END) AS mapUv,
                   SUM(CASE WHEN type = 'map' AND label = 'naver' THEN 1 ELSE 0 END) AS mapNaver,
                   SUM(CASE WHEN type = 'map' AND label = 'google' THEN 1 ELSE 0 END) AS mapGoogle,
                   SUM(type = 'out') AS out, SUM(type = 'share') AS share
                 FROM ev WHERE space_id IS NOT NULL AND day BETWEEN ? AND ? GROUP BY space_id`, from, to),
      /* 21 */ q(`SELECT space_id, COUNT(*) AS n FROM likes GROUP BY space_id`),
      /* 22 */ q(`SELECT space_id, COUNT(*) AS n FROM likes WHERE created_at >= ? AND created_at < ? GROUP BY space_id`, range.isoFrom, range.isoTo),
      /* 23 */ q(`SELECT type, label, COUNT(*) AS n, COUNT(DISTINCT vid) AS uv FROM ev WHERE day BETWEEN ? AND ?
                 GROUP BY type, label ORDER BY n DESC LIMIT 300`, from, to),
      /* 24 */ q(`SELECT COUNT(DISTINCT vid) AS n FROM pv WHERE day >= ? AND created_at > ?`, liveDay, liveIso),
      /* 25 */ q(`SELECT path, COUNT(DISTINCT vid) AS n FROM pv WHERE day >= ? AND created_at > ? GROUP BY path ORDER BY n DESC LIMIT 6`, liveDay, liveIso),
      /* 26 */ q(`SELECT MIN(day) AS first, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv FROM pv`),
      /* 27 */ q(`SELECT COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv FROM pv WHERE day = ?`, today)
    ]);
    const one = (i) => r[i].results[0] || {};
    const all = (i) => r[i].results || [];

    const sum = (s, ss, e, lk) => ({
      pv: s.pv || 0, uv: s.uv || 0, sessions: s.sessions || 0, newv: s.newv || 0,
      returning: Math.max(0, (s.uv || 0) - (s.newv || 0)),
      dwell: Math.round(s.dwell || 0),
      sessionDwell: Math.round(ss.sdwell || 0),
      bounce: ss.sessions ? (ss.bounces || 0) / ss.sessions : 0,
      pps: s.sessions ? (s.pv || 0) / s.sessions : 0,
      placePv: s.placePv || 0, placeUv: s.placeUv || 0, placeSessions: s.placeSessions || 0,
      map: e.map || 0, mapSessions: e.mapSessions || 0, mapUv: e.mapUv || 0,
      mapRate: s.placeSessions ? (e.mapSessions || 0) / s.placeSessions : 0,
      out: e.out || 0, share: e.share || 0, search: e.search || 0,
      testStart: e.testStart || 0, testDone: e.testDone || 0,
      likes: lk.n || 0
    });
    out.sum = sum(one(0), one(2), one(4), one(6));
    out.prevSum = sum(one(1), one(3), one(5), one(7));

    /* 일별 — 빈 날도 0 으로 채워서 */
    const dm = Object.fromEntries(all(8).map((x) => [x.day, x]));
    const em = Object.fromEntries(all(9).map((x) => [x.day, x]));
    out.daily = Array.from({ length: days }, (_, i) => {
      const d = addDays(from, i), a = dm[d] || {}, e = em[d] || {};
      return { day: d, pv: a.pv || 0, uv: a.uv || 0, sessions: a.sessions || 0, newv: a.newv || 0, map: e.map || 0, likes: e.likes || 0 };
    });
    const hm = Object.fromEntries(all(10).map((x) => [x.hour, x]));
    out.hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, pv: hm[h]?.pv || 0, uv: hm[h]?.uv || 0 }));
    const wm = Object.fromEntries(all(11).map((x) => [x.wd, x]));
    out.weekdays = Array.from({ length: 7 }, (_, w) => ({ wd: w, pv: wm[w]?.pv || 0, uv: wm[w]?.uv || 0 }));

    out.kinds = all(12).map((x) => ({ ...x, dwell: Math.round(x.dwell || 0) }));
    const bm = Object.fromEntries(all(14).map((x) => [x.path, x.bounces]));
    out.pages = all(13).map((x) => ({
      ...x, dwell: Math.round(x.dwell || 0), entries: x.entries || 0,
      bounces: bm[x.path] || 0, bounce: x.entries ? (bm[x.path] || 0) / x.entries : null
    }));
    out.refs = all(15);
    out.landings = all(16).map((x) => ({ ...x, other: x.n - x.naver - x.google }));
    out.keywords = all(17);
    out.devices = all(18);

    /* 플레이스별 — 조회·지도·좋아요·후기를 한 줄로 */
    const P = {};
    const row = (id) => (P[id] = P[id] || { space_id: id, pv: 0, uv: 0, dwell: 0, map: 0, mapUv: 0, mapNaver: 0, mapGoogle: 0, out: 0, share: 0, likesNew: 0, likesAll: 0, posts: 0, postsAll: 0 });
    all(19).forEach((x) => Object.assign(row(x.space_id), { pv: x.pv, uv: x.uv, dwell: Math.round(x.dwell || 0) }));
    all(20).forEach((x) => Object.assign(row(x.space_id), { map: x.map || 0, mapUv: x.mapUv || 0, mapNaver: x.mapNaver || 0, mapGoogle: x.mapGoogle || 0, out: x.out || 0, share: x.share || 0 }));
    all(21).forEach((x) => (row(x.space_id).likesAll = x.n));
    all(22).forEach((x) => (row(x.space_id).likesNew = x.n));
    out._places = P;

    out.events = all(23);
    out.live = { n: one(24).n || 0, pages: all(25) };
    out.total = { first: one(26).first || null, pv: one(26).pv || 0, uv: one(26).uv || 0 };
    out.todayNow = { pv: one(27).pv || 0, uv: one(27).uv || 0 };
  } catch (e) {
    out.schemaOk = false;
    out.schemaError = String(e && e.message || e).slice(0, 200);
  }

  /* ── 2. 커뮤니티 ─────────────────────────────── */
  const commSql = `SELECT COUNT(*) AS posts, COUNT(DISTINCT ip_hash) AS writers,
      COALESCE(SUM(metoo + thanks + going), 0) AS reactions,
      SUM(CASE WHEN reports > 0 THEN 1 ELSE 0 END) AS reported,
      SUM(CASE WHEN space_id IS NOT NULL AND space_id <> '' THEN 1 ELSE 0 END) AS reviews
    FROM posts WHERE created_at >= ? AND created_at < ?`;
  const comm = async (R) => {
    const [a, c, s] = await env.DB.batch([
      q(commSql, R.isoFrom, R.isoTo),
      q(`SELECT COUNT(*) AS n FROM comments WHERE created_at >= ? AND created_at < ?`, R.isoFrom, R.isoTo),
      q(`SELECT COUNT(*) AS n FROM submissions WHERE created_at >= ? AND created_at < ?`, R.isoFrom, R.isoTo)
    ]);
    const x = a.results[0] || {};
    return { posts: x.posts || 0, writers: x.writers || 0, reactions: x.reactions || 0, reported: x.reported || 0, reviews: x.reviews || 0, comments: c.results[0]?.n || 0, subs: s.results[0]?.n || 0 };
  };
  try {
    out.community = await comm(range);
    out.prevCommunity = await comm(prev);
    const { results: pd } = await q(`SELECT date(created_at, '+9 hours') AS day, COUNT(*) AS n FROM posts WHERE created_at >= ? AND created_at < ? GROUP BY day`, range.isoFrom, range.isoTo).all();
    const pm = Object.fromEntries(pd.map((x) => [x.day, x.n]));
    if (out.daily) out.daily.forEach((d) => (d.posts = pm[d.day] || 0));
    else out.dailyPosts = pd;
    /* 플레이스별 후기 수 (기간 / 누적) */
    const [pr, pa] = await env.DB.batch([
      q(`SELECT space_id, COUNT(*) AS n FROM posts WHERE hidden = 0 AND space_id IS NOT NULL AND space_id <> '' AND created_at >= ? AND created_at < ? GROUP BY space_id`, range.isoFrom, range.isoTo),
      q(`SELECT space_id, COUNT(*) AS n FROM posts WHERE hidden = 0 AND space_id IS NOT NULL AND space_id <> '' GROUP BY space_id`)
    ]);
    if (out._places) {
      const P = out._places;
      const row = (id) => (P[id] = P[id] || { space_id: id, pv: 0, uv: 0, dwell: 0, map: 0, mapUv: 0, mapNaver: 0, mapGoogle: 0, out: 0, share: 0, likesNew: 0, likesAll: 0, posts: 0, postsAll: 0 });
      pr.results.forEach((x) => (row(x.space_id).posts = x.n));
      pa.results.forEach((x) => (row(x.space_id).postsAll = x.n));
    } else {
      out.placePosts = pa.results;
    }
  } catch { out.community = null; }

  if (out._places) {
    out.places = Object.values(out._places).map((x) => ({ ...x, mapRate: x.uv ? x.mapUv / x.uv : 0 }));
    delete out._places;
  }

  /* ── 3. 회원 (호스트) ─────────────────────────── */
  try {
    const [t, rn, rv] = await env.DB.batch([
      q(`SELECT COUNT(*) AS total, SUM(status = 'verified') AS verified, SUM(status IN ('new','reviewing')) AS pending, SUM(status = 'rejected') AS rejected FROM hosts`),
      q(`SELECT COUNT(*) AS n FROM hosts WHERE created_at >= ? AND created_at < ?`, range.isoFrom, range.isoTo),
      q(`SELECT COUNT(*) AS n FROM hosts WHERE verified_at >= ? AND verified_at < ?`, range.isoFrom, range.isoTo)
    ]);
    const [pn] = await env.DB.batch([q(`SELECT COUNT(*) AS n FROM hosts WHERE created_at >= ? AND created_at < ?`, prev.isoFrom, prev.isoTo)]);
    let list;
    try {
      list = (await q(`SELECT id, space_id, space_name, cat, area, owner_name, email, phone, status, created_at, verified_at, pub_updated_at,
                         CASE WHEN host_key IS NULL THEN 0 ELSE 1 END AS has_key
                       FROM hosts ORDER BY created_at DESC LIMIT 500`).all()).results;
    } catch {
      list = (await q(`SELECT id, space_id, space_name, cat, area, owner_name, email, phone, status, created_at, verified_at FROM hosts ORDER BY created_at DESC LIMIT 500`).all()).results;
    }
    /* 호스트별 답글 수 (호스트센터 활동) */
    let replies = {};
    try {
      const { results } = await q(`SELECT p.space_id, COUNT(*) AS n FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.is_host = 1 GROUP BY p.space_id`).all();
      replies = Object.fromEntries(results.map((x) => [x.space_id, x.n]));
    } catch { /* 002 마이그레이션 전 */ }
    const x = t.results[0] || {};
    out.members = {
      total: x.total || 0, verified: x.verified || 0, pending: x.pending || 0, rejected: x.rejected || 0,
      newInRange: rn.results[0]?.n || 0, newPrev: pn.results[0]?.n || 0, verifiedInRange: rv.results[0]?.n || 0,
      list: list.map((h) => ({ ...h, replies: replies[h.space_id] || 0 }))
    };
  } catch { out.members = null; }

  return out;
}
