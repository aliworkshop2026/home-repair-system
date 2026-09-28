/* =========================================================
   独立搜索页：历史搜索（localStorage 持久化）+ 热门搜索
   首页搜索条与全部服务页搜索框统一跳转到本页
   ========================================================= */
const input = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const hisList = document.getElementById('hisList');

const HIS_KEY = 'alwSearchHistory';
const getHis = () => { try { return JSON.parse(localStorage.getItem(HIS_KEY)) || []; } catch { return []; } };
const setHis = arr => localStorage.setItem(HIS_KEY, JSON.stringify(arr.slice(0, 10)));

/** 执行搜索：记录历史并跳转全部服务页 */
function doSearch(kw) {
  kw = (kw || '').trim();
  if (!kw) { toast('请输入搜索内容'); return; }
  const his = getHis().filter(x => x !== kw);
  his.unshift(kw);
  setHis(his);
  go('services.html?kw=' + encodeURIComponent(kw));
}

/** 渲染历史搜索列表 */
function renderHis() {
  const his = getHis();
  if (!his.length) {
    hisList.innerHTML = '<div style="color:#9aa1ad;font-size:13px;padding:14px 2px">暂无搜索记录</div>';
    return;
  }
  hisList.innerHTML = his.map(k =>
    `<div class="his-item" data-k="${k}"><i>🔍</i>${k}</div>`).join('');
}

/* 热门搜索词（来自平台高频服务） */
const HOT_WORDS = ['挂机空调维修', '电视维修', '马桶疏通', '油烟机拆机洗', '滚筒洗衣机拆洗', '水管龙头', '冰箱维修', '燃气灶维修'];
document.getElementById('hotTags').innerHTML =
  HOT_WORDS.map((w, i) => `<span class="hot-tag ${i < 2 ? 'top' : ''}" data-k="${w}">${w}</span>`).join('');

/* 事件绑定 */
document.getElementById('searchGo').onclick = () => doSearch(input.value);
input.onkeydown = e => { if (e.key === 'Enter') doSearch(input.value); };
input.oninput = () => clearBtn.classList.toggle('show', !!input.value);
clearBtn.onclick = () => { input.value = ''; clearBtn.classList.remove('show'); input.focus(); };
document.getElementById('hisClear').onclick = () => { setHis([]); renderHis(); toast('已清空历史记录'); };
hisList.onclick = e => { const it = e.target.closest('.his-item'); if (it) doSearch(it.dataset.k); };
document.getElementById('hotTags').onclick = e => { const t = e.target.closest('.hot-tag'); if (t) doSearch(t.dataset.k); };

/* 初始化：预填关键词并聚焦 */
renderHis();
input.value = qs('kw') || '';
clearBtn.classList.toggle('show', !!input.value);
input.focus();
