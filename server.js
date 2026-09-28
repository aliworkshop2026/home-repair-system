/**
 * 家用设备上门检修预约系统 —— 服务入口
 * --------------------------------------------------
 * 技术栈：Node.js + Express + 内置 SQLite(node:sqlite)
 * 启动方式：npm start  或  node server.js
 * 启动后：自动建表初始化数据，并在浏览器打开用户端首页
 */
const express = require('express');
const path = require('path');
const { initDatabase } = require('./db/database');

// 1. 初始化数据库（自动建表 + 种子数据）
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// 2. 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. 静态资源（前端页面全部放在 public；开发期禁用缓存，确保更新立即生效）
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
}));

// 4. API 路由
app.use('/api/auth', require('./routes/auth'));        // 注册/登录/管理员登录
app.use('/api', require('./routes/api'));              // 轮播图/公告/分类/服务/师傅
app.use('/api/orders', require('./routes/orders'));    // 报修/预约/支付/评价
app.use('/api/messages', require('./routes/messages'));// 在线咨询留言
app.use('/api/addresses', require('./routes/addresses'));// 用户地址管理
app.use('/api/admin', require('./routes/admin'));      // 管理员后台

// 5. 健康检查
app.get('/api/health', (req, res) => res.json({ code: 0, msg: '服务运行中', time: new Date().toLocaleString() }));

// 404 兜底
app.use('/api', (req, res) => res.status(404).json({ code: 404, msg: '接口不存在' }));

// 6. 启动服务（监听所有网卡，局域网/预览地址均可访问）
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('==============================================');
  console.log('  家用设备上门检修预约系统 启动成功！');
  console.log('==============================================');
  console.log(`  本机访问：  http://localhost:${PORT}`);
  console.log(`  用户端：    http://localhost:${PORT}/index.html`);
  console.log(`  管理后台：  http://localhost:${PORT}/admin/login.html`);
  console.log('----------------------------------------------');
  console.log('  演示用户：  test123 / 123456');
  console.log('  管理员：    admin / admin123');
  console.log('==============================================');
});
