import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Send, FileCode2, Sparkles, Loader2, Bot, User, GitBranch, Copy, Check, 
  ArrowLeft, Search, Layers, X, Download, Terminal, RefreshCw, FileText
} from "lucide-react";
import api from "../api/axios.js";
import { cn } from "../lib/utils.js";

const SUGGESTIONS = [
  "How does authentication & JWT work?",
  "Where are vector embeddings computed?",
  "Explain the project folder structure.",
  "What dependencies does this project use?",
];

function Avatar({ role }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 shadow-md",
        isUser
          ? "bg-panel2 border-line text-paper font-bold text-xs font-mono"
          : "bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border-accent/40 text-accent shadow-[0_0_20px_rgba(129,140,248,0.2)]"
      )}
    >
      {isUser ? <User className="w-4 h-4 text-ghost" /> : <Bot className="w-4.5 h-4.5 text-accent" />}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 rounded-full bg-accent" />
      <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 rounded-full bg-teal" />
      <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 rounded-full bg-amber" />
      <span className="text-xs font-mono text-ghost/70 ml-2">Searching vector chunks & synthesizing...</span>
    </div>
  );
}

const messageVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 28 },
  },
};

export default function ProjectChat() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [readme, setReadme] = useState(null);
  const [readmeBusy, setReadmeBusy] = useState(false);
  const [readmeError, setReadmeError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showFileSidebar, setShowFileSidebar] = useState(false);
  const [fileFilter, setFileFilter] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get(`/projects/${id}`).then((res) => setProject(res.data.project));
    api.get(`/chat/${id}/history`).then((res) => setMessages(res.data.messages || []));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking, readme]);

  async function submitQuestion(q) {
    if (!q.trim() || asking) return;
    setQuestion("");

    const userMsgId = `temp-${Date.now()}`;
    const assistantMsgId = `stream-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: q, _id: userMsgId },
      { role: "assistant", content: "", citedFiles: [], _id: assistantMsgId },
    ]);
    setAsking(true);

    try {
      const token = localStorage.getItem("codesense_token") || localStorage.getItem("token");
      let rawApiUrl = import.meta.env.VITE_API_URL || "";
      if (rawApiUrl && !rawApiUrl.startsWith("http://") && !rawApiUrl.startsWith("https://") && !rawApiUrl.startsWith("/")) {
        rawApiUrl = `https://${rawApiUrl}`;
      }
      const baseURL = rawApiUrl ? rawApiUrl.replace(/\/$/, "") : "";
      const response = await fetch(`${baseURL}/api/chat/${id}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "meta") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg._id === assistantMsgId ? { ...msg, citedFiles: data.citedFiles } : msg
                  )
                );
              } else if (data.type === "token") {
                accumulatedText += data.token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg._id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
                  )
                );
              }
            } catch (e) {
              // Partial chunk buffer skip
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantMsgId
            ? { ...msg, content: "Could not reach AI streaming backend. Please check connection." }
            : msg
        )
      );
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  }

  function handleAsk(e) {
    e.preventDefault();
    submitQuestion(question);
  }


  async function handleGenerateReadme() {
    setReadmeBusy(true);
    setReadmeError("");
    setReadme(null);
    try {
      const { data } = await api.post(`/chat/${id}/readme`);
      setReadme(data.readme);
    } catch (err) {
      setReadmeError(err.response?.data?.error || err.response?.data?.message || "Failed to generate README.");
    } finally {
      setReadmeBusy(false);
    }
  }

  function copyReadme() {
    navigator.clipboard.writeText(readme || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadReadme() {
    const blob = new Blob([readme || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name || "PROJECT"}_README.md`;
    a.click();
  }

  return (
    <div className="flex flex-col h-screen pt-16 bg-ink relative overflow-hidden selection:bg-accent/30 selection:text-white">
      {/* Dynamic Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-[130px] animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal/[0.03] rounded-full blur-[130px] animate-blob" style={{ animationDelay: "4s" }} />
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 flex flex-col h-full relative z-10">
        {/* ─── Top Header Bar ─── */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-3 flex items-center justify-between border-b border-line bg-ink/90 backdrop-blur-2xl sticky top-0 z-20"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="p-2 rounded-xl bg-panel2 border border-line text-ghost hover:text-paper hover:border-accent/40 transition flex items-center gap-1 text-xs font-mono shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Workspaces
            </Link>
            
            <div className="h-5 w-px bg-line shrink-0" />

            <div className="min-w-0">
              <h1 className="font-display font-bold text-base text-paper truncate flex items-center gap-2">
                {project?.name || <span className="animate-pulse bg-panel2 w-32 h-5 rounded block" />}
                <span className="text-[10px] font-mono font-normal text-teal bg-teal/10 border border-teal/20 px-2 py-0.5 rounded-full shrink-0">
                  READY
                </span>
              </h1>
              <p className="text-xs text-ghost/70 font-mono flex items-center gap-1.5 truncate">
                <GitBranch className="w-3 h-3 text-accent shrink-0" /> {project?.sourceRef || "Loading..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerateReadme}
              disabled={readmeBusy}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-accent via-indigo-500 to-accentHover text-white transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(129,140,248,0.25)]"
            >
              {readmeBusy ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Synthesizing README...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 text-amber" /> Auto-README</>
              )}
            </motion.button>
          </div>
        </motion.header>

        {/* ─── Messages Scroll Area ─── */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-hide">
          {/* Empty State */}
          {messages.length === 0 && !readme && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="py-12 flex flex-col items-center justify-center text-center h-full my-auto"
            >
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-accent/20 via-accent/10 to-teal/10 border border-accent/30 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(129,140,248,0.2)]">
                <Bot className="w-10 h-10 text-accent" />
              </div>
              <h2 className="text-2xl font-display font-bold text-paper mb-2">Query {project?.name || "Codebase"}</h2>
              <p className="text-ghost text-sm mb-8 max-w-md leading-relaxed">
                Ask any technical question. Answers are synthesized using Groq LLM with exact source file citations.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => submitQuestion(s)}
                    className="text-left text-xs font-medium text-paper bg-panel2/90 border border-line rounded-xl p-3.5 hover:border-accent/50 hover:bg-accent/5 transition-all shadow-sm flex items-center justify-between group"
                  >
                    <span>{s}</span>
                    <Sparkles className="w-3.5 h-3.5 text-ghost/40 group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                key={m._id}
                className={cn("flex gap-4 max-w-4xl", m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto")}
              >
                <Avatar role={m.role} />
                <div
                  className={cn(
                    "rounded-2xl p-5 shadow-lg transition-all duration-300 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-panel2 border border-line text-paper max-w-lg"
                      : "bg-panel2/90 backdrop-blur-xl border border-accent/20 text-paper/95 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex-1"
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap font-medium">{m.content}</p>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {m.citedFiles && m.citedFiles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-line/60">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-ghost/70 mb-2 font-bold flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-accent" /> Cited Source Files:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {m.citedFiles.map((f) => (
                          <span key={f} className="text-xs font-mono text-accent bg-accent/10 border border-accent/25 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                            {f.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          <AnimatePresence>
            {asking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex gap-4 max-w-3xl mr-auto"
              >
                <Avatar role="assistant" />
                <div className="rounded-2xl p-3 bg-panel2/90 border border-accent/20 shadow-md">
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} className="h-6" />
        </div>

        {/* ─── Bottom Floating Input Form ─── */}
        <div className="py-4 bg-ink/90 backdrop-blur-2xl">
          <form
            onSubmit={handleAsk}
            className="relative flex items-center bg-panel2/90 border border-line rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] focus-within:border-accent/60 transition-all duration-300"
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask anything about ${project?.name || "codebase"}...`}
              className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-paper placeholder:text-ghost/50 text-sm font-medium"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={asking || !question.trim()}
              className="p-3 rounded-xl bg-accent text-white font-bold hover:bg-accentHover transition-all disabled:opacity-40 disabled:bg-panel shadow-[0_0_15px_rgba(129,140,248,0.3)] shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </form>
          <p className="text-center text-[10px] font-mono text-ghost/50 mt-2">
            CodeSense AI · Powered by Groq Llama 3 & Local Vector Similarity
          </p>
        </div>
      </div>

      {/* ─── FULLSCREEN AUTO-README MODAL ─── */}
      <AnimatePresence>
        {readme && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-panel2 border border-accent/40 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-line flex items-center justify-between bg-ink/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-paper">Generated README.md</h3>
                    <p className="text-xs font-mono text-ghost/70">Synthesized for {project?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={copyReadme}
                    className="px-3.5 py-2 rounded-xl bg-panel border border-line text-ghost hover:text-paper transition text-xs font-mono flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Markdown"}
                  </button>
                  <button
                    onClick={downloadReadme}
                    className="px-3.5 py-2 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition text-xs font-mono flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download .md
                  </button>
                  <button
                    onClick={() => setReadme(null)}
                    className="p-2 rounded-xl hover:bg-white/10 text-ghost hover:text-paper transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body with Rendered Markdown */}
              <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-ink/40">
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {readme}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}