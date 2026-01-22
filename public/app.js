const chat = document.getElementById("chat");
const inp  = document.getElementById("inp");
const btn  = document.getElementById("btn");
const clearBtn = document.getElementById("clearBtn");

let history = [];

function nowHHMM() {
  const d = new Date();
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function autosizeTextarea() {
  inp.style.height = "auto";
  inp.style.height = Math.min(inp.scrollHeight, 200) + "px";
}
inp.addEventListener("input", autosizeTextarea);

function setBusy(busy) {
  btn.disabled = busy;
  inp.disabled = busy;
  clearBtn.disabled = busy;
}

function scrollToBottom(force = false) {
  const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 180;
  if (force || nearBottom) chat.scrollTop = chat.scrollHeight;
}

function normalizeAssistantText(text) {
  let t = (text || "").replace(/\r\n/g, "\n").trim();

  // 1) Se a resposta vier com seções em negrito, transforma em headings
  // Ex.: "**O que é / Para que serve**" vira "## O que é / Para que serve"
  t = t
    .split("\n")
    .map((line) => {
      const m = line.match(/^\s*\*\*(.+?)\*\*\s*$/);
      if (m) return `## ${m[1].trim()}`;
      return line;
    })
    .join("\n");

  // 2) Garante espaçamento entre headings e conteúdo (melhor render)
  t = t.replace(/(## .+)\n([^\n#-])/g, "$1\n\n$2");

  return t;
}

function renderMarkdownToHtml(mdText) {
  if (!window.marked) {
    // fallback: se marked não carregar, ao menos mostra texto
    const esc = (mdText || "").replace(/[&<>"']/g, (c) => (
      { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]
    ));
    return `<pre style="margin:0;white-space:pre-wrap">${esc}</pre>`;
  }

  // Quebra de linha amigável e markdown padrão
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(mdText || "");
}

function addMessage(role, text, { loading = false } = {}) {
  const msg = document.createElement("div");
  msg.className = "msg " + (role === "user" ? "me" : "bot");

  if (role !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "S";
    msg.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (loading) {
    bubble.innerHTML = `
      <span class="typing">
        <span class="dots"><span></span><span></span><span></span></span>
        <span style="color: rgba(255,255,255,.7); font-size: 13px;">Respondendo…</span>
      </span>
    `;
    bubble.dataset.loading = "1";
  } else {
    if (role === "assistant") {
      const normalized = normalizeAssistantText(text);
      bubble.innerHTML = `<div class="md">${renderMarkdownToHtml(normalized)}</div>`;
    } else {
      bubble.textContent = text;
    }
  }

  const wrap = document.createElement("div");
  wrap.appendChild(bubble);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = nowHHMM();
  wrap.appendChild(meta);

  msg.appendChild(wrap);
  chat.appendChild(msg);

  scrollToBottom();
  return { bubble };
}

clearBtn.addEventListener("click", () => {
  chat.innerHTML = "";
  history = [];
  addMessage("assistant", "Olá! Me diga qual rotina do Sienge você quer executar.");
  inp.value = "";
  autosizeTextarea();
  inp.focus();
});

async function send() {
  const message = inp.value.trim();
  if (!message) return;

  addMessage("user", message);
  history.push({ role: "user", content: message });

  inp.value = "";
  autosizeTextarea();
  setBusy(true);

  const loading = addMessage("assistant", "", { loading: true });

  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Falha na requisição.");

    const text = (data.text || "(sem resposta)").trim();

    loading.bubble.dataset.loading = "";
    const normalized = normalizeAssistantText(text);
    loading.bubble.innerHTML = `<div class="md">${renderMarkdownToHtml(normalized)}</div>`;

    history.push({ role: "assistant", content: text });
    scrollToBottom(true);
  } catch (e) {
    loading.bubble.textContent = "Erro: " + (e?.message || "não foi possível conectar no servidor.");
  } finally {
    setBusy(false);
    inp.focus();
  }
}

// Enter envia, Shift+Enter quebra linha
inp.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

btn.addEventListener("click", send);

addMessage(
  "assistant",
  "🎯 **Como posso ajudar?**\n\nDiga qual rotina do Sienge você quer executar e seu objetivo (ex.: cadastrar, aprovar, emitir)."
);
inp.focus();
autosizeTextarea();
