/* =========================================================
   预约页面：选择维修师傅 + 确认上门时间 -> 提交预约
   ========================================================= */
const orderId = qs('id');
let selectedWorker = null;
let order = null;

/** 时间格式化为 input 可用值 */
function toInputValue(t) {
  if (!t) return '';
  return t.replace(' ', 'T').slice(0, 16);
}

/** 生成未来 3 天的快捷时段 */
function quickTimes() {
  const slots = ['09:00', '11:00', '14:00', '16:00', '18:30'];
  const arr = [];
  const p = n => String(n).padStart(2, '0');
  for (let day = 0; day < 3; day++) {
    const d = new Date(Date.now() + day * 86400000);
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    slots.forEach(t => arr.push({ date, time: t, label: day === 0 ? '今天 ' + t : day === 1 ? '明天 ' + t : `后天 ${t}` }));
  }
  return arr;
}

/** 加载订单详情 */
async function loadOrder() {
  const user = await requireLogin();
  if (!user) return;
  const r = await api('/api/orders/' + orderId);
  if (r.code !== 0) { toast(r.msg); return; }
  order = r.data;
  if (order.status !== 0) {
    toast('该订单已预约');
    setTimeout(() => go('orders.html?tab=repair'), 800);
    return;
  }
  document.getElementById('oImg').src = order.service_image || '';
  document.getElementById('oImg').onerror = function () { this.style.visibility = 'hidden'; };
  document.getElementById('oName').textContent = order.service_name || '自助报修';
  document.getElementById('oFault').textContent = '故障：' + (order.fault_desc || '');
  document.getElementById('oAddr').textContent = '地址：' + (order.address || '');
  document.getElementById('appointTime').value = toInputValue(order.expect_time) || '';

  // 快捷时段
  const qb = document.getElementById('quickTimes');
  qb.innerHTML = quickTimes().map((q, i) =>
    `<button type="button" class="btn-gray" data-i="${i}" style="margin:2px 0">${q.label}</button>`).join('');
  qb.querySelectorAll('button').forEach((b, i) => {
    b.onclick = () => {
      const q = quickTimes()[Number(b.dataset.i)];
      document.getElementById('appointTime').value = `${q.date}T${q.time}`;
      qb.querySelectorAll('button').forEach(x => x.classList.remove('btn-plain'));
      b.classList.remove('btn-gray');
      b.classList.add('btn-plain');
    };
  });
}

/** 加载在岗师傅 */
async function loadWorkers() {
  const r = await api('/api/workers');
  const list = r.data || [];
  document.getElementById('workerList').innerHTML = list.map(w => `
    <div class="worker-item" data-id="${w.id}">
      <div class="w-avatar">${w.avatar}</div>
      <div class="w-info">
        <b>${w.name}</b>
        <p>⭐ ${w.rating} 分 · 从业 ${w.years} 年 · 累计接单 ${w.order_count}</p>
        <p>擅长：${w.skill}</p>
      </div>
      <div class="radio"></div>
    </div>`).join('');
  document.querySelectorAll('.worker-item').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.worker-item').forEach(x => x.classList.remove('on'));
      el.classList.add('on');
      selectedWorker = Number(el.dataset.id);
    };
  });
}

/** 确认预约 */
document.getElementById('confirmBtn').onclick = async () => {
  const appoint_time = document.getElementById('appointTime').value.replace('T', ' ');
  if (!selectedWorker) return toast('请选择一位维修师傅');
  if (!appoint_time) return toast('请选择预约上门时间');

  const r = await api(`/api/orders/${orderId}/book`, {
    method: 'POST',
    body: { worker_id: selectedWorker, appoint_time }
  });
  if (r.code === 0) {
    modal({ icon: '✅', title: '预约成功', text: '请完成模拟支付，师傅将按预约时间上门', btn: '立即支付', onOk: () => go('pay.html?id=' + orderId) });
  } else {
    toast(r.msg);
  }
};

loadOrder();
loadWorkers();
