import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import SIENGE_HELPER_INSTRUCTIONS from "./agent-instructions.js";

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error(
    "ERRO: OPENAI_API_KEY não encontrada. Crie um arquivo .env baseado no .env.example."
  );
  process.exit(1);
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Servir frontend estático
app.use(express.static("public"));

// JSON body
app.use(express.json({ limit: "1mb" }));

// Healthcheck
app.get("/api/health", (req, res) => res.json({ ok: true }));

/**
 * POST /api/chat
 * body: { message: string, history?: Array<{role:'user'|'assistant', content:string}> }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Campo 'message' é obrigatório (string)." });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-20)
      : [];

    const input = [
      {
        role: "system",
        content: SIENGE_HELPER_INSTRUCTIONS
      },
      ...safeHistory,
      { role: "user", content: message }
    ];

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input
    });

    const text = response.output_text ?? "";

    res.json({ text });
  } catch (err) {
    console.error("Erro /api/chat:", err?.message || err);
    res.status(500).json({ error: "Erro no servidor." });
  }
});

const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`✅ Rodando em http://${HOST}:${PORT}`);
});