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

/* ==================== 图形验证码（字母数字，SVG 免依赖） ==================== */
// captchaId -> { text, expires }（内存存储，5分钟有效，一次性使用）
const captchaStore = new Map();
const CAP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I O 0 1

/** 生成 4 位随机验证码文本 */
function genCaptchaText() {
  let t = '';
  for (let i = 0; i < 4; i++) t += CAP_CHARS[Math.floor(Math.random() * CAP_CHARS.length)];
  return t;
}

/** 把验证码文本绘制成带干扰线的 SVG 图片 */
function captchaSvg(text) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  let chars = '';
  for (let i = 0; i < text.length; i++) {
    const x = 14 + i * 24 + rnd(-3, 3);
    const y = rnd(26, 34);
    const rotate = rnd(-25, 25).toFixed(0);
    const color = `hsl(${rnd(0, 360).toFixed(0)},65%,40%)`;
    chars += `<text x="${x}" y="${y}" font-size="26" font-weight="700" fill="${color}" transform="rotate(${rotate} ${x} ${y})" font-family="Verdana,sans-serif">${text[i]}</text>`;
  }
  let noise = '';
  for (let i = 0; i < 4; i++) {
    noise += `<line x1="${rnd(0, 120)}" y1="${rnd(0, 44)}" x2="${rnd(0, 120)}" y2="${rnd(0, 44)}" stroke="hsl(${rnd(0, 360).toFixed(0)},50%,70%)" stroke-width="1.2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44"><rect width="120" height="44" fill="#f4f6f9" rx="6"/>${noise}${chars}</svg>`;
}

/** 校验验证码：一次性，校验后即销毁 */
function verifyCaptcha(id, input) {
  const item = captchaStore.get(id);
  captchaStore.delete(id);
  if (!item || item.expires < Date.now()) return false;
  return item.text.toLowerCase() === String(input || '').trim().toLowerCase();
}

// 获取图形验证码（前端 <img> 直接显示 SVG）
router.get('/captcha', (req, res) => {
  const text = genCaptchaText();
  const id = crypto.randomBytes(12).toString('hex');
  captchaStore.set(id, { text, expires: Date.now() + 5 * 60 * 1000 });
  // 顺带清理过期验证码，避免内存累积
  for (const [k, v] of captchaStore) if (v.expires < Date.now()) captchaStore.delete(k);
  res.json({ code: 0, data: { id, svg: captchaSvg(text) } });
});

/** 登录成功后的统一写会话逻辑 */
function createSession(res, role, userId) {
  const token = genToken();
  db.prepare('INSERT INTO sessions (token, role, user_id, created_at) VALUES (?,?,?,?)')
    .run(token, role, userId, now());
  const key = role === 'admin' ? 'admin_token' : 'token';
  res.setHeader('Set-Cookie', `${key}=${token}; Path=/; Max-Age=86400; SameSite=Lax`);
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

// ============ 用户验证码登录（账号 + 图形验证码，免密码） ============
router.post('/login-captcha', (req, res) => {
  const { username, captchaId, captcha } = req.body || {};
  if (!username) return res.json({ code: 1, msg: '请输入账号' });
  if (!verifyCaptcha(captchaId, captcha)) return res.json({ code: 1, msg: '验证码错误或已过期' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.json({ code: 1, msg: '账号不存在，请先注册' });
  if (user.status === 0) return res.json({ code: 1, msg: '账号已被禁用，请联系管理员' });

  createSession(res, 'user', user.id);
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

// ============ 管理员验证码登录（账号 + 图形验证码，免密码） ============
router.post('/admin/login-captcha', (req, res) => {
  const { username, captchaId, captcha } = req.body || {};
  if (!username) return res.json({ code: 1, msg: '请输入管理员账号' });
  if (!verifyCaptcha(captchaId, captcha)) return res.json({ code: 1, msg: '验证码错误或已过期' });

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) return res.json({ code: 1, msg: '管理员账号不存在' });

  createSession(res, 'admin', admin.id);
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
