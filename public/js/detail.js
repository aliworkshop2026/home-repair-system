/* =========================================================
   产品详情页：服务信息 / 三选项卡 / 立即预约
   ========================================================= */
const srvId = Number(qs('id'));
let service = null;

/* 标准化六步检修流程 */
const STEPS = [
  { t: '基础检测', d: '检测设备基础功能是否正常', p: '维修师傅上门基础检测家电，蓝色工装，真实摄影' },
  { t: '隐患检测', d: '检查设备是否存在故障隐患', p: '工程师用仪器检测家电故障隐患，真实摄影' },
  { t: '精准检修', d: '精准定位，检修故障', p: '维修师傅拆开家电主板精准检修，真实摄影' },
  { t: '现场清洁', d: '对维修现场进行打扫清洁', p: '师傅戴手套清洁擦拭维修现场，真实摄影' },
  { t: '试机运行', d: '检查是否能够正常开机使用', p: '维修后师傅与用户一起试机运行，真实摄影' },
  { t: '确认验收', d: '当面验收维修成果', p: '客户当面确认验收维修成果，握手，真实摄影' }
];

/* 温馨提示条款（对应截图） */
const TIPS = [
  '设备同性质且同部位故障保修90天；',
  '上门费：工程师到达现场后，若服务取消，将产生30元上门费用于补贴工程师上门成本；如果维修发生只收取服务费，不收取上门费。',
  '免责条款：动物破坏、电源问题、进液、人为因素、私自拆机、外观件、玻璃件以及其他不可抗因素等不在保修范围；',
  '下单后请保持手机通畅，工程师会迅速与您取得联系；',
  '如需更改上门时间，请提前一天联系客服或工程师；',
  '服务时段：9:00-20:00；',
  '请勿私下与工程师联系服务，如出现一切问题与平台无关；',
  '除本次服务费用外，平台严令禁止工程师私下收取额外费用，如有发生请拨打客服电话(023)63153464投诉。'
];

/* 底部动态滑动文字（李亚玲 / 亚亚亚亚亚） */
(function () {
  const track = document.getElementById('detailMq');
  if (!track) return;
  const seg = '李亚玲<span class="mq-dot">✦</span>亚亚亚亚亚<span class="mq-dot">✦</span>';
  track.innerHTML = seg.repeat(6);
})();

/** 生成收费标准三列表格（表头可折叠，价格按服务基价换算） */
function renderFeeTable() {
  const box = document.getElementById('feeTableBox');
  if (!box || !service) return;
  const p = Number(service.price) || 30;
  const money = n => Math.max(30, Math.round(n));
  const rows = [
    ['简单维修（线路/程序/信号等）', money(p * 1.0816)],
    ['更换外件（遥控器/高清线等）', money(p * 3.0408)],
    ['机型重新升级系统', money(p * 3.6633)],
    ['机型更换喇叭（更换音频部件）', money(p * 3.6633)],
    ['更换电源板', money(p * 5.7755)],
    ['更换核心显示屏/主机件', money(p * 51.3878)]
  ];
  const unit = service.unit && service.unit !== '起' ? service.unit : '/台';
  const typeSpan = rows.length; // 服务类型列合并行数
  box.innerHTML = `
  <div class="fee-table-block">
    <div class="fee-head" id="feeHead">
      <span>${service.name}（费用明细表）</span><span class="arr">︿</span>
    </div>
    <table class="fee-table" id="feeTable">
      <thead><tr><th>服务类型</th><th>服务项目</th><th>销售价</th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `
        <tr>
          ${i === 0 ? `<td class="fee-type" rowspan="${typeSpan}">${service.name}</td>` : ''}
          <td>${r[0]}</td>
          <td class="fee-price">¥ ${r[1]}${unit}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
  // 表头点击折叠/展开
  document.getElementById('feeHead').onclick = () => {
    const head = document.getElementById('feeHead');
    const table = document.getElementById('feeTable');
    head.classList.toggle('closed');
    table.classList.toggle('hidden');
  };
}

async function loadDetail() {
  const r = await api('/api/services/' + srvId);
  if (r.code !== 0) { toast(r.msg); return; }
  service = r.data;

  document.getElementById('heroImg').src = service.image;
  document.getElementById('srvName').textContent = service.name;
  document.getElementById('srvTags').innerHTML =
    `<span class="ck">✔ 适用于市面各种${service.name.replace(/维修|清洗/g, '')}</span>
     <span class="ck">✔ 透明报价 无隐形收费</span>
     <span class="ck">✔ 免费送30天保修卡</span>`;
  document.getElementById('skuName').textContent = service.name;
  document.getElementById('srvPrice').textContent = service.price;
  document.getElementById('srvUnit').textContent = service.unit;
  document.getElementById('srvOld').textContent = service.original_price ? '¥' + service.original_price : '';
  document.getElementById('srvSales').textContent = `已成交${service.sales}`;
  document.getElementById('srvDetail').innerHTML =
    `<b style="font-size:16px">📋 服务说明</b><p style="margin-top:8px;color:#555">${service.detail || '专业工程师上门检修，明码标价，先报价后维修。'}</p>`;
  document.title = service.name + ' - 产品详情';

  // 六步流程（复用统一生成图，保证风格一致）
  document.getElementById('stepGrid').innerHTML = STEPS.map((s, i) => `
    <div class="step-item">
      <div class="no">0${i + 1}</div>
      <b>${s.t}</b>
      <p>${s.d}</p>
    </div>`).join('');

  // 温馨提示
  document.getElementById('tipList').innerHTML = TIPS.map((t, i) => `<div class="tip-item">${i + 1}. ${t}</div>`).join('');

  // 收费标准表格
  renderFeeTable();

  renderReviews();
}

/** 评价面板 */
function renderReviews() {
  const box = document.getElementById('tab-review');
  const list = service.reviews || [];
  if (!list.length) {
    box.innerHTML = `<div class="empty"><span class="e-ico">📝</span>暂无用户评价，完成订单后快来抢沙发~</div>`;
    return;
  }
  box.innerHTML = `<div style="padding:4px 14px;color:var(--text-2)">共 ${service.review_count} 条评价</div>` +
    list.map(rv => `
    <div class="review-item">
      <div class="hd">
        <div class="avatar">${rv.avatar || '😀'}</div>
        <b>${rv.nickname || '用户'}</b>
        <span class="stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span>
      </div>
      <p>${rv.content}</p>
      <div class="time">${rv.created_at || ''}</div>
    </div>`).join('');
}

/* 选项卡切换 */
document.querySelectorAll('.detail-tabs a').forEach(a => {
  a.onclick = () => {
    document.querySelectorAll('.detail-tabs a').forEach(x => x.classList.remove('on'));
    a.classList.add('on');
    ['content', 'review', 'fee'].forEach(t => {
      document.getElementById('tab-' + t).style.display = t === a.dataset.tab ? '' : 'none';
    });
  };
});

/* 立即预约 -> 先校验登录 -> 报修表单 */
document.getElementById('bookBtn').onclick = async () => {
  const user = await currentUser();
  if (!user) { go('login.html?redirect=repair.html%3Fsid%3D' + srvId); return; }
  go('repair.html?sid=' + srvId);
};

loadDetail();
