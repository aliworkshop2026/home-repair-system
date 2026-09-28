/* =========================================================
   我的订单：待预约 / 待检修（待支付+待上门） / 已完成
   ========================================================= */
renderTabbar(); // 订单页从“我的”进入，不高亮主 Tab
let curType = qs('tab') || 'pending';
const TABS = ['pending', 'repair', 'done'];

/** 订单卡片 HTML */
function orderCard(o) {
  // 图片（无图片的自助报修用 emoji 占位底）
  const imgHtml = o.service_image
    ? `<img class="oc-img" src="${o.service_image}" alt="">`
    : `<div class="oc-img"><div class="emoji-bg">🛠️</div></div>`;

  // 根据状态生成操作按钮
  let actions = '';
  if (o.status === 0) {
    actions = `
      <button class="btn-gray btn-sm" onclick="cancelOrder(${o.id})">取消订单</button>
      <button class="btn-red btn-sm" style="color:#fff;padding:7px 18px" onclick="go('booking.html?id=${o.id}')">去预约</button>`;
  } else if (o.status === 1) {
    actions = `
      <button class="btn-gray btn-sm" onclick="cancelOrder(${o.id})">取消订单</button>
      <button class="btn-red btn-sm" style="color:#fff;padding:7px 18px" onclick="go('pay.html?id=${o.id}')">去支付</button>`;
  } else if (o.status === 2) {
    actions = `
      <button class="btn-plain btn-sm" onclick="callWorker('${o.worker ? o.worker.phone : ''}')">📞 联系师傅</button>
      <button class="btn-gray btn-sm" style="cursor:default">师傅即将上门</button>`;
  } else if (o.status === 3) {
    actions = o.review
      ? `<button class="btn-gray btn-sm" style="cursor:default">✅ 已评价</button>
         <button class="btn-plain btn-sm" onclick="go('repair.html')">再次预约</button>`
      : `<button class="btn-red btn-sm" style="color:#fff;padding:7px 18px" onclick="go('review.html?id=${o.id}')">立即评价</button>
         <button class="btn-plain btn-sm" onclick="go('repair.html')">再次预约</button>`;
  } else if (o.status === 4) {
    actions = `<button class="btn-plain btn-sm" onclick="go('repair.html')">重新报修</button>`;
  }

  const amount = o.price > 0 ? '¥' + o.price : (o.status >= 1 ? '待现场报价' : '待报价');
  return `
  <div class="order-card">
    <div class="oc-top">
      <span class="oc-no">订单号：${o.order_no}</span>
      <span class="oc-st st-${o.status}">${o.status_text}</span>
    </div>
    <div class="oc-body">
      ${imgHtml}
      <div class="oc-info">
        <b>${o.service_name}</b>
        <p>故障：${o.fault_desc || '-'}</p>
        <p>地址：${o.address}</p>
        <p>预约：${o.appoint_time || o.expect_time}　${o.worker ? '师傅：' + o.worker.name : ''}</p>
      </div>
    </div>
    <div class="oc-actions">
      <span style="margin-right:auto;color:var(--text-3);font-size:12px;align-self:center">${o.created_at}</span>
      ${actions}
    </div>
  </div>`;
}

async function loadList() {
  const user = await requireLogin();
  if (!user) return;
  document.querySelectorAll('.order-tabs a').forEach(a => {
    a.classList.toggle('on', a.dataset.type === curType);
    a.onclick = () => { curType = a.dataset.type; loadList(); };
  });
  const box = document.getElementById('orderBox');
  box.innerHTML = '<div class="loading">加载中...</div>';
  const r = await api('/api/orders?type=' + curType);
  const list = r.data || [];
  if (!list.length) {
    const txt = { pending: '暂无待预约订单', repair: '暂无待检修订单', done: '暂无已完成订单' }[curType];
    box.innerHTML = `<div class="empty"><span class="e-ico">📭</span>${txt}<br><br>
      <button class="btn-plain" onclick="go('services.html')">去看看服务</button></div>`;
    return;
  }
  box.innerHTML = list.map(orderCard).join('');
}

/** 联系师傅 */
function callWorker(phone) {
  if (!phone) return toast('师傅电话暂未提供');
  location.href = 'tel:' + phone;
}

/** 取消订单 */
async function cancelOrder(id) {
  if (!confirm('确定取消该订单吗？')) return;
  const r = await api(`/api/orders/${id}/cancel`, { method: 'POST' });
  toast(r.msg);
  if (r.code === 0) loadList();
}

loadList();
