/**
 * 认证路由：用户注册 / 登录 / 退出 / 获取当前用户；管理员登录
 */
const express = require('express');
const crypto = require('crypto');
const { db, hashPassword, now } = require('../db/database');
const { requireUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/** 生成随机登录 token */
function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

// ============ 用户注册 ============
router.post('/register', (req, res) => {
  const { username, password, nickname, phone } = req.body || {};
  if (!username || !password) {
    return res.json({ code: 1, msg: '账号和密码不能为空' });
  }
  if (username.length < 3) return res.json({ code: 1, msg: '账号至少3个字符' });
  if (password.length < 6) return res.json({ code: 1, msg: '密码至少6位' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.json({ code: 1, msg: '该账号已被注册' });

  const result = db.prepare(
    'INSERT INTO users (username, password, nickname, phone, avatar, created_at) VALUES (?,?,?,?,?,?)'
  ).run(username, hashPassword(password), nickname || username, phone || '', '😀', now());

  res.json({ code: 0, msg: '注册成功', data: { id: result.lastInsertRowid } });
});

// ============ 用户登录 ============
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');
  if (!user || user.password !== hashPassword(password || '')) {
    return res.json({ code: 1, msg: '账号或密码错误' });
  }
  if (user.status === 0) return res.json({ code: 1, msg: '账号已被禁用，请联系管理员' });

  // 写入会话并种 Cookie
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, role, user_id, created_at) VALUES (?,?,?,?)')
    .run(token, 'user', user.id, now());
  res.setHeader('Set-Cookie',
    `token=${token}; Path=/; Max-Age=86400; SameSite=Lax`);

  res.json({
    code: 0, msg: '登录成功',
    data: { id: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar }
  });
});

// ============ 退出登录 ============
router.post('/logout', (req, res) => {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|; )token=([^;]+)/);
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0');
  res.json({ code: 0, msg: '已退出' });
});

// ============ 获取当前登录用户信息 ============
router.get('/me', requireUser, (req, res) => {
  res.json({ code: 0, data: req.user });
});

// ============ 修改手机号/昵称 ============
router.post('/profile', requireUser, (req, res) => {
  const { nickname, phone } = req.body || {};
  db.prepare('UPDATE users SET nickname = ?, phone = ? WHERE id = ?')
    .run(nickname || req.user.nickname, phone || '', req.user.id);
  res.json({ code: 0, msg: '保存成功' });
});

// ============ 管理员登录 ============
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username || '');
  if (!admin || admin.password !== hashPassword(password || '')) {
    return res.json({ code: 1, msg: '管理员账号或密码错误' });
  }
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, role, user_id, created_at) VALUES (?,?,?,?)')
    .run(token, 'admin', admin.id, now());
  res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; Max-Age=86400; SameSite=Lax`);
  res.json({ code: 0, msg: '登录成功', data: { id: admin.id, username: admin.username } });
});

// ============ 管理员退出 ============
router.post('/admin/logout', requireAdmin, (req, res) => {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|; )admin_token=([^;]+)/);
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; Max-Age=0');
  res.json({ code: 0, msg: '已退出' });
});

module.exports = router;
