/**
 * 管理员后台接口
 * 数据概览 / 用户管理 / 师傅管理 / 订单管理 / 评价管理 / 留言咨询管理
 */
const express = require('express');
const { db, hashPassword, now } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin); // 所有管理接口均需管理员登录

// ===================== 数据概览 =====================
router.get('/stats', (req, res) => {
  const count = (sql, ...p) => db.prepare(sql).get(...p).c;
  res.json({
    code: 0,
    data: {
      user_count: count('SELECT COUNT(*) c FROM users'),
      worker_count: count('SELECT COUNT(*) c FROM workers WHERE status = 1'),
      order_count: count('SELECT COUNT(*) c FROM orders'),
      paid_count: count('SELECT COUNT(*) c FROM orders WHERE pay_status = 1'),
      done_count: count('SELECT COUNT(*) c FROM orders WHERE status = 3'),
      pending_count: count('SELECT COUNT(*) c FROM orders WHERE status = 0'),
      review_count: count('SELECT COUNT(*) c FROM reviews'),
      revenue: db.prepare('SELECT IFNULL(SUM(price),0) s FROM orders WHERE pay_status = 1').get().s
    }
  });
});

// ===================== 用户管理 =====================
router.get('/users', (req, res) => {
  const { keyword } = req.query;
  let sql = `SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
             FROM users u WHERE 1=1`;
  const params = [];
  if (keyword) { sql += ' AND (u.username LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%'); }
  sql += ' ORDER BY u.id DESC';
  res.json({ code: 0, data: db.prepare(sql).all(...params) });
});

// 新增用户
router.post('/users', (req, res) => {
  const { username, password, nickname, phone } = req.body || {};
  if (!username || !password) return res.json({ code: 1, msg: '账号密码不能为空' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return res.json({ code: 1, msg: '账号已存在' });
  db.prepare('INSERT INTO users (username,password,nickname,phone,created_at) VALUES (?,?,?,?,?)')
    .run(username, hashPassword(password), nickname || username, phone || '', now());
  res.json({ code: 0, msg: '添加成功' });
});

// 编辑用户（昵称/手机号/状态/重置密码）
router.put('/users/:id', (req, res) => {
  const { nickname, phone, status, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.json({ code: 1, msg: '用户不存在' });
  db.prepare('UPDATE users SET nickname=?, phone=?, status=? WHERE id=?')
    .run(nickname ?? user.nickname, phone ?? user.phone, status ?? user.status, user.id);
  if (password) db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(password), user.id);
  res.json({ code: 0, msg: '保存成功' });
});

// 删除用户
router.delete('/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '已删除' });
});

// ===================== 维修师傅管理 =====================
router.get('/workers', (req, res) => {
  const { keyword } = req.query;
  let sql = 'SELECT * FROM workers WHERE 1=1';
  const params = [];
  if (keyword) { sql += ' AND (name LIKE ? OR skill LIKE ? OR phone LIKE ?)'; params.push('%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%'); }
  sql += ' ORDER BY id DESC';
  res.json({ code: 0, data: db.prepare(sql).all(...params) });
});

router.post('/workers', (req, res) => {
  const { name, phone, avatar, skill, years, rating } = req.body || {};
  if (!name) return res.json({ code: 1, msg: '师傅姓名不能为空' });
  db.prepare(`INSERT INTO workers (name, phone, avatar, skill, years, rating, status, created_at)
    VALUES (?,?,?,?,?,1,?,?)`)
    .run(name, phone || '', avatar || '👨‍🔧', skill || '', Number(years) || 5, Number(rating) || 5.0, now());
  res.json({ code: 0, msg: '添加成功' });
});

router.put('/workers/:id', (req, res) => {
  const { name, phone, avatar, skill, years, rating, status } = req.body || {};
  const w = db.prepare('SELECT * FROM workers WHERE id = ?').get(req.params.id);
  if (!w) return res.json({ code: 1, msg: '师傅不存在' });
  db.prepare(`UPDATE workers SET name=?, phone=?, avatar=?, skill=?, years=?, rating=?, status=? WHERE id=?`)
    .run(name ?? w.name, phone ?? w.phone, avatar ?? w.avatar, skill ?? w.skill,
      years ?? w.years, rating ?? w.rating, status ?? w.status, w.id);
  res.json({ code: 0, msg: '保存成功' });
});

router.delete('/workers/:id', (req, res) => {
  db.prepare('DELETE FROM workers WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '已删除' });
});

// ===================== 订单管理 =====================
router.get('/orders', (req, res) => {
  const { status, keyword } = req.query;
  let sql = `SELECT o.*, u.nickname, u.phone AS user_phone,
             w.name AS worker_name
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN workers w ON o.worker_id = w.id WHERE 1=1`;
  const params = [];
  if (status !== undefined && status !== '') { sql += ' AND o.status = ?'; params.push(Number(status)); }
  if (keyword) {
    sql += ' AND (o.order_no LIKE ? OR u.nickname LIKE ? OR o.service_name LIKE ? OR o.device_name LIKE ?)';
    params.push('%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%');
  }
  sql += ' ORDER BY o.id DESC';
  res.json({ code: 0, data: db.prepare(sql).all(...params) });
});

// 修改订单检修状态（如标记已完成）
router.put('/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (![0, 1, 2, 3, 4].includes(Number(status))) return res.json({ code: 1, msg: '状态不合法' });
  const extra = Number(status) === 3 ? ', finish_time = ?' : '';
  const params = [Number(status)];
  if (Number(status) === 3) params.push(now());
  params.push(order.id);
  db.prepare(`UPDATE orders SET status = ?${extra} WHERE id = ?`).run(...params);
  res.json({ code: 0, msg: '状态已更新' });
});

// ===================== 评价管理 =====================
router.get('/reviews', (req, res) => {
  const list = db.prepare(`SELECT r.*, u.nickname, s.name AS service_name, o.order_no
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN services s ON r.service_id = s.id
    LEFT JOIN orders o ON r.order_id = o.id
    ORDER BY r.id DESC`).all();
  res.json({ code: 0, data: list });
});

router.delete('/reviews/:id', (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '评价已删除' });
});

// ===================== 留言咨询管理 =====================
router.get('/messages', (req, res) => {
  // 按用户聚合，返回每个用户的会话
  const users = db.prepare(`SELECT DISTINCT m.user_id, u.nickname, u.username,
    (SELECT content FROM messages WHERE user_id = m.user_id ORDER BY id DESC LIMIT 1) AS last_content,
    (SELECT created_at FROM messages WHERE user_id = m.user_id ORDER BY id DESC LIMIT 1) AS last_time,
    (SELECT COUNT(*) FROM messages WHERE user_id = m.user_id AND role = 'user') AS msg_count
    FROM messages m LEFT JOIN users u ON m.user_id = u.id
    ORDER BY m.user_id DESC`).all();
  res.json({ code: 0, data: users });
});

// 查看某个用户的完整聊天记录
router.get('/messages/:userId', (req, res) => {
  const list = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY id ASC').all(req.params.userId);
  res.json({ code: 0, data: list });
});

// 客服回复
router.post('/messages/:userId/reply', (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.json({ code: 1, msg: '回复内容不能为空' });
  db.prepare('INSERT INTO messages (user_id, role, content, created_at) VALUES (?,?,?,?)')
    .run(req.params.userId, 'admin', content.trim(), now());
  res.json({ code: 0, msg: '回复成功' });
});

module.exports = router;
