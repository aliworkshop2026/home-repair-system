/**
 * 数据库模块（SQLite）
 * --------------------------------------------------
 * 使用 Node.js 24 内置的 node:sqlite 数据库引擎，
 * 无需安装任何第三方数据库软件、无需手动导入 SQL。
 * 服务启动时自动：建表 -> 写入初始种子数据。
 * 数据库文件持久化保存在项目 data/repair.db 中。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// 数据库文件存放目录：
// - 本地运行：项目内 data 文件夹，数据持久保存
// - 云端部署：通过环境变量 DATA_DIR 指向挂载的持久化硬盘（如 Railway 的 /data）
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 整个进程持有同一个数据库连接单例（避免句柄关闭导致 SQLITE_MISUSE）
const db = new DatabaseSync(path.join(dataDir, 'repair.db'));
db.exec('PRAGMA foreign_keys = ON;');

/** 简单的密码加密（SHA-256 + 盐），毕设演示场景使用 */
function hashPassword(pwd) {
  return crypto.createHash('sha256').update('zmn_salt_2026_' + pwd).digest('hex');
}

/** 生成当前时间字符串 YYYY-MM-DD HH:mm:ss */
function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 统一的配图生成地址（所有网络图片均走内置文生图接口）
 * @param {string} prompt 图片描述
 * @param {string} size 尺寸
 */
