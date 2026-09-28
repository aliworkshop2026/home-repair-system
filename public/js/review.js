/* =========================================================
   评价页面：星级 + 文字 -> 提交评价
   ========================================================= */
const orderId = qs('id');
let rating = 5;
const RATE_WORDS = ['', '非常差', '不满意', '一般', '满意', '非常满意'];

/** 渲染星级 */
function renderStars() {
  document.querySelectorAll('#rateStars span').forEach(s => {
    s.classList.toggle('on', Number(s.dataset.v) <= rating);
  });
  document.getElementById('rateText').textContent = RATE_WORDS[rating];
}
document.querySelectorAll('#rateStars span').forEach(s => {
  s.onclick = () => { rating = Number(s.dataset.v); renderStars(); };
});
renderStars();

/** 加载订单简要信息 */
async function loadOrder() {
  const user = await requireLogin();
  if (!user) return;
  const r = await api('/api/orders/' + orderId);
  if (r.code !== 0) { toast(r.msg); return; }
  const o = r.data;
  document.getElementById('orderBrief').innerHTML = `
    <b style="font-size:16px">${o.service_name}</b>
    <div style="color:var(--text-2);font-size:13px">维修师傅：${o.worker ? o.worker.name : '-'}</div>
    <div style="color:var(--text-2);font-size:13px">完成时间：${o.finish_time || ''}</div>`;
}

/** 提交评价 */
document.getElementById('submitReview').onclick = async () => {
  const content = document.getElementById('reviewText').value.trim();
  if (!content) return toast('写点评价内容吧~');
  const r = await api(`/api/orders/${orderId}/review`, {
    method: 'POST',
    body: { rating, content }
  });
  if (r.code === 0) {
    modal({ icon: '💖', title: '评价成功', text: '感谢您的反馈，祝您生活愉快！', btn: '返回订单', onOk: () => go('orders.html?tab=done') });
  } else {
    toast(r.msg);
  }
};

loadOrder();
