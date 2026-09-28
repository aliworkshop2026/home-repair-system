/**
 * 订单路由（用户核心业务流程）
 * 提交报修 -> 预约师傅/时间 -> 模拟支付 -> 完成 -> 评价
 */
const express = require('express');
const { db, now } = require('../db/database');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser); // 以下接口全部需要登录

// 订单状态文案
const STATUS_TEXT = { 0: '待预约', 1: '待支付', 2: '待检修', 3: '已完成', 4: '已取消' };

/** 组装订单完整信息（含服务、师傅、评价） */
function fillOrder(o) {
  if (!o) return o;
  o.status_text = STATUS_TEXT[o.status] || '未知';
  o.worker = o.worker_id
    ? db.prepare('SELECT id, name, phone, avatar, skill, rating FROM workers WHERE id = ?').get(o.worker_id)
    : null;
  o.review = db.prepare('SELECT * FROM reviews WHERE order_id = ?').get(o.id);
  return o;
}

// ============ 1. 提交报修（创建订单，状态：待预约） ============
router.post('/', (req, res) => {
  const { service_id, device_name, fault_desc, address, expect_time } = req.body || {};
  if (!fault_desc || !address || !expect_time) {
    return res.json({ code: 1, msg: '请填写完整的故障描述、地址和期望时间' });
  }

  // 可从服务项目带入，也可自助填写设备名
  let srv = null;
  if (service_id) srv = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);

  const orderNo = 'ZMN' + Date.now() + Math.floor(Math.random() * 100 + 100);
  const result = db.prepare(`INSERT INTO orders
    (order_no, user_id, service_id, service_name, service_image, price,
     device_name, fault_desc, address, expect_time, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`).run(
      orderNo, req.user.id,
      srv ? srv.id : null,
      srv ? srv.name : (device_name || '自助报修'),
      srv ? srv.image : '',
      srv ? srv.price : 0,
      device_name || (srv ? srv.name : ''),
      fault_desc, address, expect_time, now()
    );

  res.json({ code: 0, msg: '报修提交成功，请预约维修师傅', data: { id: result.lastInsertRowid, order_no: orderNo } });
});

// ============ 2. 我的订单列表（按状态筛选） ============
// type: pending(待预约) / repair(待检修，含待支付+待检修) / done(已完成)
router.get('/', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM orders WHERE user_id = ?';
  const params = [req.user.id];
  if (type === 'pending') sql += ' AND status = 0';
  else if (type === 'repair') sql += ' AND status IN (1,2)';
  else if (type === 'done') sql += ' AND status = 3';
  sql += ' ORDER BY id DESC';
  const list = db.prepare(sql).all(...params).map(fillOrder);
  res.json({ code: 0, data: list });
});

// ============ 3. 订单详情 ============
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  res.json({ code: 0, data: fillOrder(order) });
});

// ============ 4. 预约维修师傅 + 确认上门时间（状态：待支付） ============
router.post('/:id/book', (req, res) => {
  const { worker_id, appoint_time } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 0) return res.json({ code: 1, msg: '该订单已预约，无需重复操作' });
  if (!worker_id || !appoint_time) return res.json({ code: 1, msg: '请选择维修师傅和预约时间' });

  const worker = db.prepare('SELECT * FROM workers WHERE id = ? AND status = 1').get(worker_id);
  if (!worker) return res.json({ code: 1, msg: '所选师傅不可用' });

  // 预约后若订单没有预设金额，用师傅服务的参考预估价（简化：保持服务价格或30元起）
  db.prepare(`UPDATE orders SET worker_id = ?, appoint_time = ?, status = 1 WHERE id = ?`)
    .run(worker_id, appoint_time, order.id);
  res.json({ code: 0, msg: '预约成功，请完成支付' });
});

// ============ 5. 模拟支付（不接真实支付，直接置为已支付/待检修） ============
router.post('/:id/pay', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 1) return res.json({ code: 1, msg: '当前订单无需支付' });

  db.prepare(`UPDATE orders SET pay_status = 1, pay_time = ?, status = 2 WHERE id = ?`)
    .run(now(), order.id);
  // 师傅接单量 +1
  if (order.worker_id) {
    db.prepare('UPDATE workers SET order_count = order_count + 1 WHERE id = ?').run(order.worker_id);
  }
  res.json({ code: 0, msg: '支付成功，师傅将按预约时间上门检修' });
});

// ============ 6. 提交评价（仅已完成订单） ============
router.post('/:id/review', (req, res) => {
  const { rating, content } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 3) return res.json({ code: 1, msg: '订单完成后才能评价' });
  const exists = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(order.id);
  if (exists) return res.json({ code: 1, msg: '该订单已评价' });
  if (!rating || rating < 1 || rating > 5) return res.json({ code: 1, msg: '请选择星级' });

  db.prepare(`INSERT INTO reviews (order_id, user_id, service_id, worker_id, rating, content, created_at)
    VALUES (?,?,?,?,?,?,?)`).run(
      order.id, req.user.id, order.service_id, order.worker_id,
      Number(rating), content || '用户未填写评价', now()
    );
  res.json({ code: 0, msg: '评价提交成功' });
});

// ============ 7. 取消订单 ============
router.post('/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status >= 3) return res.json({ code: 1, msg: '当前状态不可取消' });
  db.prepare('UPDATE orders SET status = 4 WHERE id = ?').run(order.id);
  res.json({ code: 0, msg: '订单已取消' });
});

module.exports = router;
