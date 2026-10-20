/**
 * 节假日工具：按当前日期自动识别节日窗口
 * --------------------------------------------------
 * - currentHoliday()  ：今天正处于某个节日展示窗口内时返回节日对象，否则 null
 * - upcomingHoliday() ：距离最近的下一个节日（含天数）
 * 节日窗口一般在节日前 2~3 天开启、节日结束当天关闭，
 * 新节日到来时旧节日自动下线，无需人工改代码。
 * 农历类节日（春节/端午/中秋）按年份查表，已预置 2025~2028。
 */
function img(prompt, size = 'landscape_16_9') {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

/* 农历节日日期表（窗口开始日:窗口结束日），按年查询 */
const LUNAR = {
  春节: { 2025: ['01-26', '02-04'], 2026: ['02-14', '02-23'], 2027: ['02-03', '02-12'], 2028: ['01-24', '02-02'] },
  端午: { 2025: ['05-29', '06-02'], 2026: ['06-17', '06-21'], 2027: ['06-07', '06-11'], 2028: ['05-26', '05-30'] },
  中秋: { 2025: ['10-04', '10-08'], 2026: ['09-23', '09-27'], 2027: ['09-13', '09-17'], 2028: ['10-01', '10-05'] }
};

/* 节日定义：展示窗口 + 轮播图 + 优惠券 + 促销文案 */
const DEFS = [
  {
    name: '元旦', fixed: ['12-30', '01-02'], crossYear: true,
    bannerTitle: '元旦焕新季', bannerSub: '家电检修迎新特惠 · 领10元新年券',
    bannerImg: img('元旦新年家电维修促销横幅，红色喜庆海报，灯笼烟花，维修工具箱，商业设计'),
    coupon: { title: '元旦专享券', amount: 10, min: 59 },
    promo: '元旦特惠：全场服务满59减10，优惠券已放入您的账户'
  },
  {
    name: '春节', lunar: true,
    bannerTitle: '春节服务不打烊', bannerSub: '工程师在岗守护 · 领20元团圆券',
    bannerImg: img('春节家电维修服务宣传海报，大红灯笼中国结，维修师傅拜年，喜庆红色商业横幅'),
    coupon: { title: '春节专享券', amount: 20, min: 99 },
    promo: '春节不打烊：满99减20团圆券已到账，紧急报修优先上门'
  },
  {
    name: '清明', fixed: ['04-03', '04-06'],
    bannerTitle: '清明踏青季', bannerSub: '出行前家电安检 · 领5元春日券',
    bannerImg: img('清明春日电维修服务海报，青山绿水淡色春天，简洁商业横幅'),
    coupon: { title: '清明专享券', amount: 5, min: 39 },
    promo: '清明小假：满39减5春日券已到账，出行前给家电做个安检'
  },
  {
    name: '劳动节', fixed: ['04-29', '05-05'],
    bannerTitle: '五一焕新周', bannerSub: '家电清洗立省 · 领15元劳动券',
    bannerImg: img('五一劳动节家电清洗促销横幅，明亮客厅，维修师傅，橙色商业海报'),
    coupon: { title: '劳动节专享券', amount: 15, min: 89 },
    promo: '五一焕新周：满89减15，空调油烟机清洗正当时'
  },
  {
    name: '端午', lunar: true,
    bannerTitle: '端午安康', bannerSub: '粽情一夏 · 领10元安康券',
    bannerImg: img('端午节家电维修服务海报，粽子龙舟元素，绿色清新商业横幅'),
    coupon: { title: '端午专享券', amount: 10, min: 59 },
    promo: '端午安康：满59减10安康券已到账，假期服务正常预约'
  },
  {
    name: '中秋', lunar: true,
    bannerTitle: '中秋团圆季', bannerSub: '家电体检迎团圆 · 领10元月圆券',
    bannerImg: img('中秋节家电维修服务海报，圆月玉兔桂花，暖色商业横幅'),
    coupon: { title: '中秋专享券', amount: 10, min: 59 },
    promo: '中秋团圆季：满59减10月圆券已到账，家电体检迎佳节'
  },
  {
    name: '国庆', fixed: ['09-29', '10-07'],
    bannerTitle: '国庆守护季', bannerSub: '假期服务不打烊 · 领18元国庆券',
    bannerImg: img('国庆节家电维修促销横幅，五星红旗红色喜庆，维修师傅，商业海报'),
    coupon: { title: '国庆专享券', amount: 18, min: 150 },
    promo: '国庆守护季：满150减18，假期工程师正常接单'
  },
  {
    name: '双11', fixed: ['11-09', '11-12'],
    bannerTitle: '双11狂欢季', bannerSub: '清洗维修全年低价 · 领30元狂欢券',
    bannerImg: img('双11购物狂欢节家电维修促销海报，红色爆炸贴折扣，商业横幅'),
    coupon: { title: '双11专享券', amount: 30, min: 199 },
    promo: '双11狂欢：满199减30大额券已到账，全年低价别错过'
  },
  {
    name: '双12', fixed: ['12-10', '12-13'],
    bannerTitle: '双12年终盛典', bannerSub: '年末家电大扫除 · 领20元年终券',
    bannerImg: img('双12年终促销家电清洗海报，雪花冬日暖色，商业横幅'),
    coupon: { title: '双12专享券', amount: 20, min: 99 },
    promo: '双12年终盛典：满99减20，年末给家电做个大扫除'
  }
];

const p = n => String(n).padStart(2, '0');
function fmt(d) { return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

/** 展开为具体日期窗口 [{...def, from:'YYYY-MM-DD', to:'YYYY-MM-DD'}]（覆盖前后三年） */
function windows() {
  const y0 = new Date().getFullYear();
  const list = [];
  for (const def of DEFS) {
    for (let y = y0 - 1; y <= y0 + 1; y++) {
      if (def.lunar) {
        const hit = LUNAR[def.name] && LUNAR[def.name][y];
        if (!hit) continue;
        list.push({ ...def, from: `${y}-${hit[0]}`, to: `${y}-${hit[1]}` });
      } else if (def.crossYear) {
        // 跨年窗口：12-30 开始、次年 01-02 结束
        list.push({ ...def, from: `${y}-12-30`, to: `${y + 1}-01-02` });
      } else {
        list.push({ ...def, from: `${y}-${def.fixed[0]}`, to: `${y}-${def.fixed[1]}` });
      }
    }
  }
  return list;
}

/** 今天正在进行的节日（无则 null） */
function currentHoliday() {
  const today = fmt(new Date());
  return windows().find(w => today >= w.from && today <= w.to) || null;
}

/** 距离最近的下一个节日 {name, from, days}（无则 null） */
function upcomingHoliday() {
  const today = fmt(new Date());
  const next = windows().filter(w => w.from > today).sort((a, b) => a.from < b.from ? -1 : 1)[0];
  if (!next) return null;
  const days = Math.round((new Date(next.from) - new Date(today)) / 86400000);
  return { name: next.name, from: next.from, days };
}

/** 非节日期的时令公告（按月轮换，保证公告全年不重复、实时贴合时间） */
function seasonTip() {
  const m = new Date().getMonth() + 1;
  const tips = {
    1: '寒冬用电高峰，电暖器、热水器安全检修可预约，防冻防漏更安心！',
    2: '节后返工季，洗衣机、油烟机深度清洗预约中，焕然一新迎新春！',
    3: '春季防潮正当时，墙面防霉、防水补漏免费上门勘测！',
    4: '空调启用前别忘了深度清洗，除菌除味，预约清洗享春日优惠！',
    5: '入夏空调使用高峰将至，加氟检修提前预约不排队！',
    6: '梅雨季注意防潮防漏电，电路安全检修、防水补漏随时预约！',
    7: '三伏天空调连轴转，不制冷、异响故障极速上门抢修！',
    8: '高温持续，冰箱冰柜负荷大，制冷异常别拖，师傅随叫随到！',
    9: '金秋换季，空调清洗保养正当时，油烟机拆洗焕新一口价！',
    10: '秋凉家装季，门窗五金、墙面刷新、灯具电路检修欢迎预约！',
    11: '入冬在即，热水器、电暖器安全检查安排上，温暖过冬！',
    12: '年末大扫除，油烟机、洗衣机、冰箱深度清洗套餐热约中！'
  };
  return tips[m];
}

/** 动态公告首条：节日中 > 临近节日预告 > 时令提示 */
function dynamicAnnouncement() {
  const h = currentHoliday();
  if (h) return `${h.name}期间服务不打烊，工程师正常接单；${h.coupon.title}（满${h.coupon.min}减${h.coupon.amount}）已发放至「我的-优惠券」，欢迎预约！`;
  const up = upcomingHoliday();
  if (up && up.days <= 20) return `距离${up.name}还有${up.days}天，节前家电检修清洗提前预约不排队！`;
  return seasonTip();
}

module.exports = { currentHoliday, upcomingHoliday, dynamicAnnouncement };
