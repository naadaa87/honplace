/* 혼플 운영자 API
   Pages 설정에서 환경변수 ADMIN_KEY 를 만들고 ?key=... 로 호출합니다.

   GET  /api/admin?key=KEY&what=stats                   대시보드 숫자
   GET  /api/admin?key=KEY&what=posts&...               글 목록 (q, category, state, limit, offset)
   GET  /api/admin?key=KEY&what=reported                신고 쌓였거나 숨겨진 글
   GET  /api/admin?key=KEY&what=submissions&status=new  제보·수정 제안
   GET  /api/admin?key=KEY&what=comments&post=ID        특정 글의 답글

   POST /api/admin?key=KEY  {"action":"hide"|"unhide"|"delete","id":"p-..."}
   POST /api/admin?key=KEY  {"action":"bulk","ids":[...],"op":"hide"|"unhide"|"delete"}
   POST /api/admin?key=KEY  {"action":"submission","id":"s-...","status":"done"|"skip"|"new"}
   POST /api/admin?key=KEY  {"action":"comment-delete","id":"c-..."}
   POST /api/admin?key=KEY  {"action":"host","id":"h-...","status":"reviewing|verified|rejected|new","memo":"..."}
*/
import { json, bad } from '../_util.js';
import { newHostKey } from '../host/_auth.js';

const auth = (request, env) => env.ADMIN_KEY && new URL(request.url).searchParams.get('key') === env.ADMIN_KEY;
const num = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : d; };

