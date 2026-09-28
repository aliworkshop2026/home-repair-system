/* =========================================================
   首页脚本：开屏广告 / 分类宫格 / 轮播 / 公告 / 推荐 / 地区选择
   ========================================================= */
renderTabbar('home');

/* ---------------- 开屏广告（每次会话首次进入显示，4秒自动进入首页） ---------------- */
(function splashInit() {
  const sp = document.getElementById('splash');
  if (!sp) return;
  if (sessionStorage.getItem('alwSplashShown')) { sp.remove(); return; }
  sessionStorage.setItem('alwSplashShown', '1');
  let sec = 4;
  const secEl = document.getElementById('splashSec');
  const timer = setInterval(() => {
    sec--;
    if (secEl) secEl.textContent = sec;
    if (sec <= 0) closeSplash();
  }, 1000);
  function closeSplash() {
    clearInterval(timer);
    sp.classList.add('fade-out');
    setTimeout(() => { sp.remove(); showRedpack(); }, 350);
  }
  // 跳过按钮：立即关闭广告并显示红包
  document.getElementById('splashSkip').onclick = () => {
    clearInterval(timer);
    sp.classList.add('fade-out');
    setTimeout(() => { sp.remove(); showRedpack(); }, 350);
  };
})();

/* ---------------- 红包优惠券弹窗（开屏广告结束后立即弹出，会话内仅一次） ---------------- */
function showRedpack() {
  const mask = document.getElementById('redpackMask');
  if (!mask) return;
  if (sessionStorage.getItem('alwRedpackShown')) { mask.remove(); return; }
  sessionStorage.setItem('alwRedpackShown', '1');
  mask.style.display = 'flex';
  document.getElementById('rpClose').onclick = () => mask.remove();
}

/* ---------------- 底部动态滑动文字（李亚玲 / 亚亚亚亚亚） ---------------- */
(function marqueeInit() {
  const track = document.getElementById('homeMq');
  if (!track) return;
  const seg = '李亚玲<span class="mq-dot">✦</span>亚亚亚亚亚<span class="mq-dot">✦</span>';
  track.innerHTML = seg.repeat(6); // 复制两遍以上内容实现无缝循环
})();

/* ---------------- 地区选择功能（全国城市） ---------------- */
// 全国主要城市按区域分组
const CITY_ZONES = {
  '华北': ['北京市','天津市','石家庄市','太原市','呼和浩特市','保定市','邯郸市','唐山市','廊坊市','承德市','张家口市','沧州市','衡水市','邢台市'],
  '华东': ['上海市','南京市','杭州市','合肥市','福州市','南昌市','济南市','苏州市','无锡市','宁波市','温州市','青岛市','济南市','厦门市','泉州市','烟台市','威海市','临沂市','潍坊市'],
  '华南': ['广州市','深圳市','南宁市','海口市','三亚市','东莞市','佛山市','珠海市','中山市','惠州','汕头市','湛江市','桂林市','柳州市'],
  '华中': ['武汉市','长沙市','郑州市','南昌市','洛阳市','宜昌市','襄阳市','株洲市','湘潭市','衡阳市','岳阳市','信阳市','南阳市','开封市'],
  '东北': ['沈阳市','大连市','长春市','哈尔滨市','鞍山市','抚顺市','吉林市','大庆市','齐齐哈尔市','锦州市','营口市','丹东市'],
  '西南': ['重庆市','成都市','贵阳市','昆明市','拉萨市','绵阳市','德阳市','南充市','遵义市','曲靖市','大理市','泸州市','宜宾市'],
  '西北': ['西安市','兰州市','西宁市','银川市','乌鲁木齐市','宝鸡市','咸阳市','渭南市','汉中市','天水市','酒泉市','克拉玛依市']
};
let selectedCity = '北京市';
let selectedZone = '华北';
const cityNameEl = document.getElementById('cityName');
const cityModal = document.getElementById('cityModal');
const cityList = document.getElementById('cityList');
const cityTabs = document.getElementById('cityTabs');
const searchIpt = document.getElementById('searchIpt');

