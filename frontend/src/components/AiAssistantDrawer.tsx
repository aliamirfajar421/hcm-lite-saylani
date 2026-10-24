"use client";

import { useRef, useState } from "react";
import { aiChatApi, UserRole } from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import AiBadge from "./AiBadge";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  toolsCalled?: string[];
  fallbackUsed?: boolean;
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

export default function AiAssistantDrawer({
  open,
  onClose,
  role,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  userName: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Assalam-o-Alaikum ${userName}! I am your HCM Lite AI Assistant (scoped to your ${role.toUpperCase()} permissions). Ask me live HR questions in English or Roman Urdu, or ask about attendance, leave, and payroll policies.`,
      toolsCalled: [],
    },
  ]);

  if (!open) return null;

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await aiChatApi(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: "ai",
          text: res.answer,
          toolsCalled: res.toolsCalled,
          fallbackUsed: res.fallbackUsed,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: getApiErrorMessage(
            err,
            "AI Assistant is temporarily unavailable. Please try again shortly."
          ),
          toolsCalled: [],
        },
      ]);
    } finally {
      setSending(false);
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div
        className="flex h-full w-full max-w-md flex-col surface-card shadow-2xl"
        role="region"
        aria-label="AI HR Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-gradient-to-r from-teal-900 to-slate-900 px-4 py-3.5 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-teal-500 text-xs font-bold text-slate-950">
                AI
              </span>
              <h2 className="text-sm font-bold">HCM Lite AI Assistant</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-teal-200">
              Live DB tool-calling · Role-scoped ({role.toUpperCase()}) · English & Roman Urdu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="rounded-lg px-2.5 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="border-b border-[var(--border-color)] px-4 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Quick test questions:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS[role].map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => void sendPrompt(q)}
                className="rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)] px-2.5 py-1 text-left text-[11px] hover:border-teal-500 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                  m.sender === "user"
                    ? "bg-teal-600 text-white"
                    : "surface-subtle text-[var(--text-main)]"
                }`}
              >
                {m.text}
              </div>
              {m.sender === "ai" && (
                <div className="mt-1.5">
                  <AiBadge toolsCalled={m.toolsCalled} fallbackUsed={m.fallbackUsed} />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="text-xs text-muted animate-pulse">
              Running scoped HR tools & composing answer...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="border-t border-[var(--border-color)] p-3"
        >
          <label htmlFor="ai-chat-input" className="visually-hidden">
            Ask AI HR Assistant
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="ai-chat-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onCompositionEnd={(e) => {
                lastCompositionEndAtRef.current = e.timeStamp;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask in English or Roman Urdu... (Enter to send, Shift+Enter for new line)"
              className="input-field resize-none text-sm"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn-primary shrink-0 px-4 py-2.5"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

