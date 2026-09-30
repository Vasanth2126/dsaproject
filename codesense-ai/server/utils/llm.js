import axios from "axios";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Models confirmed available for Groq API
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
  "qwen-2.5-32b",
  "groq/compound-mini"
];

let extractor = null;
let extractorFailed = false;

/**
 * Lazy load HuggingFace Transformers.js for 100% local, free 384-dim neural embeddings
 */
async function getExtractor() {
  if (extractorFailed) return null;
  if (!extractor) {
    try {
      const { pipeline, env } = await import("@xenova/transformers");
      if (env) env.allowLocalModels = false;
      extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    } catch (err) {
      extractorFailed = true;
      console.log("[Embeddings] Using fast neural/hash fallback vectorizer.");
    }
  }
  return extractor;
}

export async function embedText(text) {
  try {
    const pipe = await getExtractor();
    if (pipe) {
      const output = await pipe(text, { pooling: "mean", normalize: true });
      return Array.from(output.data);
    }
  } catch (err) {
    console.error("[Embeddings] Model error, using fallback vectorizer:", err.message);
  }
  return fallbackEmbedding(text, 384);
}

function fallbackEmbedding(text, dims = 384) {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    vec[hash % dims] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * a[i];
    normB += b[i] * b[i];
    dot += a[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function cleanResponse(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/\*\*Reasoning\*\*[\s\S]*?\*\*Answer\*\*/i, "").trim();
  return text;
}

function buildPromptMessages(question, contextChunks) {
  const contextBlock = contextChunks
    .map((c, i) => `[Chunk ${i + 1} — ${c.filePath}]\n${c.content}`)
    .join("\n\n");

  const systemPrompt =
    "You are CodeSense AI, a software engineering assistant for professional developers. " +
    "Answer questions about a codebase using only the provided context chunks. " +
    "Be direct and concise — no restating the question, no summary paragraph at the end. " +
    "Cite a file path inline the first time you reference it. " +
    "If the context doesn't contain the answer, say so in one line instead of guessing.";

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: "Context from the repository:\n\n[Chunk 1 — utils/hash.js]\nfunction hashPassword(pw) {\n  return bcrypt.hash(pw, 10);\n}\n\nQuestion: How are passwords stored?",
    },
    {
      role: "assistant",
      content: "Passwords are hashed with bcrypt at a cost factor of 10 before storage (utils/hash.js). Nothing else in the given context touches password storage.",
    },
    {
      role: "user",
      content: `Context from the repository:\n\n${contextBlock}\n\nQuestion: ${question}`,
    },
  ];
}

export async function askAI({ question, contextChunks }) {
  if (!process.env.GROQ_API_KEY) {
    return (
      "GROQ_API_KEY is not set on the server. " +
      "Add it to server/.env to enable real answers. Here is what retrieval found:\n\n" +
      contextChunks.map((c) => `File: ${c.filePath}\n${c.content.slice(0, 200)}...`).join("\n\n")
    );
  }

  const messages = buildPromptMessages(question, contextChunks);

  let lastError;
  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(
        GROQ_URL,
        { model, max_tokens: 2048, messages },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "content-type": "application/json",
          },
        }
      );
      const raw = response.data?.choices?.[0]?.message?.content || "No answer was returned.";
      return cleanResponse(raw);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || "";
      console.error(`[LLM] ${model} failed: ${msg}`);
      lastError = new Error(msg);
    }
  }
  throw lastError;
}

/**
 * Stream real-time tokens over SSE (Server-Sent Events)
 */
export async function streamAI({ question, contextChunks, onToken, onComplete, onError }) {
  if (!process.env.GROQ_API_KEY) {
    const fallbackText = "GROQ_API_KEY is not configured on the server. Add GROQ_API_KEY to server/.env to enable real-time responses.";
    onToken(fallbackText);
    onComplete(fallbackText);
    return;
  }

  const messages = buildPromptMessages(question, contextChunks);

  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(
        GROQ_URL,
        { model, max_tokens: 2048, messages, stream: true },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "content-type": "application/json",
          },
          responseType: "stream",
        }
      );

      let fullAnswer = "";

      response.data.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter((line) => line.trim() !== "");
        for (const line of lines) {
          if (line.includes("[DONE]")) continue;
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.replace("data: ", ""));
              const token = parsed.choices?.[0]?.delta?.content || "";
              if (token) {
                fullAnswer += token;
                onToken(token);
              }
            } catch (e) {
              // Partial line parse error, safe to ignore
            }
          }
        }
      });

      response.data.on("end", () => {
        onComplete(cleanResponse(fullAnswer));
      });

      response.data.on("error", (err) => {
        onError(err);
      });

      return; // Stream started successfully
    } catch (err) {
      console.error(`[LLM Stream] Model ${model} failed:`, err.message);
    }
  }

  onError(new Error("All streaming models failed"));
}