export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  if (!auth(request, env)) return bad('권한이 없습니다', 401);

  const p = new URL(request.url).searchParams;
  const what = p.get('what') || 'reported';

  /* ── 대시보드 ── */
  if (what === 'stats') {
    const since = (days) => new Date(Date.now() - days * 86400000).toISOString();
    const one = async (sql, ...bind) => (await env.DB.prepare(sql).bind(...bind).first())?.n || 0;
    const [posts, visible, hidden, today, week, reported, comments, subsNew, subsAll, hostsNew, hostsVerified] = await Promise.all([
      one('SELECT COUNT(*) AS n FROM posts'),
      one('SELECT COUNT(*) AS n FROM posts WHERE hidden = 0'),
      one('SELECT COUNT(*) AS n FROM posts WHERE hidden = 1'),
      one('SELECT COUNT(*) AS n FROM posts WHERE created_at > ?', since(1)),
      one('SELECT COUNT(*) AS n FROM posts WHERE created_at > ?', since(7)),
      one('SELECT COUNT(*) AS n FROM posts WHERE reports > 0 AND hidden = 0'),
      one('SELECT COUNT(*) AS n FROM comments'),
      one(`SELECT COUNT(*) AS n FROM submissions WHERE status = 'new'`),
      one('SELECT COUNT(*) AS n FROM submissions'),
      one(`SELECT COUNT(*) AS n FROM hosts WHERE status IN ('new','reviewing')`).catch(() => 0),
      one(`SELECT COUNT(*) AS n FROM hosts WHERE status = 'verified'`).catch(() => 0)
    ]);
    const { results: byCat } = await env.DB.prepare(
      'SELECT category, COUNT(*) AS n FROM posts WHERE hidden = 0 GROUP BY category'
    ).all();
    const { results: topSpaces } = await env.DB.prepare(
      'SELECT space_id, space_name, COUNT(*) AS n FROM posts WHERE hidden = 0 AND space_id IS NOT NULL GROUP BY space_id ORDER BY n DESC LIMIT 10'
    ).all();
    const { results: daily } = await env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM posts WHERE created_at > ? GROUP BY d ORDER BY d`
    ).bind(since(14)).all();
    /* 호스트센터 마이그레이션이 적용됐는지 — 관리자 화면에서 안내용 */
    let schemaOk = true;
    try { await env.DB.prepare('SELECT host_key FROM hosts LIMIT 1').first(); }
    catch { schemaOk = false; }
    return json({
      stats: { posts, visible, hidden, today, week, reported, comments, subsNew, subsAll, hostsNew, hostsVerified },
      byCat, topSpaces, daily, schemaOk
    });
  }

  /* ── 글 목록 ── */
  if (what === 'posts') {
    const limit = num(p.get('limit'), 30, 100);
    const offset = num(p.get('offset'), 0, 100000);
    const where = [];
    const bind = [];
    const state = p.get('state') || '';
    if (state === 'hidden') where.push('hidden = 1');
    else if (state === 'visible') where.push('hidden = 0');
    else if (state === 'reported') where.push('reports > 0');
    const cat = p.get('category') || '';
    if (cat) { where.push('category = ?'); bind.push(cat); }
    const q = (p.get('q') || '').trim();
    if (q) { where.push('(body LIKE ? OR nickname LIKE ? OR space_name LIKE ?)'); bind.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM posts ${w}`).bind(...bind).first())?.n || 0;
    const { results } = await env.DB.prepare(
      `SELECT id, category, nickname, body, space_id, space_name, metoo, thanks, going, comments, reports, hidden, created_at
       FROM posts ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...bind, limit, offset).all();
    return json({ posts: results, total, limit, offset });
  }

  /* ── 특정 글의 답글 ── */
  if (what === 'comments') {
    const post = p.get('post');
    if (!post) return bad('글 id가 필요합니다');
    const { results } = await env.DB.prepare(
      'SELECT id, post_id, nickname, body, hidden, created_at FROM comments WHERE post_id = ? ORDER BY created_at'
    ).bind(post).all();
    return json({ comments: results });
  }

  /* ── 호스트 등록 신청 ── */
  if (what === 'hosts') {
    const status = p.get('status') || 'new';
    const sql = status === 'all'
      ? 'SELECT * FROM hosts ORDER BY created_at DESC LIMIT 300'
      : status === 'pending'
        ? `SELECT * FROM hosts WHERE status IN ('new','reviewing') ORDER BY created_at DESC LIMIT 300`
        : 'SELECT * FROM hosts WHERE status = ? ORDER BY created_at DESC LIMIT 300';
    const stmt = (status === 'all' || status === 'pending') ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(status);
    const { results } = await stmt.all();
    return json({ hosts: results });
  }

  /* ── 제보·수정 제안 ── */
  if (what === 'submissions') {
    const status = p.get('status') || 'new';
    const sql = status === 'all'
      ? 'SELECT * FROM submissions ORDER BY created_at DESC LIMIT 300'
      : 'SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT 300';
    const stmt = status === 'all' ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(status);
    const { results } = await stmt.all();
    return json({ submissions: results });
  }

  /* ── 기본: 신고·숨김 ── */
  const { results } = await env.DB.prepare(
    `SELECT id, category, nickname, body, space_name, reports, hidden, created_at
     FROM posts WHERE reports > 0 OR hidden = 1 ORDER BY reports DESC, created_at DESC LIMIT 200`
  ).all();
  return json({ posts: results });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad('데이터베이스가 연결되지 않았습니다', 503);
  if (!auth(request, env)) return bad('권한이 없습니다', 401);

  let b; try { b = await request.json(); } catch { return bad('잘못된 요청입니다'); }

  const del = (id) => [
    env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id)
  ];

  if (b.action === 'hide') {
    await env.DB.prepare('UPDATE posts SET hidden = 1 WHERE id = ?').bind(b.id).run();
  } else if (b.action === 'unhide') {
    await env.DB.prepare('UPDATE posts SET hidden = 0, reports = 0 WHERE id = ?').bind(b.id).run();
  } else if (b.action === 'delete') {
    await env.DB.batch(del(b.id));
  } else if (b.action === 'bulk') {
    const ids = Array.isArray(b.ids) ? b.ids.slice(0, 100) : [];
    if (!ids.length) return bad('선택된 글이 없습니다');
    if (b.op === 'delete') {
      const stmts = [];
      ids.forEach((id) => stmts.push(...del(id)));
      await env.DB.batch(stmts);
    } else if (b.op === 'hide' || b.op === 'unhide') {
      const hide = b.op === 'hide';
      await env.DB.batch(ids.map((id) =>
        env.DB.prepare(hide ? 'UPDATE posts SET hidden = 1 WHERE id = ?' : 'UPDATE posts SET hidden = 0, reports = 0 WHERE id = ?').bind(id)
      ));
    } else return bad('알 수 없는 작업입니다');
    return json({ ok: true, count: ids.length });
  } else if (b.action === 'submission') {
    const ok = ['new', 'done', 'skip'];
    const st = ok.includes(b.status) ? b.status : 'done';
    await env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ?').bind(st, b.id).run();
  } else if (b.action === 'host') {
    const ok = ['new', 'reviewing', 'verified', 'rejected'];
    if (!ok.includes(b.status)) return bad('알 수 없는 상태입니다');
    const memo = typeof b.memo === 'string' ? b.memo.slice(0, 1000) : null;
    if (b.status === 'verified') {
      /* 승인: 키가 없으면 발급하고, 신청 때 적은 안내를 공개 안내의 초안으로 옮깁니다 */
      const cur = await env.DB.prepare(`SELECT host_key, pub_note, solo_note, solo_seats, link FROM hosts WHERE id = ?`).bind(b.id).first();
      if (!cur) return bad('신청을 찾을 수 없습니다', 404);
      const key = cur.host_key || newHostKey();
      await env.DB.prepare(
        `UPDATE hosts SET status = 'verified', admin_memo = ?, verified_at = ?, host_key = ?,
                pub_note = COALESCE(pub_note, solo_note), pub_seats = COALESCE(pub_seats, solo_seats),
                pub_link = COALESCE(pub_link, link), pub_title = COALESCE(pub_title, '운영자가 직접 쓴 안내')
          WHERE id = ?`
      ).bind(memo, new Date().toISOString(), key, b.id).run();
      return json({ ok: true, host_key: key });
    }
    await env.DB.prepare(`UPDATE hosts SET status = ?, admin_memo = ?, verified_at = NULL WHERE id = ?`)
      .bind(b.status, memo, b.id).run();
  } else if (b.action === 'host-rekey') {
    /* 키 분실 시 재발급. 이전 키는 즉시 무효가 됩니다 */
    const key = newHostKey();
    await env.DB.prepare(`UPDATE hosts SET host_key = ? WHERE id = ? AND status = 'verified'`).bind(key, b.id).run();
    return json({ ok: true, host_key: key });
  } else if (b.action === 'comment-delete') {
    const c = await env.DB.prepare('SELECT post_id FROM comments WHERE id = ?').bind(b.id).first();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(b.id),
      ...(c ? [env.DB.prepare('UPDATE posts SET comments = (SELECT COUNT(*) FROM comments WHERE post_id = ?) WHERE id = ?').bind(c.post_id, c.post_id)] : [])
    ]);
  } else {
    return bad('알 수 없는 작업입니다');
  }
  return json({ ok: true });
}