function img(prompt, size = 'square') {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

/** 初始化数据库：建表 + 种子数据（仅在空库时执行） */
function initDatabase() {
  // ======================== 1. 建表 ========================
  db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,           -- 登录账号
    password TEXT NOT NULL,                  -- 加密后的密码
    nickname TEXT,                           -- 昵称
    phone TEXT,                              -- 手机号
    avatar TEXT DEFAULT '😊',                -- 头像（表情）
    gender TEXT,                             -- 性别（男/女/保密）
    birthday TEXT,                           -- 生日 YYYY-MM-DD
    status INTEGER DEFAULT 1,                -- 1正常 0禁用
    created_at TEXT
  );
  `);

  // 兼容旧数据库：users 表缺 gender/birthday 列时自动补列（否则保存性别/生日会报"响应失败"）
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userCols.includes('gender')) db.exec('ALTER TABLE users ADD COLUMN gender TEXT');
  if (!userCols.includes('birthday')) db.exec('ALTER TABLE users ADD COLUMN birthday TEXT');

  db.exec(`

  -- 管理员表
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT
  );

  -- 登录会话表（简单 token 机制）
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,                      -- user / admin
    user_id INTEGER NOT NULL,
    created_at TEXT
  );

  -- 服务分类表（两级：parent_id=0 为一级分类）
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '🔧',
    parent_id INTEGER DEFAULT 0,
    sort INTEGER DEFAULT 0
  );

  -- 检修服务项目表
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cat_id INTEGER,                          -- 所属子分类
    name TEXT NOT NULL,                      -- 项目名称
    subtitle TEXT,                           -- 副标题（上门快修等）
    price REAL NOT NULL,                     -- 价格
    original_price REAL DEFAULT 0,           -- 划线原价
    unit TEXT DEFAULT '起',                  -- 价格单位：起 / /台 / /次
    badge TEXT,                              -- 角标：热修/速通/惠
    image TEXT,                              -- 展示图片
    sales INTEGER DEFAULT 0,                 -- 成交量
    detail TEXT,                             -- 服务说明
    hot INTEGER DEFAULT 0,                   -- 是否热门推荐
    sort INTEGER DEFAULT 0
  );

  -- 维修师傅表
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT DEFAULT '👨‍🔧',
    skill TEXT,                              -- 擅长技能
    years INTEGER DEFAULT 5,                 -- 从业年限
    rating REAL DEFAULT 5.0,                 -- 评分
    order_count INTEGER DEFAULT 0,           -- 累计接单
    status INTEGER DEFAULT 1,                -- 1在岗 0停用
    created_at TEXT
  );

  -- 订单（报修单）表
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,           -- 订单编号
    user_id INTEGER NOT NULL,
    service_id INTEGER,
    service_name TEXT,                       -- 服务名称快照
    service_image TEXT,
    price REAL DEFAULT 0,                    -- 订单金额
    device_name TEXT,                        -- 设备名称/型号
    fault_desc TEXT,                         -- 故障描述
    address TEXT,                            -- 上门地址
    expect_time TEXT,                        -- 报修时填写的期望上门时间
    worker_id INTEGER,                       -- 预约的维修师傅
    appoint_time TEXT,                       -- 确认的预约时间
    status INTEGER DEFAULT 0,                -- 0待预约 1待支付 2待检修 3已完成 4已取消
    pay_status INTEGER DEFAULT 0,            -- 0未支付 1已支付
    pay_time TEXT,
    remark TEXT,
    finish_time TEXT,
    created_at TEXT
  );

  -- 订单评价表
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    service_id INTEGER,
    worker_id INTEGER,
    rating INTEGER DEFAULT 5,                -- 星级 1-5
    content TEXT,
    created_at TEXT
  );

  -- 在线咨询（留言/聊天记录）表
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'user',                -- user 用户 / admin 客服
    content TEXT NOT NULL,
    created_at TEXT
  );

  -- 首页轮播图表
  CREATE TABLE IF NOT EXISTS banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    sub_title TEXT,
    image TEXT,
    sort INTEGER DEFAULT 0
  );

  -- 公告表
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    sort INTEGER DEFAULT 0,
    created_at TEXT
  );

  -- 用户地址表
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    city TEXT NOT NULL,               -- 所在城市
    address TEXT NOT NULL,            -- 具体地址
    detail TEXT,                      -- 楼号/门牌号
    contact TEXT NOT NULL,            -- 联系人
    phone TEXT NOT NULL,              -- 手机号码
    is_default INTEGER DEFAULT 0,     -- 是否默认地址
    created_at TEXT
  );
  `);

  // ======================== 2. 种子数据 ========================
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) { reseedServices(); return; } // 老库：只增量补充新增服务（见下方幂等种子函数）

  // ---- 管理员（admin / admin123）----
  db.prepare('INSERT INTO admins (username, password, created_at) VALUES (?,?,?)')
    .run('admin', hashPassword('admin123'), now());

  // ---- 演示用户（test123 / 123456）----
  const insUser = db.prepare('INSERT INTO users (username, password, nickname, phone, avatar, created_at) VALUES (?,?,?,?,?,?)');
  insUser.run('test123', hashPassword('123456'), '体验用户', '13800001234', '😀', now());
  insUser.run('zhangsan', hashPassword('123456'), '张三', '13900002222', '🧑', now());

  // ---- 服务分类 ----
  const insCat = db.prepare('INSERT INTO categories (name, icon, parent_id, sort) VALUES (?,?,?,?)');
  // 一级分类（全部服务左侧栏）
  const c1 = insCat.run('家电维修', '🧰', 0, 1).lastInsertRowid;
  const c2 = insCat.run('水电维修', '💡', 0, 2).lastInsertRowid;
  const c3 = insCat.run('家电清洗', '🧽', 0, 3).lastInsertRowid;
  const c4 = insCat.run('家具门窗', '🚪', 0, 4).lastInsertRowid;
  const c5 = insCat.run('上门安装', '🔩', 0, 5).lastInsertRowid;
  const c6 = insCat.run('管道疏通', '🚰', 0, 6).lastInsertRowid;
  const c7 = insCat.run('电脑办公', '💻', 0, 7).lastInsertRowid;
  const c8 = insCat.run('墙面/瓷砖', '🎨', 0, 8).lastInsertRowid;
  const c9 = insCat.run('防水补漏', '🛡️', 0, 9).lastInsertRowid;
  // 二级分类
  const c11 = insCat.run('常用家电', '❄️', c1, 1).lastInsertRowid;
  const c12 = insCat.run('厨房电器', '🍳', c1, 2).lastInsertRowid;
  const c13 = insCat.run('生活电器', '🔌', c1, 3).lastInsertRowid;
  const c14 = insCat.run('商用设备', '🏭', c1, 4).lastInsertRowid;
  const c41 = insCat.run('门窗五金', '🪟', c4, 1).lastInsertRowid;
  const c42 = insCat.run('桌椅床柜', '🛋️', c4, 2).lastInsertRowid;
  const c43 = insCat.run('家具翻新', '✨', c4, 3).lastInsertRowid;

  // ---- 检修服务项目（幂等种子：name 唯一索引 + INSERT OR IGNORE，老库重启也能自动补新服务）----
  function reseedServices() {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_srv_name ON services(name)');
    const insSrv = db.prepare(`INSERT OR IGNORE INTO services
      (cat_id, name, subtitle, price, original_price, unit, badge, image, sales, detail, hot, sort)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    // 分类ID统一按名称解析（新库/老库均适用）
    const cid = n => db.prepare('SELECT id FROM categories WHERE name=?').get(n).id;
    const c11 = cid('常用家电'), c12 = cid('厨房电器'), c13 = cid('生活电器'), c14 = cid('商用设备'),
          c41 = cid('门窗五金'), c42 = cid('桌椅床柜'), c43 = cid('家具翻新'), c2 = cid('水电维修'),
          c3 = cid('家电清洗'), c5 = cid('上门安装'), c6 = cid('管道疏通'), c7 = cid('电脑办公'),
          c8 = cid('墙面/瓷砖'), c9 = cid('防水补漏');
    const P_TV = img('维修师傅上门修理液晶电视机，蓝色工作服，真实摄影');
  const P_AC = img('维修师傅上门检修壁挂式空调，蓝色工作服，室内，真实摄影');
  const P_AC2 = img('维修师傅检修立式柜机空调，蓝色工装，真实摄影');
  const P_FRIDGE = img('维修师傅上门修理电冰箱，厨房场景，真实摄影');
  const P_WASH = img('维修师傅上门修理滚筒洗衣机，蓝色工装，真实摄影');
  const P_HOOD = img('师傅高温蒸汽清洗抽油烟机，厨房场景，真实摄影');
  const P_STOVE = img('维修师傅上门修理燃气灶，蓝色工作服，真实摄影');
  const P_HEATER = img('维修师傅检修燃气热水器，厨房，真实摄影');
  const P_PC = img('电脑工程师维修台式电脑主机，工作台，真实摄影');
  const P_LAPTOP = img('工程师维修笔记本电脑，办公桌，真实摄影');
  const P_DOOR = img('安装师傅修理铝合金推拉门，戴白手套，真实摄影');
  const P_WIN = img('师傅维修铝合金窗户，阳台，真实摄影');
  const P_PIPE = img('水电工维修厨房水管龙头，戴手套，真实摄影');
  const P_LAMP = img('电工维修家庭灯具电路，蓝色工装，真实摄影');
  const P_DRAIN = img('疏通厨房洗菜盆下水管道，真实摄影');
  const P_TOILET = img('师傅维修家用马桶，卫生间，真实摄影');
  const P_LEAK = img('房屋漏水检测，师傅使用专业仪器测漏，真实摄影');
  const P_WALL = img('刷墙工人用滚筒刷新室内墙面，蓝色工装，真实摄影');
  const P_CLEAN_AC = img('师傅深度清洗空调内机，蒸汽清洁，真实摄影');
  const P_CLEAN_WASH = img('师傅拆机清洗滚筒洗衣机内筒，真实摄影');
  const P_CLEAN_HOOD = img('油烟机拆机风轮深度清洗前后对比，真实摄影');
  const P_SOFA = img('师傅翻新保养布艺沙发，客厅，真实摄影');
  const P_CENTRAL = img('维修师傅检修家用中央空调出风口，真实摄影');
  const P_STOVE2 = img('维修师傅修理集成灶，厨房，真实摄影');
  const P_WIN_SCREEN = img('师傅定制安装纱窗，窗户，真实摄影');
  const P_SYSTEM = img('电脑技师安装操作系统，笔记本屏幕，真实摄影');
  const P_WATERLEAK = img('卫生间防水补漏施工，师傅涂刷防水涂料，真实摄影');
  const P_FLOOR_DRAIN = img('师傅疏通卫生间地漏，真实摄影');
  const P_TOILET_T = img('师傅疏通家用马桶管道，真实摄影');
  const P_FLOOR = img('师傅给空调加氟利昂制冷剂，外机，真实摄影');
  const P_HOOD_R = img('维修师傅检修抽油烟机故障，厨房，真实摄影');

  const services = [
    [c11, '挂机空调维修', '快速修复', 98, 0, '起', '', P_AC, 3200, '专业检测空调不制冷、不开机、异响等故障，透明报价。', 1, 1],
    [c11, '柜机空调维修', '上门快修', 98, 0, '起', '', P_AC2, 1500, '柜机空调各类故障检修，30天保修。', 0, 2],
    [c11, '空调加氟-小挂机', '专业加氟', 150, 188, '/台', '', P_FLOOR, 900, '标准压力加氟，解决空调不制冷问题。', 0, 3],
    [c11, '家用中央空调维修', '精准检修', 98, 0, '起', '', P_CENTRAL, 600, '多联机、风管机等家用中央空调查漏检修。', 0, 4],
    [c11, '电视维修', '上门快修', 98, 0, '起', '热', P_TV, 5000, '基础检测→隐患检测→精准检修→现场清洁→试机运行→确认验收，标准化六步维修。', 1, 5],
    [c11, '冰箱维修', '快速修复', 98, 0, '起', '', P_FRIDGE, 2600, '不制冷、不停机、漏水等故障上门检修。', 1, 6],
    [c11, '洗衣机维修', '上门快修', 98, 0, '起', '', P_WASH, 2100, '不脱水、不排水、异响等故障专业维修。', 0, 7],
    [c3, '滚筒洗衣机拆洗', '深度拆洗', 349, 599, '/台', '惠', P_CLEAN_WASH, 800, '拆机清洗内筒，高温除菌，可视化清洗报告。', 1, 8],
    [c3, '空调清洗任选3台', '高温蒸洗', 189, 319, '/次', '惠', P_CLEAN_AC, 1200, '140℃高温蒸洗，去污更除菌。', 1, 9],
    [c3, '油烟机拆机洗', '风轮拆洗', 169, 198, '/台', '惠', P_CLEAN_HOOD, 10000, '拆洗至风轮，洁净直达内部；140℃高温蒸洗。', 1, 10],
    [c3, '油烟机+燃气灶', '组合焕新', 175, 276, '/台', '', P_HOOD, 4300, '油烟机加燃气灶组合清洗，焕新一口价。', 1, 11],
    [c12, '燃气灶维修', '急速上门', 98, 0, '起', '热修', P_STOVE, 3400, '打不着火、漏气、火焰异常等故障检修。', 1, 12],
    [c12, '燃气热水器维修', '专业检修', 98, 0, '起', '', P_HEATER, 1800, '不点火、水温异常等故障快速修好。', 1, 13],
    [c12, '油烟机维修', '快速排障', 98, 0, '起', '', P_HOOD_R, 1600, '不吸烟、异响、不开机等故障维修。', 0, 14],
    [c12, '集成灶维修', '原厂工艺', 98, 0, '起', '', P_STOVE2, 700, '集成灶各类故障检修，免费送保修卡。', 0, 15],
    [c7, '台式电脑维修', '30元起', 30, 0, '起', '', P_PC, 900, '不开机、蓝屏、硬件故障检测维修。', 0, 16],
    [c7, '笔记本维修', '30元起', 30, 0, '起', '', P_LAPTOP, 1100, '笔记本清灰、换屏、主板维修。', 0, 17],
    [c7, '微软系统安装', '纯净安装', 119, 0, '/套', '', P_SYSTEM, 500, 'Windows 系统纯净安装，驱动调试。', 0, 18],
    [c41, '推拉门维修', '透明报价', 30, 0, '起', '', P_DOOR, 5967, '适用于市面各种推拉门，免费送30天保修卡。', 1, 19],
    [c41, '铝合金窗维修', '30元起', 30, 0, '起', '', P_WIN, 3200, '窗户漏风、滑轮损坏、密封更换。', 0, 20],
    [c41, '纱窗定制维修组装', '上门测量', 30, 0, '起', '', P_WIN_SCREEN, 1200, '金刚网纱窗定制、旧纱窗维修组装。', 0, 21],
    [c2, '水管龙头', '漏堵快修', 30, 0, '起', '', P_PIPE, 4200, '水管漏水、龙头损坏，快速更换维修。', 1, 22],
    [c2, '灯具电路维修', '持证电工', 30, 0, '起', '急', P_LAMP, 2800, '灯具不亮、线路跳闸、开关插座维修。', 0, 23],
    [c6, '洗菜盆疏通', '速通', 50, 0, '起', '速通', P_DRAIN, 3600, '厨房下水管堵塞快速疏通。', 0, 24],
    [c6, '马桶维修', '上门快修', 98, 0, '起', '', P_TOILET, 2400, '不上水、漏水、堵塞等故障维修。', 0, 25],
    [c6, '马桶疏通', '速通', 98, 0, '起', '速通', P_TOILET_T, 3100, '专业设备疏通马桶堵塞。', 0, 26],
    [c6, '地漏疏通', '30元起', 30, 0, '起', '', P_FLOOR_DRAIN, 1700, '卫生间地漏反味、堵塞疏通。', 0, 27],
    [c9, '精准测漏', '仪器定位', 30, 0, '起', '', P_LEAK, 900, '房屋漏水精准定位，免砸砖检测。', 0, 28],
    [c9, '卫生间防水补漏', '质保无忧', 30, 0, '起', '', P_WATERLEAK, 1300, '卫生间免砸砖防水补漏施工。', 0, 29],
    [c8, '墙面局部刷新修补', '旧墙翻新', 30, 0, '起', '', P_WALL, 2200, '墙面掉皮、发霉局部修补刷新。', 1, 30],
    [c43, '沙发翻新', '焕然一新', 98, 0, '起', '', P_SOFA, 500, '布艺/皮质沙发清洁翻新保养。', 0, 31],
    // ---- 扩充服务（2026新增，覆盖更多生活电器/安装/水电/清洗场景）----
    [c13, '电风扇维修', '快速修复', 30, 0, '起', '', P_AC2, 650, '风扇不转、异响、摇头失灵等故障检修。', 0, 32],
    [c13, '吸尘器维修', '上门快修', 30, 0, '起', '', P_CLEAN_HOOD, 420, '吸力下降、不开机、异响等故障维修。', 0, 33],
    [c13, '净水器安装维修', '专业安装', 98, 0, '起', '', P_PIPE, 380, '净水器安装、滤芯更换、漏水检修。', 0, 34],
    [c13, '空气净化器维修', '快速排障', 30, 0, '起', '', P_SYSTEM, 260, '净化效率下降、异味、指示灯异常检修。', 0, 35],
    [c13, '电暖器维修', '安全检修', 30, 0, '起', '', P_HEATER, 210, '不加热、倾倒保护失效等故障维修。', 0, 36],
    [c14, '商用冰柜维修', '急速上门', 98, 0, '起', '', P_FRIDGE, 330, '冷柜不制冷、结冰、漏水故障检修。', 0, 37],
    [c14, '饮水机维修', '快速修复', 30, 0, '起', '', P_CLEAN_AC, 290, '不出水、漏水、加热异常维修。', 0, 38],
    [c5, '挂机空调安装', '专业安装', 198, 268, '/台', '惠', P_AC, 760, '挂机空调标准化安装，含基础辅材。', 1, 39],
    [c5, '燃气热水器安装', '规范安装', 158, 218, '/台', '', P_HEATER, 540, '燃热安装，安全检测，含基础辅材。', 0, 40],
    [c5, '洗衣机安装', '上门安装', 98, 0, '/台', '', P_WASH, 470, '滚筒/波轮洗衣机安装调平。', 0, 41],
    [c5, '灯具安装', '持证电工', 30, 0, '起', '', P_LAMP, 690, '吸顶灯、吊灯、射灯等专业安装。', 0, 42],
    [c5, '晾衣架安装', '坚固可靠', 98, 0, '/套', '', P_DOOR, 350, '手动/电动晾衣架安装维修。', 0, 43],
    [c5, '智能门锁安装', '安防升级', 158, 0, '/把', '', P_SYSTEM, 280, '指纹锁安装调试，教学使用。', 0, 44],
    [c42, '衣柜维修组装', '牢固规整', 98, 0, '起', '', P_SOFA, 310, '衣柜移门、铰链、组装维修。', 0, 45],
    [c42, '床铺安装维修', '稳固安心', 98, 0, '起', '', P_WALL, 260, '床架安装、异响处理、床板更换。', 0, 46],
    [c42, '桌椅维修', '结实耐用', 30, 0, '起', '', P_PC, 240, '桌椅松动、五金更换、加固维修。', 0, 47],
    [c2, '开关插座安装', '持证电工', 30, 0, '起', '', P_LAMP, 880, '开关插座安装更换，线路检修。', 0, 48],
    [c2, '电闸箱检修', '用电安全', 98, 0, '起', '', P_DOOR, 320, '配电箱跳闸、老化线路安全检修。', 0, 49],
    [c3, '冰箱深度清洗', '除菌除味', 299, 399, '/台', '惠', P_FRIDGE, 520, '内胆密封条深度清洁，除菌除味。', 1, 50],
    [c3, '床垫除螨', '高温除螨', 149, 268, '/床', '惠', P_CLEAN_WASH, 610, '高温除螨仪深度清洁床垫双面。', 1, 51],
    [c3, '中央空调清洗', '深度蒸洗', 289, 429, '/台', '惠', P_CLEAN_AC, 240, '风管机/多联机内机深度清洗。', 0, 52],
    [c6, '水管改装', '规范改管', 98, 0, '起', '', P_PIPE, 300, '冷热水管明暗管改装，打压测试。', 0, 53]
  ];
  for (const s of services) insSrv.run(...s);
  }
  reseedServices(); // 新库/老库统一走幂等种子

  // ---- 维修师傅 ----
  const insW = db.prepare(`INSERT INTO workers (name, phone, avatar, skill, years, rating, order_count, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  [
    ['王建国', '13600001111', '👨‍🔧', '空调 / 冰箱 / 洗衣机', 12, 4.9, 3280, 1],
    ['李志强', '13600002222', '🧑‍🔧', '电视 / 电脑 / 电路', 8, 4.8, 2150, 1],
    ['张师傅', '13600003333', '👷', '油烟机 / 燃气灶 / 热水器', 10, 4.9, 2960, 1],
    ['刘海洋', '13600004444', '👨‍🔧', '水管 / 马桶 / 疏通', 6, 4.7, 1840, 1],
    ['陈立军', '13600005555', '🧔', '门窗 / 家具 / 墙面', 15, 5.0, 4120, 1],
    ['赵小飞', '13600006666', '👷‍♂️', '家电清洗 / 防水补漏', 5, 4.8, 1320, 1]
  ].forEach(w => insW.run(...w, now()));

  // ---- 轮播图 ----
  const insBanner = db.prepare('INSERT INTO banners (title, sub_title, image, sort) VALUES (?,?,?,?)');
  insBanner.run('正规家庭维修 就找阿李工坊', '除了感情不修 啥都修',
    img('橙色温馨家电维修服务宣传海报，维修师傅工具箱，家庭场景，商业广告横幅', 'landscape_16_9'), 1);
  insBanner.run('金秋守护季', '节前检修·家电清洗立省250元',
    img('秋季家电维修清洗促销横幅，温馨客厅，蓝色工具箱，暖色调海报', 'landscape_16_9'), 2);
  insBanner.run('全民监督 阳光服务', '虚假维修平台先行赔付1000元',
    img('蓝色盾牌保障售后服务海报，家庭维修，简洁商业设计', 'landscape_16_9'), 3);

  // ---- 公告 ----
  const insAnno = db.prepare('INSERT INTO announcements (content, sort, created_at) VALUES (?,?,?)');
  [
    ['国庆假期服务不打烊，工程师正常接单，欢迎提前预约！', 1],
    ['平台全程监管，严禁工程师私下收取额外费用，投诉电话 023-63153464', 2],
    ['电视机同性质且同部位故障保修90天，下单后请保持手机畅通', 3]
  ].forEach(a => insAnno.run(a[0], a[1], now()));

  // ---- 示例评价 ----
  const tvId = db.prepare("SELECT id FROM services WHERE name='电视维修'").get().id;
  const hoodId = db.prepare("SELECT id FROM services WHERE name='油烟机拆机洗'").get().id;
  const insRev = db.prepare('INSERT INTO reviews (order_id, user_id, service_id, worker_id, rating, content, created_at) VALUES (?,?,?,?,?,?,?)');
  insRev.run(0, 2, tvId, 2, 5, '师傅按时到达，收费透明，工装装备专业，电视很快就修好了，态度很好！', now());
  insRev.run(0, 1, hoodId, 6, 5, '清洗得非常干净，风轮拆下来洗的，还出了清洗报告，满意。', now());
  insRev.run(0, 2, tvId, 2, 4, '整体不错，就是预约时间稍微等了一会儿，技术没问题。', now());

  console.log('✅ 数据库初始化完成（数据表 + 演示数据已就绪）');
}

module.exports = { db, initDatabase, hashPassword, now };
