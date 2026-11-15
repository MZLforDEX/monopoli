let activeTab = 'log';
const logMessages = [];
const chatMessages = [];
let unreadChatCount = 0;

function switchChatTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
  const targetBtn = document.getElementById(tab === 'log' ? 'tab-btn-log' : 'tab-btn-chat');
  if (targetBtn) targetBtn.classList.add('active');
  if (tab === 'chat') {
    unreadChatCount = 0;
    updateChatBadge();
  }
  renderMessages();
}

function updateChatBadge() {
  const badge = document.getElementById('chat-unread-badge');
  if (!badge) return;
  if (unreadChatCount > 0) {
    badge.textContent = unreadChatCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addLogMessage(message, timestamp = null) {
  const timeObj = timestamp ? new Date(timestamp) : new Date();
  logMessages.push({ type: 'log', text: message, time: timeObj });
  if (logMessages.length > 100) logMessages.shift();
  if (activeTab === 'log') renderMessages();
}

function addChatMessage(name, message) {
  chatMessages.push({ type: 'chat', name, text: message, time: new Date() });
  if (chatMessages.length > 100) chatMessages.shift();
  if (activeTab === 'chat') {
    renderMessages();
  } else {
    unreadChatCount++;
    updateChatBadge();
  }
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const messages = activeTab === 'log' ? logMessages : chatMessages;
  if (messages.length === 0) {
    container.innerHTML = `<div class="msg msg-log">${activeTab === 'log' ? 'Belum ada aktivitas permainan.' : 'Belum ada pesan obrolan.'}</div>`;
    return;
  }
  container.innerHTML = messages.map(m => {
    const timeStr = m.time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (m.type === 'log') {
      return `<div class="msg msg-log"><span class="msg-time mono-num">${timeStr}</span> ${escapeHtml(m.text)}</div>`;
    }
    return `<div class="msg msg-chat"><span class="msg-time mono-num">${timeStr}</span> <strong>${escapeHtml(m.name)}:</strong> ${escapeHtml(m.text)}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;
  socket.emit('chat-message', { message });
  input.value = '';
  switchChatTab('chat');
}

function sendEmoji(emoji) {
  socket.emit('chat-message', { message: emoji });
  switchChatTab('chat');
}

window.addEventListener('DOMContentLoaded', () => {
  renderMessages();
});
