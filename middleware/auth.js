/**
 * 登录鉴权中间件
 * 通过 Cookie 中的 token / admin_token 识别登录状态
 */
const { db } = require('../db/database');

/** 根据请求中的 token 查询会话 */
function getSession(req, role) {
  const cookie = req.headers.cookie || '';
  const key = role === 'admin' ? 'admin_token' : 'token';
  const m = cookie.match(new RegExp('(?:^|; )' + key + '=([^;]+)'));
  if (!m) return null;
  return db.prepare('SELECT * FROM sessions WHERE token = ? AND role = ?').get(m[1], role) || null;
}

/** 普通用户必须登录 */
function requireUser(req, res, next) {
  const session = getSession(req, 'user');
  if (!session) return res.status(401).json({ code: 401, msg: '请先登录' });
  const user = db.prepare('SELECT id, username, nickname, phone, avatar, status FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ code: 401, msg: '用户不存在' });
  if (user.status === 0) return res.status(403).json({ code: 403, msg: '账号已被禁用' });
  req.user = user;
  next();
}

/** 管理员必须登录 */
function requireAdmin(req, res, next) {
  const session = getSession(req, 'admin');
  if (!session) return res.status(401).json({ code: 401, msg: '请先登录管理员账号' });
  const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(session.user_id);
  if (!admin) return res.status(401).json({ code: 401, msg: '管理员不存在' });
  req.admin = admin;
  next();
}

module.exports = { getSession, requireUser, requireAdmin };
