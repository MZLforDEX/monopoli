let activeTab = 'log';
const logMessages = [];
const chatMessages = [];

function switchChatTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.chat-tab:${tab === 'log' ? 'first' : 'last'}-child`).classList.add('active');
  renderMessages();
}

function addLogMessage(message) {
  logMessages.push({ type: 'log', text: message, time: new Date() });
  if (logMessages.length > 100) logMessages.shift();
  if (activeTab === 'log') renderMessages();
}

function addChatMessage(name, message) {
  chatMessages.push({ type: 'chat', name, text: message, time: new Date() });
  if (chatMessages.length > 100) chatMessages.shift();
  if (activeTab === 'chat') renderMessages();
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  const messages = activeTab === 'log' ? logMessages : chatMessages;
  container.innerHTML = messages.map(m => {
    if (m.type === 'log') {
      return `<div class="msg msg-log"><span class="msg-time">${m.time.toLocaleTimeString()}</span> ${m.text}</div>`;
    }
    return `<div class="msg msg-chat"><strong>${m.name}:</strong> ${m.text}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  socket.emit('chat-message', { message });
  input.value = '';
}

function sendEmoji(emoji) {
  socket.emit('chat-message', { message: emoji });
}
