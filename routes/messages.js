/**
 * 在线咨询（聊天）接口
 * --------------------------------------------------
 * 智能客服：
 * 1. 根据用户提问关键词自动匹配回答（每次回复 1~2 条）
 * 2. 指名师傅：用户要点某位师傅时，安排师傅联系用户、可上门服务
 *    - 说全名（王建国师傅）→ 直接确认安排
 *    - 说姓氏（张师傅 / 姓李的）→ 把该姓师傅全名发给用户确认
 *    - 同姓多位 → 列出候选让用户选；用户不清楚 → 推荐评分最高的师傅
 * 3. 带对话上下文：问过"是这位吗"后，下一轮根据用户"是/不是/第一个"继续处理
 */
const express = require('express');
const { db, now } = require('../db/database');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireUser);

/** 在岗师傅（完全以后台师傅管理的"在岗状态"为准，后台停用/启用实时生效） */
function getWorkers() {
  return db.prepare('SELECT * FROM workers WHERE status = 1 ORDER BY rating DESC').all();
}

/** 师傅简介文案 */
function workerDesc(w) {
  return `【${w.name}】师傅（擅长${w.skill}，从业${w.years}年，评分${w.rating}分）`;
}

/** 确认安排师傅的回复 */
function confirmAssign(w) {
  return `收到！马上为您安排${workerDesc(w)}与您电话联系，师傅可以上门服务，请保持手机畅通～`;
}

// ===================== 用户对话上下文（内存态） =====================
// uid -> { type: 'confirm_worker' 只等确认一位 / 'pick_worker' 多候选待选择, worker, candidates }
const userCtx = new Map();

const AFFIRM = ['是', '对', '好', '嗯', '要', '可以', '行', 'ok', 'yes', '没错', '就是', '确定', '安排'];
const DENY = ['不', '换', '别', '其他', '算了', '否', '另一个'];
const UNCLEAR = ['不知道', '不清楚', '随便', '都行', '都好', '无所谓', '不懂', '忘了', '记不得', '哪个都'];

/** 是/否/随便 判断 */
function readIntent(text) {
  const t = text.toLowerCase();
  const affirm = AFFIRM.some(k => t.includes(k));
  const deny = DENY.some(k => t.includes(k));
  const unclear = UNCLEAR.some(k => t.includes(k));
  return { affirm, deny, unclear };
}

/** 从候选里按名字/序号（第一个、1、②等）挑人 */
function pickFromCandidates(text, candidates) {
  const t = text.trim();
  // 直接说名字（或名字的一部分）
  const byName = candidates.find(w => t.includes(w.name) || (t.replace(/师傅|工/g, '').length >= 2 && w.name.includes(t.replace(/师傅|工/g, ''))));
  if (byName) return byName;
  // 序号：第1/第一个/1/一/②
  const m = t.match(/第?\s*([1-9一二三四五六七八九十])|([①②③④⑤])/);
  if (m) {
    const cn = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };
    const idx = (cn[m[1] || m[2]] || Number(m[1])) - 1;
    if (candidates[idx]) return candidates[idx];
  }
  return null;
}

/**
 * 上下文续聊：上一轮在等用户确认师傅时，解析本轮回复
 * 返回回复数组；返回 null 表示本条消息不属于上下文，继续走常规匹配
 */