// 渲染区域 Tab
function renderCityTabs() {
  cityTabs.innerHTML = Object.keys(CITY_ZONES).map(z =>
    `<button class="city-tab ${z === selectedZone ? 'on' : ''}" data-zone="${z}">${z}</button>`
  ).join('');
}
// 渲染城市列表
function renderCityList() {
  const cities = CITY_ZONES[selectedZone] || [];
  cityList.innerHTML = cities.map(c =>
    `<span class="city-item ${c === selectedCity ? 'on' : ''}" data-c="${c}">${c}</span>`
  ).join('');
}
renderCityTabs();
renderCityList();

// 点击城市名展开浮层
cityNameEl.onclick = (e) => {
  e.stopPropagation();
  cityModal.style.display = '';
};
// 点击搜索框其余部分 -> 进入独立搜索页
document.getElementById('searchBar').addEventListener('click', (e) => {
  if (e.target.classList.contains('city') || e.target.closest('.city')) return;
  go('search.html');
});
// 关闭浮层
document.getElementById('cityClose').onclick = () => cityModal.style.display = 'none';
cityModal.addEventListener('click', (e) => { if (e.target === cityModal) cityModal.style.display = 'none'; });
// 切换区域 Tab
cityTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.city-tab');
  if (!tab) return;
  selectedZone = tab.dataset.zone;
  renderCityTabs();
  renderCityList();
});
// 选择城市
cityList.addEventListener('click', (e) => {
  const item = e.target.closest('.city-item');
  if (!item) return;
  selectedCity = item.dataset.c;
  cityNameEl.textContent = selectedCity + ' ▾';
  renderCityList();
  setTimeout(() => { cityModal.style.display = 'none'; toast('已切换至 ' + selectedCity); }, 300);
});

/* ---------------- 首页分类宫格（两页，对应截图） ---------------- */
const CAT_PAGES = [
  [ // 第一页
    { i: '🧰', n: '家电维修', c: 'tile-blue', cat: 1 },
    { i: '💧', n: '水电维修', c: 'tile-red', cat: 2 },
    { i: '🚰', n: '疏通排水', c: 'tile-orange', cat: 6 },
    { i: '🏠', n: '门窗家具', c: 'tile-blue', cat: 4 },
    { i: '🧴', n: '家电清洗', c: 'tile-cyan', cat: 3 },
    { i: '🌀', n: '洗衣机维修', c: 'tile-blue', kw: '洗衣机' },
    { i: '💡', n: '灯具电路', c: 'tile-red', kw: '灯具' },
    { i: '🚿', n: '洗菜盆疏通', c: 'tile-orange', kw: '洗菜盆' },
    { i: '🪟', n: '铝合金窗维修', c: 'tile-blue', kw: '铝合金窗' },
    { i: '🍳', n: '油烟机清洗', c: 'tile-cyan', kw: '油烟机拆机' },
    { i: '🔥', n: '燃气灶维修', c: 'tile-blue', kw: '燃气灶维修', badge: '热修' },
    { i: '🚽', n: '马桶维修', c: 'tile-red', kw: '马桶维修' },
    { i: '🚾', n: '马桶疏通', c: 'tile-orange', kw: '马桶疏通', badge: '速通' },
    { i: '🚪', n: '推拉门维修', c: 'tile-blue', kw: '推拉门' },
    { i: '✳️', n: '全部服务', c: 'tile-purple', all: true }
  ],
  [ // 第二页
    { i: '📺', n: '电视维修', c: 'tile-blue', kw: '电视' },
    { i: '🚿', n: '水管龙头', c: 'tile-red', kw: '水管' },
    { i: '🕳️', n: '地漏疏通', c: 'tile-orange', kw: '地漏' },
    { i: '🚪', n: '木门维修', c: 'tile-blue', kw: '推拉门' },
    { i: '🌀', n: '洗衣机清洗', c: 'tile-cyan', kw: '洗衣机拆洗' },
    { i: '🧊', n: '冰箱维修', c: 'tile-blue', kw: '冰箱' },
    { i: '🔫', n: '上门安装', c: 'tile-red', kw: '安装', badge: '省心' },
    { i: '💻', n: '电脑维修', c: 'tile-yellow', cat: 7 },
    { i: '🛋️', n: '沙发翻新', c: 'tile-cyan', kw: '沙发' },
    { i: '❄️', n: '空调清洗', c: 'tile-blue', kw: '空调清洗' },
    { i: '🌬️', n: '空调维修', c: 'tile-blue', kw: '空调' },
    { i: '🪑', n: '家居维修', c: 'tile-pink', cat: 4 },
    { i: '🏚️', n: '房屋修缮', c: 'tile-orange', cat: 8 },
    { i: '🛏️', n: '桌椅床柜', c: 'tile-purple', kw: '推拉门' },
    { i: '✳️', n: '全部服务', c: 'tile-purple', all: true }
  ]
];

