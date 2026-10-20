/**
 * 用户工单路由：我的投诉 / 我的返修 / 我的举报
 * GET  /api/tickets?type=complaint|rework|report   我的工单列表
 * POST /api/tickets { type, order_no, title, content }  提交工单
 */
const express = require('express');
const { db, now } = require('../db/database');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser);

const TYPES = { complaint: '投诉', rework: '返修', report: '举报' };
const STATUS_TEXT = { 0: '待处理', 1: '处理中', 2: '已完结' };

// 我的工单列表（按类型筛选）
router.get('/', (req, res) => {
  const { type } = req.query;
  if (!TYPES[type]) return res.json({ code: 1, msg: '工单类型不正确' });
  const list = db.prepare('SELECT * FROM tickets WHERE user_id = ? AND type = ? ORDER BY id DESC')
    .all(req.user.id, type)
    .map(t => ({ ...t, type_text: TYPES[t.type], status_text: STATUS_TEXT[t.status] }));
  res.json({ code: 0, data: list });
});

// 提交工单
router.post('/', (req, res) => {
  const { type, order_no, title, content } = req.body || {};
  if (!TYPES[type]) return res.json({ code: 1, msg: '工单类型不正确' });
  if (!title || !title.trim()) return res.json({ code: 1, msg: '请填写标题' });
  if (!content || !content.trim()) return res.json({ code: 1, msg: '请填写详细描述' });

  const r = db.prepare(`INSERT INTO tickets (user_id, type, order_no, title, content, status, created_at)
    VALUES (?,?,?,?,?,0,?)`)
    .run(req.user.id, type, (order_no || '').trim(), title.trim(), content.trim(), now());

  const tips = {
    complaint: '投诉已提交，客服专员将在24小时内联系您处理',
    rework: '返修申请已提交，保修期内同部位故障免费返修',
    report: '举报已提交，平台核实后将严肃处理，感谢监督'
  };
  res.json({ code: 0, msg: tips[type], data: { id: r.lastInsertRowid } });
});

module.exports = router;
