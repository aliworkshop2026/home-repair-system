/* =========================================================
   全部服务页：左侧一级分类 + 右侧服务网格（左右联动）
   ========================================================= */
renderTabbar('service');

let categories = [];
let services = [];
let activeCat = Number(qs('cat')) || 0;   // 当前分类（0 = 全部）
let keyword = qs('kw') || '';             // 搜索关键词
let priceMin = Number(qs('min')) || 0;    // 专区：价格下限（如满150可用）
let priceMax = Number(qs('max')) || 0;    // 专区：价格上限（如消费凑单）
let tagTitle = qs('tag') || '';           // 专区标题

const sideEl = document.getElementById('svcSide');
const mainEl = document.getElementById('svcMain');
const kwInput = document.getElementById('kwInput');
kwInput.value = keyword;

/** 渲染左侧分类栏 */
function renderSide() {
  const all = [{ id: 0, name: '全部服务', icon: '✳️' }, ...categories];
  sideEl.innerHTML = all.map(c =>
    `<div class="side-item ${activeCat === c.id ? 'on' : ''}" data-id="${c.id}">
       <div style="font-size:20px">${c.icon || '🔧'}</div>${c.name}
     </div>`).join('');
  sideEl.querySelectorAll('.side-item').forEach(el => {
    el.onclick = () => {
      activeCat = Number(el.dataset.id);
      keyword = '';
      kwInput.value = '';
      priceMin = priceMax = 0; tagTitle = ''; // 离开专区/搜索模式
      history.replaceState(null, '', activeCat ? `?cat=${activeCat}` : location.pathname.split('/').pop());
      renderSide();
      renderMain();
    };
  });
}

/** 服务卡片 */
function cell(s) {
  return `<div class="svc-cell" onclick="go('detail.html?id=${s.id}')">
    <div class="c-img"><img src="${s.image}" alt="${s.name}" loading="lazy"></div>
    <div class="c-nm">${s.name}</div>
    <div class="c-pr">¥${s.price}${s.unit}</div>
  </div>`;
}

/** 渲染右侧内容：按子分类分组 */
function renderMain() {
  // 过滤
  let list = services.slice();
  if (activeCat) {
    const childIds = categories.find(c => c.id === activeCat)?.children.map(c => c.id) || [];
    list = list.filter(s => s.cat_id === activeCat || childIds.includes(s.cat_id));
  }
  if (keyword) list = list.filter(s => s.name.includes(keyword));
  if (priceMin) list = list.filter(s => s.price >= priceMin);
  if (priceMax) list = list.filter(s => s.price <= priceMax);

  if (!list.length) {
    mainEl.innerHTML = `<div class="empty"><span class="e-ico">🔍</span>没有找到相关服务，换个关键词试试</div>`;
    return;
  }

  // 搜索模式：平铺
  if (keyword) {
    mainEl.innerHTML = `<div class="svc-group-title">“${keyword}” 的搜索结果（${list.length}）</div>
      <div class="svc-grid">${list.map(cell).join('')}</div>`;
    return;
  }

  // 专区模式（红包入口：满150可用 / 消费凑单）：按价格升序平铺
  if (tagTitle || priceMin || priceMax) {
    list.sort((a, b) => a.price - b.price);
    const title = tagTitle || (priceMin ? `满${priceMin}元可用专区` : `${priceMax}元以下凑单专区`);
    mainEl.innerHTML = `<div class="svc-group-title">🎁 ${title}（${list.length}个）</div>
      <div class="svc-grid">${list.map(cell).join('')}</div>`;
    return;
  }

  // 分类模式：一级分类下按子分类分组
  const top = categories.find(c => c.id === activeCat);
  let html = '';
  if (top && top.children.length) {
    top.children.forEach(sub => {
      const arr = list.filter(s => s.cat_id === sub.id);
      if (!arr.length) return;
      html += `<div class="svc-group-title">${sub.name}</div>
        <div class="svc-grid">${arr.map(cell).join('')}</div>`;
    });
  } else {
    html += `<div class="svc-group-title">${top ? top.name : '全部服务'}</div>
      <div class="svc-grid">${list.map(cell).join('')}</div>`;
  }
  mainEl.innerHTML = html;
}

/** 搜索入口：统一跳转独立搜索页（首页搜索与全部服务搜索一致） */
function goSearchPage() {
  go('search.html' + (keyword ? '?kw=' + encodeURIComponent(keyword) : ''));
}
document.getElementById('searchBtn').onclick = goSearchPage;
kwInput.onclick = goSearchPage;
document.getElementById('svcSearch').onclick = e => {
  // 避免与按钮/输入框点击重复触发（它们本身已跳转）
  if (e.target.id === 'searchBtn' || e.target.id === 'kwInput') return;
  // 点击地址不跳转
  if (e.target.classList.contains('city') || e.target.closest('.city')) return;
  goSearchPage();
};

/* ---------------- 地区选择功能（与首页一致） ---------------- */
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
const svcCityNameEl = document.getElementById('svcCityName');
const svcCityModal = document.getElementById('cityModal');
const svcCityList = document.getElementById('cityList');
const svcCityTabs = document.getElementById('cityTabs');

function renderCityTabs() {
  svcCityTabs.innerHTML = Object.keys(CITY_ZONES).map(z =>
    `<button class="city-tab ${z === selectedZone ? 'on' : ''}" data-zone="${z}">${z}</button>`
  ).join('');
}
function renderCityList() {
  const cities = CITY_ZONES[selectedZone] || [];
  svcCityList.innerHTML = cities.map(c =>
    `<span class="city-item ${c === selectedCity ? 'on' : ''}" data-c="${c}">${c}</span>`
  ).join('');
}
renderCityTabs();
renderCityList();

// 点击城市名展开浮层
svcCityNameEl.onclick = (e) => {
  e.stopPropagation();
  svcCityModal.style.display = '';
};
// 关闭浮层
document.getElementById('cityClose').onclick = () => svcCityModal.style.display = 'none';
svcCityModal.addEventListener('click', (e) => { if (e.target === svcCityModal) svcCityModal.style.display = 'none'; });
// 切换区域 Tab
svcCityTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.city-tab');
  if (!tab) return;
  selectedZone = tab.dataset.zone;
  renderCityTabs();
  renderCityList();
});
// 选择城市
svcCityList.addEventListener('click', (e) => {
  const item = e.target.closest('.city-item');
  if (!item) return;
  selectedCity = item.dataset.c;
  svcCityNameEl.textContent = selectedCity + ' ▾';
  renderCityList();
  setTimeout(() => { svcCityModal.style.display = 'none'; toast('已切换至 ' + selectedCity); }, 300);
});

/** 初始化数据 */
(async function init() {
  const [cRes, sRes] = await Promise.all([
    api('/api/categories'),
    api('/api/services')
  ]);
  categories = cRes.data || [];
  services = sRes.data || [];
  // URL 带 cat 时确保分类存在
  if (activeCat && !categories.some(c => c.id === activeCat)) activeCat = 0;
  renderSide();
  renderMain();
})();