const grid = document.getElementById('catGrid');
function renderCatPage(idx) {
  grid.innerHTML = '';
  CAT_PAGES[idx].forEach(item => {
    const el = document.createElement('div');
    el.className = 'cat-item';
    const q = item.all ? '' : (item.cat ? `cat=${item.cat}` : `kw=${encodeURIComponent(item.kw || '')}`);
    el.innerHTML = `
      <div class="cat-tile ${item.c}">
        ${item.badge ? `<span class="tag-badge">${item.badge}</span>` : ''}${item.i}
      </div>${item.n}`;
    el.onclick = () => location.href = 'services.html' + (q ? '?' + q : '');
    grid.appendChild(el);
  });
  document.querySelectorAll('#catDots i').forEach((d, i) => d.classList.toggle('on', i === idx));
}
renderCatPage(0);
let catIdx = 0;
setInterval(() => { catIdx = (catIdx + 1) % 2; renderCatPage(catIdx); }, 4000);

/* ---------------- 轮播广告图 ---------------- */
let banners = [];
async function loadBanners() {
  const r = await api('/api/banners');
  banners = r.data || [];
  const slides = document.getElementById('bannerSlides');
  const dots = document.getElementById('bannerDots');
  slides.innerHTML = banners.map(b => `
    <div class="slide">
      <img src="${b.image}" alt="${b.title}">
      <div class="cap"><b>${b.title}</b><br><span>${b.sub_title || ''}</span></div>
    </div>`).join('');
  dots.innerHTML = banners.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('');
  // 自动轮播
  let cur = 0;
  setInterval(() => {
    cur = (cur + 1) % banners.length;
    slides.style.transform = `translateX(-${cur * 100}%)`;
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === cur));
  }, 3500);
}
loadBanners();

/* ---------------- 公告滚动 ---------------- */
api('/api/announcements').then(r => {
  const text = (r.data || []).map(a => a.content).join('　　　');
  document.getElementById('noticeText').textContent = text;
});

/* ---------------- 推荐卡片（双列大图） ---------------- */
function recCard(s) {
  return `<div class="rec-card" onclick="go('detail.html?id=${s.id}')">
    <div class="info">
      <b>${s.name}</b>
      <p>${s.subtitle || '上门快修'}</p>
      <span>查看预约</span>
    </div>
    <img src="${s.image}" alt="${s.name}">
  </div>`;
}

/* 团购/热销商品小卡 */
function goodsCard(s) {
  const wave = s.original_price > s.price ? '焕新一口价' : '热销爆款';
  return `<div class="goods-card" onclick="go('detail.html?id=${s.id}')">
    <div class="pic">
      <img src="${s.image}" alt="${s.name}" loading="lazy">
      <div class="wave">${wave}</div>
    </div>
    <div class="info2">
      <div class="nm">${s.name}</div>
      <div class="price" style="margin-top:6px">
        <span class="yen">¥</span><span class="num" style="font-size:18px">${s.price}</span><span style="font-size:12px">${s.unit}</span>
        ${s.original_price ? `<span class="price-old">¥${s.original_price}</span>` : ''}
      </div>
    </div>
  </div>`;
}

async function loadServices() {
  const r = await api('/api/services');
  const list = r.data || [];
  // 推荐位：取 4 个带副标题的热门
  document.getElementById('recGrid').innerHTML = list.filter(s => s.hot).slice(0, 4).map(recCard).join('');
  // 团购：有划线价的项目（取满9个，保证三列排满不空位）
  document.getElementById('groupGrid').innerHTML = list.filter(s => s.original_price > 0).slice(0, 9).map(goodsCard).join('');
  // 更多热销：其余热门
  document.getElementById('hotGrid').innerHTML = list.filter(s => s.hot && !(s.original_price > 0)).slice(0, 9).map(goodsCard).join('');
}
loadServices();
