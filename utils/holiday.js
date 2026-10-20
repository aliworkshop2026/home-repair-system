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
    name: '情人节', fixed: ['02-12', '02-15'],
    bannerTitle: '情人节安家季', bannerSub: '为爱守护小窝 · 领12元甜蜜券',
    bannerImg: img('情人节家电维修服务海报，粉色玫瑰爱心元素，温馨浪漫商业横幅'),
    coupon: { title: '情人节专享券', amount: 12, min: 66 },
    promo: '情人节甜蜜季：满66减12甜蜜券已到账，给TA一个舒心的家'
  },
  {
    name: '妇女节', fixed: ['03-06', '03-09'],
    bannerTitle: '三八女神节', bannerSub: '解放双手 · 领8元女神券',
    bannerImg: img('三八妇女节家电清洗促销海报，粉色康乃馨，明亮厨房，商业横幅'),
    coupon: { title: '女神节专享券', amount: 8, min: 49 },
    promo: '女神节快乐：满49减8女神券已到账，清洗维修解放双手'
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
    name: '母亲节', fixed: ['05-09', '05-14'],
    bannerTitle: '感恩母亲节', bannerSub: '替妈妈分担家务 · 领10元感恩券',
    bannerImg: img('母亲节家电清洗服务海报，康乃馨温馨粉色，干净厨房，商业横幅'),
    coupon: { title: '母亲节专享券', amount: 10, min: 59 },
    promo: '母亲节感恩季：满59减10感恩券已到账，替妈妈把家电清洗干净'
  },
  {
    name: '儿童节', fixed: ['05-31', '06-02'],
    bannerTitle: '六一童趣季', bannerSub: '家电安全护成长 · 领6元童心券',
    bannerImg: img('六一儿童节家电安全检查海报，彩色气球积木卡通元素，活泼商业横幅'),
    coupon: { title: '儿童节专享券', amount: 6, min: 39 },
    promo: '六一儿童节：满39减6童心券已到账，家电用电安全守护孩子成长'
  },
  {
    name: '父亲节', fixed: ['06-14', '06-21'],
    bannerTitle: '感恩父亲节', bannerSub: '家电检修不让爸爸操心 · 领10元孝心券',
    bannerImg: img('父亲节家电维修服务海报，蓝色领带工具箱元素，沉稳商业横幅'),
    coupon: { title: '父亲节专享券', amount: 10, min: 59 },
    promo: '父亲节快乐：满59减10孝心券已到账，家电检修交给专业师傅'
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
    name: '教师节', fixed: ['09-08', '09-11'],
    bannerTitle: '感恩教师节', bannerSub: '恩师家电我守护 · 领8元谢师券',
    bannerImg: img('教师节家电维修服务海报，黑板粉笔书本元素，暖色商业横幅'),
    coupon: { title: '教师节专享券', amount: 8, min: 49 },
    promo: '教师节感恩季：满49减8谢师券已到账，家电检修上门无忧'
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

/** 领券中心：按当天日期动态生成可领取的优惠券模板
 *  节日期间 = 节日三档券；平时 = 每日轮换券 + 常驻券；节前7天内追加预热券 */
function couponCenter() {
  const today = new Date();
  const todayStr = fmt(today);
  const exp3 = fmt(new Date(Date.now() + 3 * 86400000)) + ' 23:59:59';
  const exp7 = fmt(new Date(Date.now() + 7 * 86400000)) + ' 23:59:59';
  const list = [];

  // 1) 节日期间：主券 + 小额券 + 大额券（节日结束当天过期）
  const h = currentHoliday();
  if (h) {
    list.push({ key: 'holiday-main', tag: h.name + '限定', title: h.coupon.title, amount: h.coupon.amount, min: h.coupon.min, expire: h.to + ' 23:59:59' });
    list.push({ key: 'holiday-small', tag: h.name + '加量', title: h.name + '小额券', amount: Math.max(3, Math.round(h.coupon.amount / 3)), min: Math.max(29, Math.round(h.coupon.min / 3)), expire: h.to + ' 23:59:59' });
    list.push({ key: 'holiday-big', tag: h.name + '大额', title: h.name + '大额券', amount: h.coupon.amount * 2, min: h.coupon.min * 2, expire: h.to + ' 23:59:59' });
  } else {
    // 2) 节前 7 天内：预热券
    const up = upcomingHoliday();
    if (up && up.days <= 7) {
      list.push({ key: 'warmup', tag: up.name + '预热', title: up.name + '预热券', amount: 5, min: 39, expire: up.from + ' 23:59:59' });
    }
  }

  // 3) 每日轮换券：按星期几换主题（一周七天不重样，3天有效）
  const daily = [
    { tag: '周日特惠', title: '周日检修券', amount: 8, min: 69 },
    { tag: '周一清洗日', title: '周一清洗券', amount: 6, min: 49 },
    { tag: '周二维修日', title: '周二维修券', amount: 6, min: 49 },
    { tag: '周三疏通日', title: '周三疏通券', amount: 5, min: 39 },
    { tag: '周四安检日', title: '周四安检券', amount: 5, min: 39 },
    { tag: '周五焕新日', title: '周五焕新券', amount: 8, min: 69 },
    { tag: '周六省心日', title: '周六省心券', amount: 8, min: 69 }
  ][today.getDay()];
  list.push({ key: 'daily-' + today.getDay(), tag: daily.tag + '·每日轮换', title: daily.title, amount: daily.amount, min: daily.min, expire: exp3 });

  // 4) 常驻券：天天可领（7天有效）
  list.push({ key: 'base-59-5', tag: '日常福利', title: '天天领·满59减5', amount: 5, min: 59, expire: exp7 });
  list.push({ key: 'base-129-12', tag: '大额精选', title: '天天领·满129减12', amount: 12, min: 129, expire: exp7 });

  return list;
}

module.exports = { currentHoliday, upcomingHoliday, dynamicAnnouncement, couponCenter };
