"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiChatApi, UserRole } from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import AiBadge from "./AiBadge";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  toolsCalled?: string[];
  fallbackUsed?: boolean;
  provider?: string;
  edited?: boolean;
  createdAt: number;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const QUICK_PROMPTS: Record<UserRole, string[]> = {
  admin: [
    "How many active employees are in Engineering?",
    "What is this month's attendance rate?",
    "Who came late most often this month?",
    "Show payroll summary for this month",
    "Is mahine kitne employees late aaye?",
  ],
  hr: [
    "How many active employees are in Engineering?",
    "Who is on leave today?",
    "Who came late most often this month?",
    "What is this month's attendance rate?",
    "Aaj kon leave par hai?",
  ],
  employee: [
    "How many sick leaves do I have left this year?",
    "Meri kitni casual chuttiyan baqi hain?",
    "What are the office hours and grace time rules?",
    "What are the annual income tax slabs?",
    "What is colleague Sara's salary?",
  ],
};

function createEmptyThread(): ChatThread {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function deriveTitleFromPrompt(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AiAssistantDrawer({
  open,
  onClose,
  role,
  userName,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  userName: string;
  userId?: string;
}) {
  const storageKey = useMemo(
    () => `hcm_ai_threads_v2_${userId || userName}_${role}`,
    [userId, userName, role]
  );

  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);
  const editCompositionEndAtRef = useRef<number | null>(null);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedStudio, setExpandedStudio] = useState(false);
  const [showPromptPills, setShowPromptPills] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Thread rename & clear states
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Message inline edit & copy states
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgDraft, setEditMsgDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load saved threads for this user on mount / user switch
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatThread[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(parsed[0].id);
          return;
        }
      }
    } catch {
      // Fallback to fresh thread
    }
    const fresh = createEmptyThread();
    setThreads([fresh]);
    setActiveThreadId(fresh.id);
  }, [storageKey]);

  const persistThreads = (next: ChatThread[]) => {
    setThreads(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 40)));
    } catch {
      // Ignore storage quota issues
    }
  };

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId]
  );

  // Auto-scroll to latest message
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, activeThread?.messages.length, sending]);

  // Close drawer on Escape (unless inline editing a message or renaming a chat)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingMsgId) {
          setEditingMsgId(null);
          return;
        }
        if (renamingThreadId) {
          setRenamingThreadId(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editingMsgId, renamingThreadId, onClose]);

  if (!open) return null;

  // ==================== Thread Management (New / Switch / Rename / Delete / Clear) ====================
  const handleNewChat = () => {
    // If current active thread is already empty, just focus it
    if (activeThread && activeThread.messages.length === 0) {
      setInput("");
      setEditingMsgId(null);
      if (!expandedStudio) setHistoryOpen(false);
      return;
    }
    const fresh = createEmptyThread();
    const next = [fresh, ...threads];
    persistThreads(next);
    setActiveThreadId(fresh.id);
    setInput("");
    setEditingMsgId(null);
    if (!expandedStudio) setHistoryOpen(false);
  };

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    setEditingMsgId(null);
    setRenamingThreadId(null);
    if (!expandedStudio) setHistoryOpen(false);
  };

  const startRenameThread = (t: ChatThread) => {
    setRenamingThreadId(t.id);
    setRenameDraft(t.title);
  };

  const saveRenameThread = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      const next = threads.map((t) =>
        t.id === id ? { ...t, title: trimmed, updatedAt: Date.now() } : t
      );
      persistThreads(next);
    }
    setRenamingThreadId(null);
  };

  const handleDeleteThread = (id: string) => {
    const remaining = threads.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const fresh = createEmptyThread();
      persistThreads([fresh]);
      setActiveThreadId(fresh.id);
    } else {
      persistThreads(remaining);
      if (activeThreadId === id) {
        setActiveThreadId(remaining[0].id);
      }
    }
    if (renamingThreadId === id) setRenamingThreadId(null);
  };

  const handleClearAllChats = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3500);
      return;
    }
    const fresh = createEmptyThread();
    persistThreads([fresh]);
    setActiveThreadId(fresh.id);
    setConfirmClearAll(false);
  };

  // ==================== Send, Edit & Resend, Regenerate, Delete Turn, Copy ====================
  const executeConversationTurn = async ({
    baseThreads,
    threadId,
    priorMessages,
    userPrompt,
    isEdited = false,
  }: {
    baseThreads: ChatThread[];
    threadId: string;
    priorMessages: ChatMessage[];
    userPrompt: string;
    isEdited?: boolean;
  }) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || sending) return;

    const now = Date.now();
    const userMsg: ChatMessage = {
      id: `u-${now}`,
      sender: "user",
      text: trimmed,
      edited: isEdited,
      createdAt: now,
    };

    const updatedMsgsWithUser = [...priorMessages, userMsg];

    const afterUserThreads = baseThreads.map((t) => {
      if (t.id !== threadId) return t;
      const shouldAutoTitle = t.title === "New chat" || priorMessages.length === 0;
      return {
        ...t,
        title: shouldAutoTitle ? deriveTitleFromPrompt(trimmed) : t.title,
        messages: updatedMsgsWithUser,
        updatedAt: now,
      };
    });
    // Sort active thread to top of recent list
    afterUserThreads.sort((a, b) => b.updatedAt - a.updatedAt);
    persistThreads(afterUserThreads);

    setSending(true);
    setShowPromptPills(false);

    const historyPayload = priorMessages.slice(-10).map((m) => ({
      role: (m.sender === "ai" ? "assistant" : "user") as "user" | "assistant",
      text: m.text,
    }));

    try {
      const res = await aiChatApi(trimmed, historyPayload);
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: "ai",
        text: res.answer,
        toolsCalled: res.toolsCalled,
        fallbackUsed: res.fallbackUsed,
        provider: res.provider,
        createdAt: Date.now(),
      };
      setThreads((curr) => {
        const next = curr.map((t) =>
          t.id === threadId
            ? { ...t, messages: [...updatedMsgsWithUser, aiMsg], updatedAt: Date.now() }
            : t
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 40)));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: getApiErrorMessage(
          err,
          "AI Assistant is temporarily unavailable. Please try again shortly."
        ),
        toolsCalled: [],
        createdAt: Date.now(),
      };
      setThreads((curr) => {
        const next = curr.map((t) =>
          t.id === threadId
            ? { ...t, messages: [...updatedMsgsWithUser, errMsg], updatedAt: Date.now() }
            : t
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 40)));
        } catch {
          // Ignore storage error
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const sendPrompt = async (promptText: string) => {
    const target = activeThread || createEmptyThread();
    const ensuredThreads = threads.some((t) => t.id === target.id)
      ? threads
      : [target, ...threads];
    if (ensuredThreads !== threads) {
      setActiveThreadId(target.id);
    }
    setInput("");
    await executeConversationTurn({
      baseThreads: ensuredThreads,
      threadId: target.id,
      priorMessages: target.messages,
      userPrompt: promptText,
    });
  };

  const handleSaveEditedMessage = async (msgIndex: number) => {
    if (!activeThread || sending) return;
    const trimmed = editMsgDraft.trim();
    if (!trimmed) return;
    const priorMessages = activeThread.messages.slice(0, msgIndex);
    setEditingMsgId(null);
    setEditMsgDraft("");
    await executeConversationTurn({
      baseThreads: threads,
      threadId: activeThread.id,
      priorMessages,
      userPrompt: trimmed,
      isEdited: true,
    });
  };

  const handleRegenerateAt = async (aiMsgIndex: number) => {
    if (!activeThread || sending || aiMsgIndex < 1) return;
    // Find preceding user message
    let userIdx = aiMsgIndex - 1;
    while (userIdx >= 0 && activeThread.messages[userIdx].sender !== "user") {
      userIdx--;
    }
    if (userIdx < 0) return;
    const promptToReplay = activeThread.messages[userIdx].text;
    const priorMessages = activeThread.messages.slice(0, userIdx);
    await executeConversationTurn({
      baseThreads: threads,
      threadId: activeThread.id,
      priorMessages,
      userPrompt: promptToReplay,
      isEdited: activeThread.messages[userIdx].edited,
    });
  };

  const handleDeleteMessagePair = (msgIndex: number) => {
    if (!activeThread || sending) return;
    const msgs = [...activeThread.messages];
    if (msgs[msgIndex]?.sender === "user") {
      // Remove user message + immediate AI reply if present
      const removeCount = msgs[msgIndex + 1]?.sender === "ai" ? 2 : 1;
      msgs.splice(msgIndex, removeCount);
    } else {
      msgs.splice(msgIndex, 1);
    }
    const next = threads.map((t) =>
      t.id === activeThread.id ? { ...t, messages: msgs, updatedAt: Date.now() } : t
    );
    persistThreads(next);
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1600);
    } catch {
      // Ignore clipboard permission denial
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  // IME-safe Enter-to-submit for <textarea> (handles CJK/IME composition + Safari WebKit 165004)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const nativeEvt = event.nativeEvent as KeyboardEvent;

      if (nativeEvt.isComposing || nativeEvt.keyCode === 229) {
        return;
      }

      if (
        lastCompositionEndAtRef.current !== null &&
        Math.abs(event.timeStamp - lastCompositionEndAtRef.current) < 50
      ) {
        return;
      }

      formRef.current?.requestSubmit();
    }
  };

  const handleEditKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    msgIndex: number
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const nativeEvt = event.nativeEvent as KeyboardEvent;
      if (nativeEvt.isComposing || nativeEvt.keyCode === 229) return;
      if (
        editCompositionEndAtRef.current !== null &&
        Math.abs(event.timeStamp - editCompositionEndAtRef.current) < 50
      ) {
        return;
      }
      void handleSaveEditedMessage(msgIndex);
    }
  };

  const currentMessages = activeThread?.messages || [];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 flex bg-slate-950/55 backdrop-blur-xs ${
        expandedStudio ? "items-center justify-center p-2 sm:p-5" : "justify-end"
      }`}
    >
      <div
        role="region"
        aria-label="HCM Lite AI Studio"
        className={`relative flex overflow-hidden surface-card shadow-2xl transition-all duration-200 ${
          expandedStudio
            ? "h-[92svh] w-full max-w-5xl rounded-3xl"
            : "h-[100svh] w-full max-w-xl"
        }`}
      >
        {/* Mobile/Drawer Backdrop when History Sidebar is Overlaid */}
        {historyOpen && (
          <div
            onClick={() => setHistoryOpen(false)}
            className={`absolute inset-0 z-20 bg-slate-950/40 ${expandedStudio ? "md:hidden" : ""}`}
          />
        )}

        {/* ==================== Gemini / ChatGPT Left History Sidebar ==================== */}
        <aside
          aria-label="Chat history"
          className={`${
            historyOpen
              ? expandedStudio
                ? "absolute inset-y-0 left-0 z-30 flex w-72 shadow-2xl md:static md:z-auto md:shrink-0 md:shadow-none"
                : "absolute inset-y-0 left-0 z-30 flex w-72 shadow-2xl"
              : "hidden"
          } flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]`}
        >
          {/* Sidebar Header + New Chat Pill */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              {!expandedStudio && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close chat history"
                  className="gemini-icon-btn"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </button>
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-muted px-1">
                Chat History
              </span>
            </div>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-muted">
              {threads.length}
            </span>
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex w-full items-center gap-2.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm font-semibold hover:border-teal-500 transition-colors cursor-pointer"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New chat</span>
            </button>
          </div>

          {/* Recent Threads List */}
          <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-1">
            <p className="px-2.5 pb-1 text-[11px] font-semibold text-muted">Recent</p>
            {threads.map((t) => {
              const isActive = t.id === activeThread?.id;
              const isRenaming = renamingThreadId === t.id;

              return (
                <div
                  key={t.id}
                  className={`group flex items-center justify-between gap-1.5 rounded-2xl px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-teal-500/15 text-teal-800 dark:text-teal-200 font-semibold"
                      : "hover:bg-[var(--bg-subtle)] text-[var(--text-main)]"
                  }`}
                >
                  {isRenaming ? (
                    <div className="flex flex-1 items-center gap-1">
                      <label htmlFor={`rename-${t.id}`} className="visually-hidden">
                        Rename chat
                      </label>
                      <input
                        id={`rename-${t.id}`}
                        type="text"
                        value={renameDraft}
                        autoFocus
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveRenameThread(t.id);
                          } else if (e.key === "Escape") {
                            setRenamingThreadId(null);
                          }
                        }}
                        className="input-field py-1 px-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveRenameThread(t.id)}
                        aria-label="Save chat title"
                        className="rounded-lg p-1 text-teal-600 hover:bg-teal-500/15"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectThread(t.id)}
                        className="flex flex-1 flex-col items-start min-w-0 text-left cursor-pointer"
                      >
                        <span className="w-full truncate">{t.title}</span>
                        <span className="text-[10px] font-normal text-muted">
                          {t.messages.length} msg · {formatRelativeTime(t.updatedAt)}
                        </span>
                      </button>

                      <div
                        className={`flex items-center gap-0.5 shrink-0 ${
                          isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenameThread(t);
                          }}
                          title="Rename chat"
                          aria-label={`Rename ${t.title}`}
                          className="rounded-full p-1.5 hover:bg-[var(--bg-surface)] text-muted hover:text-[var(--text-main)] cursor-pointer"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(t.id);
                          }}
                          title="Delete chat"
                          aria-label={`Delete ${t.title}`}
                          className="rounded-full p-1.5 hover:bg-rose-500/15 text-muted hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Clear All Footer */}
          <div className="border-t border-[var(--border-color)] p-3">
            <button
              type="button"
              onClick={handleClearAllChats}
              className={`w-full rounded-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                confirmClearAll
                  ? "bg-rose-600 text-white"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              {confirmClearAll ? "Click again to confirm clear all" : "🗑 Clear all chat history"}
            </button>
          </div>
        </aside>

        {/* ==================== Main Chat Conversation Pane ==================== */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Gemini-Style Header Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Gemini Circular Hamburger to Toggle History */}
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label="Toggle chat history"
                aria-expanded={historyOpen}
                title="Chat history (Recent chats)"
                className="gemini-icon-btn"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold truncate">HCM Lite AI</span>
                  <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    {role}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted">
                  {activeThread?.title || "New chat"}
                </p>
              </div>
            </div>

            {/* Header Actions: New Chat, Expand/Dock Studio, Close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewChat}
                title="New chat"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold hover:border-teal-500 transition-colors cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden sm:inline">New chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExpandedStudio((prev) => {
                    const next = !prev;
                    setHistoryOpen(next);
                    return next;
                  });
                }}
                aria-label={expandedStudio ? "Dock to side drawer" : "Expand to full view"}
                title={expandedStudio ? "Dock to side panel" : "Expand full studio"}
                className="gemini-icon-btn hidden sm:inline-flex"
              >
                {expandedStudio ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close AI Assistant"
                title="Close (Esc)"
                className="gemini-icon-btn"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Stream OR Gemini Empty-State Greeting */}
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {currentMessages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-xl flex-col justify-center py-6">
                <div className="mb-6">
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-xl font-bold text-white shadow-md">
                    ✦
                  </div>
                  <h3 className="bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 dark:from-teal-300 dark:via-cyan-300 dark:to-indigo-300 bg-clip-text text-2xl font-extrabold text-transparent">
                    Assalam-o-Alaikum, {userName}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    How can I help you today? Ask live HR data questions, company policies, or chat in English & Roman Urdu.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_PROMPTS[role].map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendPrompt(q)}
                      className="flex items-start gap-2.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-subtle)]/70 p-3 text-left text-xs font-medium hover:border-teal-500 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                    >
                      <span aria-hidden="true" className="text-teal-600 dark:text-teal-400 mt-0.5">
                        ✦
                      </span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-5">
                {currentMessages.map((m, idx) => {
                  const isUser = m.sender === "user";
                  const isEditingThis = editingMsgId === m.id;

                  if (isUser) {
                    return (
                      <div key={m.id} className="group flex flex-col items-end">
                        {isEditingThis ? (
                          <div className="w-full max-w-[92%] rounded-2xl border border-teal-500 bg-[var(--bg-subtle)] p-3 shadow-sm">
                            <label htmlFor={`edit-msg-${m.id}`} className="visually-hidden">
                              Edit message
                            </label>
                            <textarea
                              id={`edit-msg-${m.id}`}
                              rows={2}
                              value={editMsgDraft}
                              autoFocus
                              onChange={(e) => setEditMsgDraft(e.target.value)}
                              onCompositionEnd={(e) => {
                                editCompositionEndAtRef.current = e.timeStamp;
                              }}
                              onKeyDown={(e) => handleEditKeyDown(e, idx)}
                              className="input-field resize-none text-sm"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingMsgId(null)}
                                className="btn-secondary rounded-full px-3 py-1 text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={sending || !editMsgDraft.trim()}
                                onClick={() => void handleSaveEditedMessage(idx)}
                                className="btn-primary rounded-full px-3.5 py-1 text-xs"
                              >
                                Update & Send
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="max-w-[85%] rounded-3xl rounded-br-md bg-teal-600 px-4 py-2.5 text-sm text-white whitespace-pre-line shadow-xs">
                              {m.text}
                            </div>
                            <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-muted">
                              {m.edited && <span className="italic">(edited)</span>}
                              <button
                                type="button"
                                disabled={sending}
                                onClick={() => {
                                  setEditingMsgId(m.id);
                                  setEditMsgDraft(m.text);
                                }}
                                title="Edit & regenerate response"
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                              >
                                <span aria-hidden="true">✎</span>
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyText(m.id, m.text)}
                                title="Copy message"
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                              >
                                <span>{copiedId === m.id ? "✓ Copied" : "⧉ Copy"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={sending}
                                onClick={() => handleDeleteMessagePair(idx)}
                                title="Delete turn"
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <span>🗑</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }

                  // AI Response Row (Gemini Style)
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-xs font-bold text-white shadow-xs"
                      >
                        ✦
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl rounded-tl-sm surface-subtle px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-[var(--text-main)]">
                          {m.text}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                          <AiBadge toolsCalled={m.toolsCalled} fallbackUsed={m.fallbackUsed} />

                          <div className="flex items-center gap-1 text-[11px] text-muted">
                            <button
                              type="button"
                              onClick={() => void handleCopyText(m.id, m.text)}
                              title="Copy response"
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                            >
                              <span>{copiedId === m.id ? "✓ Copied" : "⧉ Copy"}</span>
                            </button>
                            {idx > 0 && (
                              <button
                                type="button"
                                disabled={sending}
                                onClick={() => void handleRegenerateAt(idx)}
                                title="Regenerate response"
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                              >
                                <span aria-hidden="true">↻</span>
                                <span>Regenerate</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white"
                    >
                      ✦
                    </span>
                    <div className="rounded-2xl surface-subtle px-4 py-2.5 text-xs text-muted animate-pulse">
                      Thinking & checking scoped HR data…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Optional Collapsible Quick Prompts Drawer above Composer */}
          {showPromptPills && currentMessages.length > 0 && (
            <div className="border-t border-[var(--border-color)] bg-[var(--bg-subtle)]/50 px-4 py-2.5">
              <div className="mx-auto flex max-w-2xl flex-wrap gap-1.5">
                {QUICK_PROMPTS[role].map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => void sendPrompt(q)}
                    className="rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] hover:border-teal-500 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ==================== Gemini Pill Prompt Composer ==================== */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="border-t border-[var(--border-color)] px-3 py-3 sm:px-5"
          >
            <div className="mx-auto max-w-2xl">
              <label htmlFor="ai-chat-input" className="visually-hidden">
                Ask HCM Lite AI Assistant
              </label>
              <div className="flex items-end gap-2 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3.5 py-2 focus-within:border-teal-500 transition-colors">
                {currentMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPromptPills((v) => !v)}
                    title="Toggle quick HR prompts"
                    aria-label="Toggle quick HR prompts"
                    className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                  >
                    💡
                  </button>
                )}

                <textarea
                  id="ai-chat-input"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onCompositionEnd={(e) => {
                    lastCompositionEndAtRef.current = e.timeStamp;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask HCM Lite AI… (Enter to send, Shift+Enter for new line)"
                  className="chat-composer-textarea flex-1"
                />

                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send message"
                  title="Send message"
                  className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted">
                Scoped to {role.toUpperCase()} permissions · Live MongoDB tool-calling · Chats saved locally
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