function handleContext(text, uid) {
  const ctx = userCtx.get(uid);
  if (!ctx) return null;
  const { affirm, deny, unclear } = readIntent(text);

  if (ctx.type === 'confirm_worker') {
    if (affirm && !deny) { userCtx.delete(uid); return [confirmAssign(ctx.worker)]; }
    if (unclear) {
      // 实在不清楚 → 就定当前推荐的（评分最高的）
      userCtx.delete(uid);
      return [`没关系～那就为您安排评分最高的${workerDesc(ctx.worker)}上门啦！师傅马上与您电话联系，请保持手机畅通～`];
    }
    if (deny) {
      // 用户不要 → 换下一位推荐
      const workers = getWorkers();
      const next = workers.find(w => w.id !== ctx.worker.id);
      if (next) {
        userCtx.set(uid, { type: 'confirm_worker', worker: next });
        return [`好的～那为您推荐${workerDesc(next)}，这位可以吗？回复"是"马上安排。`];
      }
      userCtx.delete(uid);
      return ['目前师傅档期都比较满，您先留个电话和地址，稍后客服专员为您协调安排哦～'];
    }
    // 用户没接话茬（问了别的事）→ 清除状态走常规流程
    userCtx.delete(uid);
    return null;
  }

  if (ctx.type === 'pick_worker') {
    if (unclear) {
      // 实在不清楚 → 推荐候选中评分最高的
      userCtx.delete(uid);
      const top = ctx.candidates.slice().sort((a, b) => b.rating - a.rating)[0];
      userCtx.set(uid, { type: 'confirm_worker', worker: top });
      return [`没关系～那就为您安排评分最高的${workerDesc(top)}上门，可以吗？回复"是"立即安排。`];
    }
    const pick = pickFromCandidates(text, ctx.candidates);
    if (pick) { userCtx.delete(uid); return [confirmAssign(pick)]; }
    if (deny) {
      userCtx.delete(uid);
      return ['好的，那您再想想～也可以直接告诉我设备故障和地址，我帮您匹配最擅长的师傅。'];
    }
    return null;
  }
  return null;
}

/**
 * 指名师傅意图处理
 * 支持：王建国师傅 / 张师傅 / 姓李的师傅 / 帮我叫个师傅上门
 */
function handleWorkerIntent(text, uid) {
  const workers = getWorkers();
  if (!workers.length) return ['当前师傅都在忙线上单，稍后为您安排哦～'];

  // 泛指字：出现这些字说明用户没具体指名（如"叫个师傅""派位师傅来"）
  const GENERIC = '个位名找要叫请这那哪的来派帮点随便';
  // 提取指名信息
  let surname = null;
  const fullNameMatch = text.match(/([\u4e00-\u9fa5]{2,3})师傅/);   // "王建国师傅"
  const surnameMatch = text.match(/姓([\u4e00-\u9fa5])/);            // "姓李的师傅"
  const xMatch = text.match(/([\u4e00-\u9fa5])师傅/);                // "张师傅"

  // 1) 说的是真实全名（不含泛指字）→ 直接确认安排
  if (fullNameMatch && !fullNameMatch[1].split('').some(c => GENERIC.includes(c))) {
    const hit = workers.find(w => w.name === fullNameMatch[1]);
    if (hit) { userCtx.delete(uid); return [confirmAssign(hit)]; }
    surname = fullNameMatch[1][0]; // 全名没找到，按第一个字当姓氏继续找
  } else if (surnameMatch) {
    surname = surnameMatch[1];
  } else if (xMatch && !GENERIC.includes(xMatch[1])) {
    surname = xMatch[1];
  }

  // 2) 说了姓氏 → 查该姓师傅
  if (surname) {
    const cands = workers.filter(w => w.name.startsWith(surname));
    if (cands.length === 1) {
      // 单个：把全名发给用户确认
      userCtx.set(uid, { type: 'confirm_worker', worker: cands[0] });
      return [`我们${surname}姓的师傅是${workerDesc(cands[0])}，是您要找的吗？回复"是"就为您安排上门啦～`];
    }
    if (cands.length > 1) {
      // 多个：列出来仔细询问
      userCtx.set(uid, { type: 'pick_worker', candidates: cands });
      const list = cands.map((w, i) => `${'①②③④⑤'[i]}${w.name}（${w.skill}，${w.rating}分）`).join('  ');
      return [`我们姓${surname}的师傅有${cands.length}位：${list}。请问您想预约哪一位呀？回复编号或名字即可～`];
    }
    // 没有该姓 → 推荐评分最高的
    const top = workers[0];
    userCtx.set(uid, { type: 'confirm_worker', worker: top });
    return [`抱歉呀，暂时没有姓${surname}的师傅在线。为您推荐平台评分最高的${workerDesc(top)}，可以吗？`];
  }

  // 3) 泛指"叫个师傅"→ 直接推荐评分最高的
  const top = workers[0];
  userCtx.set(uid, { type: 'confirm_worker', worker: top });
  return ['好嘞！马上为您安排师傅上门～', `为您推荐评分最高的${workerDesc(top)}，师傅可以直接与您电话联系、上门服务。回复"是"立即安排！`];
}

