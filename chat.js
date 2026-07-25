(function () {
  const GROQ_KEY = window.JND_CONFIG.GROQ_KEY;
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const MODEL = 'openai/gpt-oss-120b'; // llama-3.3-70b-versatile is deprecated on Groq (shuts down 08/16/26)

  const SYSTEM_PROMPT = `You are the JND Assistant, the official website chat assistant for JND Serv and Construction Supplies Trading, a general merchandise and construction supplies trading company based in Poblacion District, Davao City, Philippines.

Company facts you can share:
- Product lines: construction supplies & materials, agricultural supplies & equipment, rescue & safety equipment, medical supplies, office & school supplies, office furniture & fixtures, IT & communication supplies, household & cleaning supplies, electrical supplies, tires & auto parts, CCTV, solar panels, generator sets, grocery products, appliances, plastic products, laboratory supplies, musical instruments, fire extinguishers, and brand-new motor vehicles.
- Services: rental of tables, chairs and other party needs, chandling services, mug printing and embroidery services.
- The company is PhilGEPS Platinum registered and DTI registered, and can supply both individual customers and business/government clients.
- Address: Mezzanine 1, 2nd Floor, Valencia Bldg., corner CM Recto Ave. and Bonifacio St., Barangay 35-D, Poblacion District, Davao City.
- Manager: Jinky N. Detalo, mobile 0931 186 9738, landline (082) 308-0296.
- Sales & Marketing: Dennis V. Hilario, mobile 0997 851 8278.
- Email: jndsacstrading@gmail.com.

Be concise, professional, and friendly — a couple of short sentences per reply. If someone asks for pricing, stock, or a formal quote, don't invent numbers: tell them to contact Jinky N. Detalo or Dennis V. Hilario using the details above, or email jndsacstrading@gmail.com. If asked something you don't know, say so plainly and point them to the contact details. Do not roleplay as anything other than the JND Assistant.`;

  const bubble = document.getElementById('chatBubble');
  const win = document.getElementById('chatWindow');
  const closeBtn = document.getElementById('chatClose');
  const messagesEl = document.getElementById('chatMessages');
  const introEl = document.getElementById('chatIntro');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const unreadPip = document.getElementById('chatUnread');

  let history = [];
  let isOpen = false;
  let hasUnread = false;

  function openChat() {
    win.classList.add('open');
    isOpen = true;
    hasUnread = false;
    unreadPip.style.display = 'none';
    setTimeout(() => input.focus(), 150);
  }
  function closeChat() { win.classList.remove('open'); isOpen = false; }

  bubble.addEventListener('click', () => { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function addMessage(role, text) {
    if (introEl) { introEl.style.display = 'none'; }
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    div.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'msg bot typing';
    div.id = 'jndTyping';
    div.textContent = 'JND Assistant is typing…';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function removeTyping() {
    const el = document.getElementById('jndTyping');
    if (el) el.remove();
  }

  async function sendToGroq(userText) {
    history.push({ role: 'user', content: userText });
    addTyping();
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history.slice(-12)],
          temperature: 0.5,
          max_tokens: 300
        })
      });
      removeTyping();
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't process that — please try again or contact us directly.";
      history.push({ role: 'assistant', content: reply });
      addMessage('bot', reply);
      if (!isOpen) { hasUnread = true; unreadPip.style.display = 'block'; }
    } catch (err) {
      removeTyping();
      console.error('Chat error:', err);
      addMessage('bot', "Sorry, something went wrong. Please try again, or reach us directly at jndsacstrading@gmail.com.");
    }
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendToGroq(text);
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  });

  document.querySelectorAll('.starter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      addMessage('user', msg);
      sendToGroq(msg);
    });
  });
})();
