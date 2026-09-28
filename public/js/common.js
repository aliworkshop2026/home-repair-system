/* =========================================================
   用户端公共脚本：请求封装 / 登录态 / 底部Tab / 轻提示
   ========================================================= */

/** 简易 AJAX 请求（默认携带同域 Cookie） */
async function api(url, options = {}) {
  const opt = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (options.body) opt.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({ code: -1, msg: '响应解析失败' }));
  return data;
}

/** 获取 URL 查询参数 */
function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

/** 轻提示 Toast */
function toast(msg, ms = 1600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** 结果弹层（带确定按钮） */
function modal({ icon = '✅', title = '提示', text = '', btn = '确定', onOk }) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal-box">
      <div class="ok-ico">${icon}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      <button>${btn}</button>
    </div>`;
  mask.querySelector('button').onclick = () => { mask.remove(); onOk && onOk(); };
  document.body.appendChild(mask);
}

/** 跳转 */
function go(url) { location.href = url; }

/** 返回上一页 */
function back() { history.length > 1 ? history.back() : go('index.html'); }

/** 获取当前登录用户（未登录返回 null） */
async function currentUser() {
  const r = await api('/api/auth/me');
  return r.code === 0 ? r.data : null;
}

/** 必须登录，否则跳登录页 */
async function requireLogin() {
  const user = await currentUser();
  if (!user) {
    toast('请先登录');
    setTimeout(() => go('login.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)), 800);
    return null;
  }
  return user;
}

/* ---------------- 底部 Tab 导航 ---------------- */
const TAB_HTML = `
<div class="tabbar">
  <a href="index.html" data-tab="home"><span class="tab-ico">🏠</span>首页</a>
  <a href="services.html" data-tab="service"><span class="tab-ico">🧩</span>服务</a>
  <a href="consult.html" data-tab="consult"><span class="tab-ico">🎧</span>在线咨询</a>
  <a href="profile.html" data-tab="me"><span class="tab-ico">👤</span>我的</a>
</div>`;

/** 渲染底部 Tab，active: home/service/consult/me */
function renderTabbar(active) {
  const holder = document.createElement('div');
  holder.innerHTML = TAB_HTML;
  document.body.appendChild(holder.firstElementChild);
  if (active) {
    const a = document.querySelector(`.tabbar a[data-tab="${active}"]`);
    if (a) a.classList.add('active');
  }
}

/** 渲染通用返回头 */
function renderNavBar(title, showBack = true) {
  const bar = document.createElement('div');
  bar.className = 'nav-bar';
  bar.innerHTML = `${showBack ? '<a class="back" href="javascript:back()">‹</a>' : ''}<span>${title}</span>`;
  const phone = document.querySelector('.phone') || document.body;
  phone.prepend(bar);
}

/** 统一的价格展示 */
function priceText(s) {
  if (!s) return '';
  return `¥${s.price}<span style="font-size:13px">${s.unit || '起'}</span>`;
}

/** 默认城市（可扩展城市选择） */
const CITY = '北京市';

/* 图片加载失败/中断时优雅降级（隐藏 img，露出容器底色，避免裂图） */
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') e.target.style.opacity = 0;
}, true);