/* =========================================================
   关键词规则库（按顺序匹配，命中即停止；每条规则返回消息数组）
   ========================================================= */
const RULES = [
  // ---- 问候 ----
  { kw: ['你好', '您好', 'hi', 'hello', '在吗', '在么'],
    replies: ['您好呀～我是阿李工坊的在线客服小李 🐴', '请问您家什么设备需要维修或清洗呢？告诉我品牌+故障现象，我马上为您安排师傅上门。'] },

  // ---- 价格 / 收费 ----
  { kw: ['多少钱', '价格', '收费', '费用', '贵不', '怎么算钱', '怎么收费', '价目'],
    replies: ['咱们平台明码标价、先报价后维修，师傅上门检测后出方案，您确认价格了才开工，绝不乱收费～',
              '同一故障：师傅上门检查 30 元起，简单维修（线路/程序/信号类）106 元/台起，大修 298 元起，具体以现场报价为准哦。'] },

  // ---- 空调 ----
  { kw: ['空调'],
    replies: ['空调问题交给我们就好啦！挂机/柜机/中央空调都能修：不制冷、漏水、噪音大、加氟、移机均可上门。',
              '参考价：挂机空调维修 98 元起、空调深度清洗 149 元起、中央空调清洗 289 元起，点击首页「空调清洗」可直接下单预约～'] },

  // ---- 洗衣机 ----
  { kw: ['洗衣机'],
    replies: ['洗衣机不脱水、漏水、异响、打不开门都可以修，波轮/滚筒/洗烘一体机都支持上门检测。',
              '洗衣机维修 88 元起，深度拆洗除垢 129 元起，预约后师傅会提前电话联系您～'] },

  // ---- 冰箱 / 冰柜 ----
  { kw: ['冰箱', '冰柜', '冷柜'],
    replies: ['冰箱不制冷、冷藏室结冰、噪音大、门封条老化都是常见问题，师傅带配件上门一次修好。',
              '冰箱维修 98 元起，家用/商用冰柜检修 158 元起，冰箱深度清洗 299 元起（高温杀菌除味）。'] },

  // ---- 热水器 / 厨电 ----
  { kw: ['热水器', '燃气灶', '油烟机', '灶'],
    replies: ['厨电我们都很在行：热水器不打火、水不热，燃气灶打不着火、松手熄火，油烟机吸力小、异响，都能上门处理。',
              '燃气热水器安装 158 元起，油烟机拆洗 119 元起，燃气灶维修 88 元起，安全第一，燃气类问题建议尽快报修哦。'] },

  // ---- 电视 ----
  { kw: ['电视', '显示器'],
    replies: ['电视黑屏、花屏、没声音、无法开机都可以检测维修，各品牌液晶电视均支持上门。',
              '电视简单维修 106 元/台起，大修 298 元起，师傅上门后先检测报价再维修。'] },

  // ---- 漏水 / 水管 ----
  { kw: ['漏水', '渗水', '水管', '水龙头', '阀门', '角阀', '爆管'],
    replies: ['漏水问题要抓紧处理，避免泡坏家具地板～水管爆裂、龙头滴水、接头渗水、暗管漏水都能修。',
              '水管维修 68 元起，上门后会先关阀止水再检修，紧急情况建议先关总阀，然后马上预约师傅。'] },

  // ---- 疏通 ----
  { kw: ['堵', '疏通', '马桶', '地漏', '下水道', '洗手盆', '洗菜盆'],
    replies: ['马桶堵塞、地漏返味、下水道慢排都可以疏通，师傅带专业疏通机和管道窥镜上门。',
              '马桶疏通 68 元起（含疏通一次），地漏/洗手盆疏通 58 元起，疏通无效不收费～'] },

  // ---- 电路 ----
  { kw: ['跳闸', '电路', '断电', '灯具', '灯', '插座', '开关', '短路'],
    replies: ['家里跳闸、插座没电、灯具不亮、开关失灵都可以处理，师傅持证上岗，用电安全放心交给我们。',
              '电路检修 78 元起，灯具/开关更换 58 元起（不含灯具材料），先检测后报价。'] },

  // ---- 安装 ----
  { kw: ['安装', '装一个', '挂架', '新买的'],
    replies: ['安装服务全能安排：空调、热水器、油烟机、灯具、窗帘、晾衣架、置物架、智能锁等都可以上门安装。',
              '挂机空调安装 198 元起，燃气热水器安装 158 元起，其他小件安装 49 元起，购买渠道不限都可安装。'] },

  // ---- 清洗 ----
  { kw: ['清洗', '保洁', '除螨', '消毒', '除垢'],
    replies: ['家电深度清洗可以预约：油烟机、洗衣机、空调、冰箱都能拆洗除垢杀菌，床垫除螨也支持上门。',
              '洗衣机拆洗 129 元起，空调清洗 149 元起，床垫除螨 149 元起，清洗后现场验收再确认。'] },

  // ---- 防水 ----
  { kw: ['防水', '补漏', '外墙', '屋顶', '卫生间渗'],
    replies: ['外墙、屋顶、卫生间、窗台渗水漏水都可以做防水补漏，高压注浆+涂膜双重工艺，质保安心。',
              '防水补漏 30 元起（按面积报价），满 1500 元减 150，施工前会出方案和明细报价单。'] },

  // ---- 预约流程 ----
  { kw: ['怎么预约', '如何预约', '怎么下单', '预约流程', '怎么报修', '如何报修', '下单流程', '怎么弄'],
    replies: ['预约超简单，三步搞定：① 首页选服务或直接「快速报修」填写设备故障和地址；② 选好师傅提交订单；③ 在线支付后师傅按时上门。',
              '也可以直接告诉我【设备+故障+地址+电话】，我帮您人工登记预约～'] },

  // ---- 上门时间 ----
  { kw: ['多久', '多长时间', '什么时候', '几点', '时间', '多快', '紧急', '加急'],
    replies: ['服务时间每天 9:00-20:00，城区内下单后最快 2 小时上门，预约时段可自选，师傅上门前 30 分钟会电话联系您。',
              '紧急故障（漏水/跳闸/燃气）可以备注「加急」，优先安排就近师傅。'] },

  // ---- 覆盖城市 ----
  { kw: ['城市', '地区', '能到', '覆盖', '我住在', '哪个区', '支持哪些'],
    replies: ['阿李工坊已覆盖全国 300+ 城市，您在首页左上角切换到所在城市，就能查看本地可预约的师傅啦。',
              '如果搜索不到您的城市，也可以留言告诉我，我们会尽快开通服务网点～'] },

  // ---- 师傅资质 ----
  { kw: ['专业吗', '靠谱', '水平', '技术', '评分', '评价'],
    replies: ['咱们师傅全部实名认证持证上岗，平均从业 8 年+，平台可查评分和用户评价，服务不满意支持重新安排。',
              '您也可以在「预约师傅」页面查看每位师傅的擅长领域、从业年限和评分，挑选心仪的工程师哦～'] },

  // ---- 保修 / 售后 ----
  { kw: ['保修', '质保', '保障', '售后', '又坏', '再坏', '复发'],
    replies: ['同性质同部位故障保修 90 天！保修期内再次出现问题，直接找我们免费返修，不用重复付费。',
              '维修后 7 天内如对效果不满意，也可以申请免费复检，售后有保障～'] },

  // ---- 支付 ----
  { kw: ['支付', '付款', '怎么给钱', '先付', '货到'],
    replies: ['支持在线支付（微信/支付宝），也可以师傅上门维修完成验收后再付款，全程平台担保更安全。',
              '温馨提示：付款前师傅会先出报价单，您确认价格后再支付，绝不预收不明费用～'] },

  // ---- 退款 / 取消 ----
  { kw: ['退款', '退钱', '取消', '退单', '改时间'],
    replies: ['师傅上门前都可以免费取消或改期，在「我的订单」里操作即可；已支付未服务的订单取消后原路退回。',
              '需要我帮您改约时间的话，把订单号和新的时间发我就行～'] },

  // ---- 联系方式 ----
  { kw: ['电话', '客服热线', '打给'],
    replies: ['客服热线：023-63153464（9:00-20:00），也可以直接在这里留言，我看到后马上回复您。',
              '紧急报修建议直接打电话，响应更快哦～'] },

  // ---- 感谢 ----
  { kw: ['谢谢', '感谢', '辛苦', 'thanks', '好的', '嗯嗯', 'ok'],
    replies: ['不客气哒～能帮到您就好 😊', '后续有任何维修保养问题随时来找我，祝生活愉快！'] }
];

