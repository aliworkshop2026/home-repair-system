/* =========================================================
   报修页面：填写设备故障 / 地址 / 期望时间 -> 创建订单
   ========================================================= */
const sid = qs('sid') || '';
let service = null;

/** 生成默认时间（明天上午 10:00） */
function defaultTime() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(10, 0, 0, 0);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
document.getElementById('expectTime').value = defaultTime();

/** 回填所选服务信息 */
async function loadService() {
  if (!sid) return;
  const r = await api('/api/services/' + sid);
  if (r.code !== 0) return;
  service = r.data;
  document.getElementById('srvCard').style.display = '';
  document.getElementById('srvImg').src = service.image;
  document.getElementById('srvName').textContent = service.name;
  document.getElementById('srvPrice').textContent = service.price;
  document.getElementById('srvUnit').textContent = service.unit;
  document.getElementById('deviceName').value = service.name;
}

/** 提交报修 */
document.getElementById('submitBtn').onclick = async () => {
  const user = await requireLogin();
  if (!user) return;

  const device_name = document.getElementById('deviceName').value.trim();
  const fault_desc = document.getElementById('faultDesc').value.trim();
  const address = document.getElementById('address').value.trim();
  const expect_time = document.getElementById('expectTime').value.replace('T', ' ');

  if (!device_name) return toast('请填写设备名称');
  if (!fault_desc) return toast('请描述故障情况');
  if (!address) return toast('请填写上门地址');
  if (!expect_time) return toast('请选择期望上门时间');

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  const r = await api('/api/orders', {
    method: 'POST',
    body: { service_id: sid || null, device_name, fault_desc, address, expect_time }
  });
  btn.disabled = false;

  if (r.code === 0) {
    modal({
      icon: '🧾', title: '报修提交成功',
      text: `订单号：${r.data.order_no}\n请选择维修师傅并确认预约时间`,
      btn: '去预约师傅',
      onOk: () => go('booking.html?id=' + r.data.id)
    });
  } else {
    toast(r.msg);
  }
};

loadService();
requireLogin();
