/**
 * 公共数据接口：轮播图、公告、分类、服务项目、师傅、评价、节日活动、用户资产
 */
const express = require('express');
const { db, now } = require('../db/database');
const { requireUser } = require('../middleware/auth');
const { currentHoliday, upcomingHoliday, dynamicAnnouncement } = require('../utils/holiday');

const router = express.Router();

// ============ 轮播图列表（节日期间自动把节日主题页插到第一张，节日结束自动下线） ============
router.get('/banners', (req, res) => {
  const list = db.prepare('SELECT * FROM banners ORDER BY sort ASC').all();
  const h = currentHoliday();
  if (h) {
    list.unshift({ id: 0, title: h.bannerTitle, sub_title: h.bannerSub, image: h.bannerImg });
  }
  res.json({ code: 0, data: list });
});

// ============ 公告列表（首条按日期实时生成：节日中/临近节日/时令提示） ============
router.get('/announcements', (req, res) => {
  const list = db.prepare('SELECT * FROM announcements ORDER BY sort ASC').all();
  list.unshift({ id: 0, content: dynamicAnnouncement() });
  res.json({ code: 0, data: list });
});

// ============ 当前节日活动信息（前端展示促销条/优惠提示用） ============
router.get('/holiday', (req, res) => {
  const h = currentHoliday();
  const up = upcomingHoliday();
  res.json({
    code: 0,
    data: {
      active: !!h,
      name: h ? h.name : null,
      bannerTitle: h ? h.bannerTitle : null,
      promo: h ? h.promo : null,
      coupon: h ? h.coupon : null,
      upcoming: up || null
    }
  });
});

/* ==================== 用户资产（优惠券/积分/保修卡/服务次数，随使用自动更新） ==================== */

/** 给用户发券（同一用户同名券不重复发放） */
function grantCoupon(userId, title, amount, min, expireAt) {
  const exists = db.prepare('SELECT id FROM coupons WHERE user_id = ? AND title = ?').get(userId, title);
  if (exists) return false;
  db.prepare('INSERT INTO coupons (user_id, title, amount, min_amount, status, expire_at, created_at) VALUES (?,?,?,?,0,?,?)')
    .run(userId, title, amount, min, expireAt || '', now());
  return true;
}

// 我的资产总览：积分 / 优惠券 / 保修卡 / 服务次数
router.get('/user/stats', requireUser, (req, res) => {
  const uid = req.user.id;

  // 1) 新人券：注册即送 18 元满150券（与首页红包金额一致）
  grantCoupon(uid, '新人专享券', 18, 150, '');
  // 2) 节日券：节日期间进入即自动发放，节日结束7天后过期
  const h = currentHoliday();
  if (h) grantCoupon(uid, h.coupon.title, h.coupon.amount, h.coupon.min, h.to + ' 23:59:59');

  // 3) 积分：已完成订单金额 1元=1积分（随订单完成自动累积）
  const done = db.prepare(`SELECT price, finish_time, created_at FROM orders WHERE user_id = ? AND status = 3`).all(uid);
  const points = Math.floor(done.reduce((s, o) => s + (o.price || 0), 0));
  const serviceCount = done.length;

  // 4) 保修卡：近90天内完成的订单，同部位故障保修90天（每张卡对应一单）
  const cutoff = new Date(Date.now() - 90 * 86400000);
  const warranty = done.filter(o => {
    const t = new Date((o.finish_time || o.created_at || '').replace(' ', 'T'));
    return !isNaN(t) && t >= cutoff;
  }).length;

  // 5) 可用优惠券数（自动把过期的标记掉）
  db.prepare(`UPDATE coupons SET status = 2 WHERE status = 0 AND expire_at != '' AND expire_at < ?`).run(now());
  const couponCount = db.prepare('SELECT COUNT(*) AS c FROM coupons WHERE user_id = ? AND status = 0').get(uid).c;

  res.json({ code: 0, data: { points, coupons: couponCount, warranty, serviceCount } });
});

