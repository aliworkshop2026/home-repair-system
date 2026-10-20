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

/* ==================== 已有地址选择弹层 ==================== */
const addrMask = document.getElementById('addrMask');
const addrPickList = document.getElementById('addrPickList');

/** 打开地址选择弹层：加载当前用户在地址管理中保存的地址 */
async function openAddrPicker() {
  const user = await requireLogin();
  if (!user) return;
  const r = await api('/api/addresses');
  const list = r.data || [];
  if (!list.length) {
    addrPickList.innerHTML = `
      <div style="text-align:center;padding:34px 0;color:var(--text-3);font-size:13.5px">
        <div style="font-size:44px;margin-bottom:10px">📍</div>
        还没有保存过地址<br>点击下方"新增地址"先添加一个吧
      </div>`;
  } else {
    addrPickList.innerHTML = list.map(a => `
      <div class="addr-pick-item" data-id="${a.id}"
           data-full="${a.city}${a.address}${a.detail || ''}" data-phone="${a.phone}"
           style="padding:14px 4px;border-bottom:1px solid #f0f1f3;cursor:pointer">
        <div style="font-size:15px;font-weight:600">${a.contact}　<span style="color:var(--text-2);font-weight:400">${a.phone}</span>
          ${a.is_default ? '<span style="background:var(--blue);color:#fff;font-size:11px;border-radius:4px;padding:1px 6px;margin-left:6px;font-weight:400">默认</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text-2);margin-top:4px">${a.city} ${a.address} ${a.detail || ''}</div>
      </div>`).join('');
    addrPickList.querySelectorAll('.addr-pick-item').forEach(el => {
      el.onclick = () => {
        document.getElementById('address').value = el.dataset.full;
        const phoneIpt = document.getElementById('phone');
        if (phoneIpt && !phoneIpt.value) phoneIpt.value = el.dataset.phone; // 顺手带出联系电话
        addrMask.style.display = 'none';
        toast('已填入所选地址');
      };
    });
  }
  addrMask.style.display = 'flex';
}

document.getElementById('pickAddrBtn').onclick = openAddrPicker;
document.getElementById('addrMaskClose').onclick = () => addrMask.style.display = 'none';
addrMask.addEventListener('click', e => { if (e.target === addrMask) addrMask.style.display = 'none'; });
