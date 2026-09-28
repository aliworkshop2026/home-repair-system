/* =========================================================
   在线咨询：实时对话模式（用户发送消息后客服再回复，不预加载历史聊天）
   加号按钮智能切换：输入框空 → 弹快捷面板；有内容 → 变发送
   快捷面板：图片 / 转人工 / 评价
   ========================================================= */
const body = document.getElementById('chatBody');
const input = document.getElementById('chatInput');
const plusBtn = document.getElementById('plusBtn');
const chatActions = document.getElementById('chatActions');

// 客服头像：可爱的卡通包工头（文生图）
const CREW_AVATAR = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent('可爱卡通包工头头像，Q版圆润风格，戴黄色安全帽，穿蓝色工装背心，大眼睛开心微笑，扁平插画，淡紫色圆形背景，头像构图') +
  '&image_size=square';

/** 当前时间 HH:MM */
function timeStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `今天 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 追加一条消息气泡 */
function appendMsg(role, content, isImage = false) {
  const row = document.createElement('div');
  row.className = 'msg-row' + (role === 'user' ? ' me' : '');
  const avatar = role === 'user' ? '🙂' : `<img src="${CREW_AVATAR}" alt="包工头客服">`;
  if (isImage) {
    row.innerHTML = `
      <div class="msg-avatar">${avatar}</div>
      <div class="bubble" style="padding:4px;overflow:hidden"><img src="${content}" style="max-width:200px;border-radius:8px;display:block"></div>`;
  } else {
    row.innerHTML = `
      <div class="msg-avatar">${avatar}</div>
      <div class="bubble"></div>`;
    row.querySelector('.bubble').textContent = content;
  }
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
    setTimeout(() => {
      modal({ icon: '🔑', title: '请先登录', text: '登录后即可在线咨询，客服实时为您解答', btn: '去登录', onOk: () => go('login.html?redirect=consult.html') });
    }, 300);
    return;
  }
  // 已登录：不预加载历史对话，等待用户主动发送
}

let sending = false; // 防止连发

/** 发送消息（实时对话：用户发送后智能客服按关键词回复 1~2 条） */
async function send() {
  if (sending) return;
  const content = input.value.trim();
  if (!content) return;
  sending = true;
  input.value = '';
  updatePlusBtn();
  appendMsg('user', content);

  const typingEl = showTyping();

  const r = await api('/api/messages', { method: 'POST', body: { content } });
  typingEl.remove();

  if (r.code === 0) {
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

/* ============== 加号按钮智能切换：空→＋（弹出面板），有内容→发送 ============== */
function updatePlusBtn() {
  const hasContent = input.value.trim().length > 0;
  if (hasContent) {
    plusBtn.classList.add('is-send');
    plusBtn.textContent = '发送';
  } else {
    plusBtn.classList.remove('is-send');
    plusBtn.textContent = '＋';
  }
}

plusBtn.addEventListener('click', () => {
  const hasContent = input.value.trim().length > 0;
  if (hasContent) {
    send();
  } else {
    // 切换快捷面板
    const isShown = chatActions.style.display !== 'none';
    chatActions.style.display = isShown ? 'none' : 'flex';
  }
});

input.addEventListener('input', () => {
  updatePlusBtn();
  // 输入内容时自动收起快捷面板
  if (input.value.trim().length > 0) {
    chatActions.style.display = 'none';
  }
});

// 回车发送
input.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' || e.keyCode === 13) {
    e.preventDefault();
    send();
  }
});

/* ============== 快捷功能：图片 / 转人工 / 评价 ============== */

/** 图片：调用文件选择器 */
document.getElementById('actImg').addEventListener('click', () => {
  chatActions.style.display = 'none';
  document.getElementById('imgPicker').click();
});

document.getElementById('imgPicker').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // 本地预览（不实际上传，直接用 URL.createObjectURL 显示）
  const url = URL.createObjectURL(file);
  appendMsg('user', url, true);
  // 客服回复（提示用户图片已收到）
  setTimeout(() => {
    const typingEl = showTyping();
    setTimeout(async () => {
      typingEl.remove();
      appendMsg('admin', '📷 已收到您的图片，请问需要我们维修或清洗的家电是什么？请发送【地址+联系方式+维修产品】给您预约工程师上门服务。');
    }, 800);
  }, 500);
  // 清空 file input 让用户可以再次选择同一文件
  e.target.value = '';
});

/** 转人工：发送一条"转人工客服"消息，客服回复"已为您转接" */
document.getElementById('actHuman').addEventListener('click', async () => {
  chatActions.style.display = 'none';
  if (sending) return;
  sending = true;
  appendMsg('user', '🎧 转人工客服');
  const typingEl = showTyping();
  await sleep(800);
  typingEl.remove();
  appendMsg('admin', '您好，已为您转接人工客服。当前排队人数较少，工程师将在 1 分钟内与您对接，请稍候 ⏳');
  sending = false;
});

/** 评价：弹窗 5 星评价 */
document.getElementById('actRate').addEventListener('click', () => {
  chatActions.style.display = 'none';
  showRateModal();
});

function showRateModal() {
  const mask = document.createElement('div');
  mask.className = 'rate-mask';
  mask.innerHTML = `
    <div class="rate-box">
      <div class="rate-title">⭐ 服务评价</div>
      <div class="rate-sub">您对本次咨询服务满意吗？</div>
      <div class="rate-stars" id="rateStars">
        <span data-v="1">⭐</span>
        <span data-v="2">⭐</span>
        <span data-v="3">⭐</span>
        <span data-v="4">⭐</span>
        <span data-v="5">⭐</span>
      </div>
      <div class="rate-actions">
        <button class="cancel" id="rateCancel">取消</button>
        <button class="submit" id="rateSubmit">提交评价</button>
      </div>
    </div>`;
  document.body.appendChild(mask);

  const stars = mask.querySelectorAll('#rateStars span');
  let selected = 0;
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const v = parseInt(star.dataset.v);
      selected = v;
      stars.forEach((s, i) => s.classList.toggle('active', i < v));
    });
  });

  mask.querySelector('#rateCancel').addEventListener('click', () => mask.remove());
  mask.querySelector('#rateSubmit').addEventListener('click', () => {
    if (selected === 0) {
      toast('请先选择评分');
      return;
    }
    mask.remove();
    // 在聊天区显示评价消息
    appendMsg('user', `💬 我对本次服务给了 ${selected} 颗星 ${'⭐'.repeat(selected)}`);
    setTimeout(async () => {
      const typingEl = showTyping();
      await sleep(700);
      typingEl.remove();
      const reply = selected >= 4
        ? `感谢您的 ${selected} 星好评！您的满意是我们最大的动力 🌟\n如有需要随时联系我们，祝您生活愉快！`
        : `感谢您的反馈，我们会持续改进服务质量。客服主管将重点关注您的本次咨询，给您带来不好的体验我们深感歉意 🙏`;
      appendMsg('admin', reply);
    }, 300);
  });
}

init();