// 未命中任何关键词时的兜底回复（轮换使用，避免千篇一律）
const FALLBACK = [
  ['收到～为了更快帮您解决问题，麻烦告诉我：① 什么设备/部位出问题 ② 具体故障现象 ③ 您的地址和联系电话，我马上为您安排师傅上门。',
   '也可以直接在首页挑选对应服务项目下单，明码标价更放心～'],
  ['好的，已为您记录！请补充一下【设备+故障情况+地址+联系电话】，客服马上为您安排工程师上门检测。',
   '咱们师傅上门后先检测报价，您确认价格后再维修，同部位故障保修 90 天哦～'],
  ['明白啦～稍等，我帮您看下对应的服务项目。您也可以先在首页「全部服务」里找找，或拨打客服热线 023-63153464 咨询。']
];

/** 根据用户提问内容匹配回复 */
function autoReply(content) {
  const text = content.toLowerCase();
  for (const rule of RULES) {
    if (rule.kw.some(k => text.includes(k))) return rule.replies;
  }
  return FALLBACK[fallbackIdx++ % FALLBACK.length];
}
let fallbackIdx = 0;

// ============ 我的聊天记录 ============
router.get('/', (req, res) => {
  const list = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY id ASC').all(req.user.id);
  res.json({ code: 0, data: list });
});

// ============ 发送一条消息（智能客服回复 1~2 条） ============
router.post('/', (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.json({ code: 1, msg: '消息内容不能为空' });

  const text = content.trim();
  const uid = req.user.id;
  db.prepare('INSERT INTO messages (user_id, role, content, created_at) VALUES (?,?,?,?)')
    .run(uid, 'user', text, now());

  // 1) 上下文续聊（等待用户确认/选择师傅中）优先
  let replies = handleContext(text, uid);
  // 2) 指名师傅意图（要点某位师傅 / 叫师傅上门）
  if (!replies && /师傅|上门服务|叫.*来|派.*来/.test(text)) replies = handleWorkerIntent(text, uid);
  // 3) 常规关键词匹配
  if (!replies) replies = autoReply(text);

  const ins = db.prepare('INSERT INTO messages (user_id, role, content, created_at) VALUES (?,?,?,?)');
  replies.forEach(r => ins.run(uid, 'admin', r, now()));

  res.json({ code: 0, msg: '发送成功', data: { reply: replies[0], replies } });
});

module.exports = router;
