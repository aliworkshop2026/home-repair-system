/* =========================================================
   在线咨询：实时对话模式（用户发送消息后客服再回复，不预加载历史聊天）
   ========================================================= */
const body = document.getElementById('chatBody');
const input = document.getElementById('chatInput');

// 客服头像：可爱的卡通包工头（文生图）
const CREW_AVATAR = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent('可爱卡通包工头头像，Q版圆润风格，戴黄色安全帽，穿蓝色工装背心，大眼睛开心微笑，扁平插画，淡紫色圆形背景，头像构图') +
  '&image_size=square';

/** 当前时间 HH:MM:SS */
function timeStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `今天 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 追加一条消息气泡 */
function appendMsg(role, content) {
  const row = document.createElement('div');
  row.className = 'msg-row' + (role === 'user' ? ' me' : '');
  row.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? '🙂' : `<img src="${CREW_AVATAR}" alt="包工头客服">`}</div>
    <div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = content;
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
}

/** 显示"对方正在输入"提示 */
function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row typing-row';
  row.innerHTML = `
    <div class="msg-avatar"><img src="${CREW_AVATAR}" alt="包工头客服"></div>
    <div class="bubble typing">对方正在输入<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></div>`;
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
  return row;
}

/** 页面初始化：仅检查登录态，不预加载任何聊天记录 */
async function init() {
  const user = await currentUser();
  if (!user) {
    // 未登录直接引导登录，不展示任何预设消息
    setTimeout(() => {
      modal({ icon: '🔑', title: '请先登录', text: '登录后即可在线咨询，客服实时为您解答', btn: '去登录', onOk: () => go('login.html?redirect=consult.html') });
    }, 300);
    return;
  }
  // 已登录：不预加载历史对话，页面留空等待用户主动发送消息
}

let sending = false; // 防止连发

/** 发送消息（实时对话：用户发送后智能客服按关键词回复 1~2 条） */
async function send() {
  if (sending) return;
  const content = input.value.trim();
  if (!content) return;
  sending = true;
  input.value = '';
  appendMsg('user', content);

  // 显示"对方正在输入"动画
  const typingEl = showTyping();

  const r = await api('/api/messages', { method: 'POST', body: { content } });
  // 移除"正在输入"提示
  typingEl.remove();

  if (r.code === 0) {
    // 逐条显示客服回复（模拟真实客服连发多条）
    const replies = (r.data.replies && r.data.replies.length ? r.data.replies : [r.data.reply]);
    for (let i = 0; i < replies.length; i++) {
      await sleep(600);
      appendMsg('admin', replies[i]);
      if (i < replies.length - 1) await sleep(300);
    }
    sending = false;
  } else if (r.code === 401) {
    sending = false;
    toast('请先登录');
    setTimeout(() => go('login.html?redirect=consult.html'), 800);
  } else {
    sending = false;
    toast(r.msg);
  }
}

/** 延时工具 */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

document.getElementById('sendBtn').onclick = send;
// 回车发送（输入法组词中的回车不触发，避免中文打字误发）
input.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' || e.keyCode === 13) {
    e.preventDefault();
    send();
  }
});

init();
