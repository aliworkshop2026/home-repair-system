/**
 * 用户地址管理接口
 * GET    /api/addresses       获取当前用户地址列表
 * GET    /api/addresses/:id   获取单个地址
 * POST   /api/addresses       新增地址
 * PUT    /api/addresses/:id   修改地址
 * DELETE /api/addresses/:id   删除地址
 */
const express = require('express');
const { db, now } = require('../db/database');

const router = express.Router();

// 中间件：检查登录（从Cookie解析token）
function auth(req, res, next) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|; )token=([^;]+)/);
  const token = m ? m[1] : null;
  if (!token) return res.json({ code: 401, msg: '请先登录' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!sess) return res.json({ code: 401, msg: '登录已过期' });
  req.userId = sess.user_id;
  next();
}

router.use(auth);

// 获取地址列表
router.get('/', (req, res) => {
  const list = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.userId);
  res.json({ code: 0, data: list });
});

// 获取单个地址
router.get('/:id', (req, res) => {
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!addr) return res.json({ code: 1, msg: '地址不存在' });
  res.json({ code: 0, data: addr });
});

// 新增地址
router.post('/', (req, res) => {
  const { city, address, detail, contact, phone } = req.body;
  if (!city || !address || !contact || !phone) {
    return res.json({ code: 1, msg: '请填写完整信息' });
  }
  // 如果是第一条地址，设为默认
  const count = db.prepare('SELECT COUNT(*) AS c FROM addresses WHERE user_id = ?').get(req.userId).c;
  const isDefault = count === 0 ? 1 : 0;

  const r = db.prepare(`INSERT INTO addresses (user_id, city, address, detail, contact, phone, is_default, created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(req.userId, city, address, detail || '', contact, phone, isDefault, now());
  res.json({ code: 0, data: { id: r.lastInsertRowid }, msg: '添加成功' });
});

// 修改地址
router.put('/:id', (req, res) => {
  const { city, address, detail, contact, phone } = req.body;
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!addr) return res.json({ code: 1, msg: '地址不存在' });

  db.prepare(`UPDATE addresses SET city=?, address=?, detail=?, contact=?, phone=? WHERE id=?`)
    .run(city || addr.city, address || addr.address, detail ?? addr.detail, contact || addr.contact, phone || addr.phone, req.params.id);
  res.json({ code: 0, msg: '修改成功' });
});

// 删除地址
router.delete('/:id', (req, res) => {
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!addr) return res.json({ code: 1, msg: '地址不存在' });

  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
