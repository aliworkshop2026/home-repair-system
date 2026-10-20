/* =========================================================
   模拟支付页（不接入真实支付接口）
   点击“立即支付” -> 调用后端接口直接将订单置为已支付
   ========================================================= */
const orderId = qs('id');
let payMethod = 'wechat';
let order = null;
let baseAmount = 0;        // 抵扣前金额
let coupons = [];          // 可用优惠券
let couponId = 0;          // 当前选中的券（0 = 不用券）

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
  baseAmount = order.price > 0 ? order.price : 30;
  document.getElementById('payTitle').textContent = (order.service_name || '检修') + ' 服务费';
  document.getElementById('payNo').textContent = order.order_no;
  document.getElementById('paySrv').textContent = order.service_name || '自助报修';
  document.getElementById('payWorker').textContent = order.worker ? order.worker.name : '-';
  document.getElementById('payTime').textContent = order.appoint_time || '-';
  refreshRadio();
  await loadCoupons();
}

/** 加载可用优惠券，并默认选中最优（抵扣最大）的一张 */
async function loadCoupons() {
  const r = await api('/api/coupons');
  const all = r.data || [];
  coupons = all.filter(c => c.status === 0 && baseAmount >= c.min_amount);
  const sel = document.getElementById('couponSel');
  if (!coupons.length) {
    couponId = 0;
    sel.textContent = '暂无可用券';
    refreshAmount();
    return;
  }
  // 默认选抵扣金额最大的
  couponId = coupons.slice().sort((a, b) => b.amount - a.amount)[0].id;
  refreshCouponSel();
  refreshAmount();
}

/** 当前券的抵扣额 */
function discount() {
  const c = coupons.find(x => x.id === couponId);
  return c ? Math.min(c.amount, Math.max(0, baseAmount - 1)) : 0;
}

/** 刷新支付金额显示（带抵扣明细） */
function refreshAmount() {
  const d = discount();
  document.getElementById('payAmount').textContent = Number(baseAmount - d).toFixed(2);
  const titleEl = document.getElementById('payTitle');
  const base = (order.service_name || '检修') + ' 服务费';
  titleEl.innerHTML = d > 0
    ? `${base} <span style="color:var(--red);font-size:12px">（已优惠 ¥${d}，原价 ¥${baseAmount.toFixed(2)}）</span>`
    : base;
}

/** 刷新券选择行文案 */
function refreshCouponSel() {
  const sel = document.getElementById('couponSel');
  const c = coupons.find(x => x.id === couponId);
  sel.innerHTML = c
    ? `<span style="color:var(--red);font-weight:700">-${c.amount}元</span> ${c.title} ›`
    : `不使用优惠券 ›`;
}

/** 打开/关闭选券弹层 */
document.getElementById('couponRow').onclick = () => {
  if (!coupons.length) { toast('当前订单金额暂无可用的优惠券'); return; }
  const list = document.getElementById('couponSheetList');
  list.innerHTML = coupons.map(c => `
    <div class="cpk-item" data-id="${c.id}" style="display:flex;align-items:center;padding:12px;border:1px solid ${c.id === couponId ? 'var(--red)' : '#ebedf0'};border-radius:12px;margin-bottom:10px;cursor:pointer">
      <div style="width:86px;text-align:center;color:var(--red)">
        <div style="font-size:24px;font-weight:900">¥${c.amount}</div>
        <div style="font-size:11px;color:var(--text-3)">满${c.min_amount}可用</div>
      </div>
      <div style="flex:1;padding-left:12px">
        <div style="font-size:14.5px;font-weight:700">${c.title}</div>
        <div style="font-size:11.5px;color:var(--text-3);margin-top:3px">${c.expire_at ? '有效期至 ' + c.expire_at.slice(0, 10) : '长期有效'}</div>
      </div>
      <span style="font-size:18px;color:${c.id === couponId ? 'var(--red)' : '#d4d7dd'}">${c.id === couponId ? '●' : '○'}</span>
    </div>`).join('') + `
    <div class="cpk-item" data-id="0" style="text-align:center;padding:12px;border:1px dashed #d4d7dd;border-radius:12px;color:var(--text-2);cursor:pointer">不使用优惠券</div>`;
  list.querySelectorAll('.cpk-item').forEach(el => {
    el.onclick = () => {
      couponId = Number(el.dataset.id);
      refreshCouponSel();
      refreshAmount();
      hideCouponSheet();
    };
  });
  document.getElementById('couponMask').style.display = 'flex';
}
function hideCouponSheet() {
  document.getElementById('couponMask').style.display = 'none';
}

/** 点击支付：直接修改后端订单状态为已支付 */
document.getElementById('payBtn').onclick = async () => {
  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = '支付处理中...';
  // 模拟 1 秒支付过程
  setTimeout(async () => {
    const r = await api(`/api/orders/${orderId}/pay`, { method: 'POST', body: { coupon_id: couponId } });
    btn.disabled = false;
    btn.textContent = '立即支付';
    if (r.code === 0) {
      const d = r.data && r.data.discount ? r.data.discount : 0;
      const paid = r.data && r.data.pay_amount ? r.data.pay_amount : baseAmount;
      modal({
        icon: '🎉', title: '支付成功',
        text: d > 0
          ? `优惠券已抵扣 ¥${d}，实付 ¥${Number(paid).toFixed(2)}。维修师傅将按预约时间上门检修，请保持电话畅通`
          : '维修师傅将按预约时间上门检修，请保持电话畅通',
        btn: '查看我的订单',
        onOk: () => go('orders.html?tab=repair')
      });
    } else {
      toast(r.msg);
    }
  }, 900);
};

loadOrder();