// 我的优惠券列表
router.get('/coupons', requireUser, (req, res) => {
  db.prepare(`UPDATE coupons SET status = 2 WHERE status = 0 AND expire_at != '' AND expire_at < ?`).run(now());
  const list = db.prepare('SELECT * FROM coupons WHERE user_id = ? ORDER BY status ASC, id DESC').all(req.user.id);
  res.json({ code: 0, data: list });
});

// ============ 分类树 ============
router.get('/categories', (req, res) => {
  const all = db.prepare('SELECT * FROM categories ORDER BY sort ASC').all();
  const tops = all.filter(c => c.parent_id === 0)
    .map(t => ({ ...t, children: all.filter(c => c.parent_id === t.id) }));
  res.json({ code: 0, data: tops });
});

// ============ 服务项目列表（支持分类/关键词） ============
router.get('/services', (req, res) => {
  const { cat, keyword, hot } = req.query;
  let sql = `SELECT s.*, c.name AS cat_name FROM services s
             LEFT JOIN categories c ON s.cat_id = c.id WHERE 1=1`;
  const params = [];
  if (cat) {
    // 传一级分类时，包含其下所有子分类
    const ids = db.prepare('SELECT id FROM categories WHERE id = ? OR parent_id = ?').all(Number(cat), Number(cat)).map(r => r.id);
    sql += ` AND s.cat_id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  if (keyword) {
    sql += ' AND s.name LIKE ?';
    params.push('%' + keyword + '%');
  }
  if (hot) sql += ' AND s.hot = 1';
  sql += ' ORDER BY s.hot DESC, s.sort ASC';
  res.json({ code: 0, data: db.prepare(sql).all(...params) });
});

// ============ 服务详情 ============
router.get('/services/:id', (req, res) => {
  const srv = db.prepare(`SELECT s.*, c.name AS cat_name FROM services s
    LEFT JOIN categories c ON s.cat_id = c.id WHERE s.id = ?`).get(req.params.id);
  if (!srv) return res.json({ code: 1, msg: '服务不存在' });
  // 该服务的评价
  srv.reviews = db.prepare(`SELECT r.*, u.nickname, u.avatar FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.service_id = ? ORDER BY r.id DESC LIMIT 10`).all(srv.id);
  srv.review_count = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE service_id = ?').get(srv.id).c;
  res.json({ code: 0, data: srv });
});

// ============ 在岗维修师傅列表 ============
router.get('/workers', (req, res) => {
  const list = db.prepare('SELECT * FROM workers WHERE status = 1 ORDER BY rating DESC, order_count DESC').all();
  res.json({ code: 0, data: list });
});

// ============ 服务评价列表 ============
router.get('/reviews', (req, res) => {
  const { service_id } = req.query;
  let sql = `SELECT r.*, u.nickname, u.avatar, s.name AS service_name
    FROM reviews r LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN services s ON r.service_id = s.id WHERE 1=1`;
  const params = [];
  if (service_id) { sql += ' AND r.service_id = ?'; params.push(service_id); }
  sql += ' ORDER BY r.id DESC';
  res.json({ code: 0, data: db.prepare(sql).all(...params) });
});

// ============ 用户资料更新 ============
router.put('/user/update', (req, res) => {
  // 从Cookie解析token获取用户ID
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|; )token=([^;]+)/);
  const token = m ? m[1] : null;
  if (!token) return res.json({ code: 401, msg: '请先登录' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!sess) return res.json({ code: 401, msg: '登录已过期' });

  const { nickname, avatar, gender, birthday, phone } = req.body;
  const userId = sess.user_id;

  // 构建更新语句
  const updates = [];
  const params = [];
  if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname); }
  if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
  if (gender !== undefined) { updates.push('gender = ?'); params.push(gender); }
  if (birthday !== undefined) { updates.push('birthday = ?'); params.push(birthday); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }

  if (!updates.length) return res.json({ code: 1, msg: '没有要更新的内容' });

  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ code: 0, msg: '更新成功' });
});

module.exports = router;
