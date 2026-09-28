/* =========================================================
   模拟支付页（不接入真实支付接口）
   点击“立即支付” -> 调用后端接口直接将订单置为已支付
   ========================================================= */
const orderId = qs('id');
let payMethod = 'wechat';
let order = null;

/** 单选样式（圆形勾选） */
function refreshRadio() {
  ['wechat', 'alipay'].forEach(m => {
    const el = document.getElementById('r-' + m);
    if (payMethod === m) {
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;border:2px solid var(--blue);position:relative';
      el.innerHTML = '<span style="position:absolute;inset:3px;border-radius:50%;background:var(--blue);display:block"></span>';
    } else {
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;border:2px solid #c8ccd4';
      el.innerHTML = '';
    }
  });
}

document.querySelectorAll('.pay-method').forEach(el => {
  el.onclick = () => { payMethod = el.dataset.pay; refreshRadio(); };
});

async function loadOrder() {
  const user = await requireLogin();
  if (!user) return;
  const r = await api('/api/orders/' + orderId);
  if (r.code !== 0) { toast(r.msg); return; }
  order = r.data;
  if (order.status !== 1) {
    toast('当前订单无需支付');
    setTimeout(() => go('orders.html?tab=repair'), 800);
    return;
  }
  // 自助报修订单无预估价时，显示 30 元上门检测费（演示）
  const amount = order.price > 0 ? order.price : 30;
  document.getElementById('payAmount').textContent = Number(amount).toFixed(2);
  document.getElementById('payTitle').textContent = (order.service_name || '检修') + ' 服务费';
  document.getElementById('payNo').textContent = order.order_no;
  document.getElementById('paySrv').textContent = order.service_name || '自助报修';
  document.getElementById('payWorker').textContent = order.worker ? order.worker.name : '-';
  document.getElementById('payTime').textContent = order.appoint_time || '-';
  refreshRadio();
}

/** 点击支付：直接修改后端订单状态为已支付 */
document.getElementById('payBtn').onclick = async () => {
  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = '支付处理中...';
  // 模拟 1 秒支付过程
  setTimeout(async () => {
    const r = await api(`/api/orders/${orderId}/pay`, { method: 'POST' });
    btn.disabled = false;
    btn.textContent = '立即支付';
    if (r.code === 0) {
      modal({
        icon: '🎉', title: '支付成功',
        text: '维修师傅将按预约时间上门检修，请保持电话畅通',
        btn: '查看我的订单',
        onOk: () => go('orders.html?tab=repair')
      });
    } else {
      toast(r.msg);
    }
  }, 900);
};

loadOrder();
