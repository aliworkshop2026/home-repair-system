/* =========================================================
   管理后台公共脚本：请求封装 / 登录守卫 / 侧边栏 / 通用组件
   ========================================================= */

async function api(url, options = {}) {
  const opt = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (options.body) opt.body = JSON.stringify(options.body);
  const res = await fetch(url, opt);
  return await res.json().catch(() => ({ code: -1, msg: '响应解析失败' }));
}

function toast(msg, ms = 1600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** 后台页面统一守卫：未登录跳登录页 */
async function guard() {
  const r = await api('/api/auth/me');
  // /api/auth/me 是用户接口；管理员用下面的 admin stats 探测
  const ar = await api('/api/admin/stats');
  if (ar.code === 401) {
    location.href = 'login.html';
    return null;
  }
  return ar;
}

/** 侧边栏菜单 */
const MENU = [
  { url: 'index.html', icon: '📊', name: '数据概览' },
  { url: 'orders.html', icon: '📋', name: '订单管理' },
  { url: 'workers.html', icon: '👷', name: '维修师傅管理' },
  { url: 'users.html', icon: '👥', name: '用户信息管理' },
  { url: 'reviews.html', icon: '⭐', name: '评价管理' },
  { url: 'messages.html', icon: '💬', name: '咨询留言' }
];

/** 渲染后台框架（侧边栏 + 顶栏），active 为当前页面文件名 */
async function renderLayout(title, active) {
  await guard();
  document.body.insertAdjacentHTML('afterbegin', `
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">🐴 <span>阿李工坊</span>维修后台</div>
      <nav class="menu">
        ${MENU.map(m => `<a href="${m.url}" class="${m.url === active ? 'on' : ''}"><i>${m.icon}</i>${m.name}</a>`).join('')}
      </nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <span class="page-tit">${title}</span>
        <div class="admin-info">
          <span class="avatar">👨‍💼</span>
          <span>管理员 admin</span>
          <button class="logout" id="logoutBtn">退出登录</button>
        </div>
      </div>
      <div class="content" id="pageContent"></div>
    </div>
  </div>`);
  // 各页面内容默认写在 body 的 #root 里，移动到 content
  const root = document.getElementById('root');
  if (root) document.getElementById('pageContent').appendChild(root);

  document.getElementById('logoutBtn').onclick = async () => {
    if (!confirm('确定退出后台吗？')) return;
    await api('/api/auth/admin/logout', { method: 'POST' });
    location.href = 'login.html';
  };
}

/** 弹窗 */
function openModal(html) {
  const mask = document.createElement('div');
  mask.className = 'mask';
  mask.innerHTML = `<div class="modal">${html}</div>`;
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  document.body.appendChild(mask);
  return mask;
}
function closeModal() { document.querySelector('.mask')?.remove(); }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
