"use client";

import { useState } from "react";
import ModalDialog from "./ModalDialog";

interface WhatsAppMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  type: "attendance" | "leave" | "payroll" | "announcement";
}

interface WhatsAppAlertSimulatorProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
}

export default function WhatsAppAlertSimulator({
  open,
  onClose,
  userName = "Muhammad Ali",
}: WhatsAppAlertSimulatorProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([
    {
      id: "1",
      sender: "Saylani Tech HCM Bot",
      text: `As-salamu alaykum ${userName}! 📸 Your biometric check-in for today has been VERIFIED & RECORDED successfully via Front Camera + Geofence. Status: On-Time / Present. Have a productive day!`,
      time: "09:08 AM",
      type: "attendance",
    },
    {
      id: "2",
      sender: "Saylani Tech HCM Bot",
      text: `📢 HR Update: Your Casual Leave request (1 Day) has been APPROVED by HR Fatima Khan. Your updated casual leave quota: 9 days remaining.`,
      time: "11:45 AM",
      type: "leave",
    },
    {
      id: "3",
      sender: "Saylani Tech HCM Bot",
      text: `💼 Payroll Notice: October 2026 Salary has been approved and locked! Direct bank transfer initiated. Download your formal payslip PDF from your portal.`,
      time: "03:15 PM",
      type: "payroll",
    },
  ]);

  const [inputMsg, setInputMsg] = useState("");

  const addCustomMessage = (text: string, type: WhatsAppMessage["type"]) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: "Saylani Tech HCM Bot",
        text,
        time: timeStr,
        type,
      },
    ]);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="📱 Simulated WhatsApp Omnichannel Notification Hub"
      subtitle="Preview how real-time enterprise alerts are dispatched to employee mobile devices"
    >
      <div className="space-y-4">
        {/* Quick Simulation Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-muted">Send Test Alert:</span>
          <button
            type="button"
            onClick={() =>
              addCustomMessage(
                `📸 Live Check-In Alert: Face biometric verified at 09:14 AM. Location: Zaitoon Ashraf IT Park Karachi.`,
                "attendance"
              )
            }
            className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-600/30 transition"
          >
            + Attendance Alert
          </button>
          <button
            type="button"
            onClick={() =>
              addCustomMessage(
                `✦ AI Leave Engine: Your leave request was auto-verified by Gemini AI and queued for HR confirmation.`,
                "leave"
              )
            }
            className="rounded-lg bg-teal-600/20 px-2.5 py-1 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-600/30 transition"
          >
            + AI Leave Alert
          </button>
          <button
            type="button"
            onClick={() =>
              addCustomMessage(
                `💵 Salary Deposited: Net PKR 148,700 credited to your Habib Bank (HBL) account. Payslip attached.`,
                "payroll"
              )
            }
            className="rounded-lg bg-indigo-600/20 px-2.5 py-1 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-600/30 transition"
          >
            + Payroll Deposit
          </button>
        </div>

        {/* WhatsApp Mobile Container */}
        <div className="rounded-2xl border border-emerald-600/30 bg-[#0b141a] overflow-hidden shadow-2xl font-sans text-white">
          {/* Header */}
          <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center font-black text-sm text-white shadow-md">
                ST
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-slate-100">Saylani Tech HCM Bot</h4>
                  <span className="text-emerald-400 text-xs" title="Verified Business Account">
                    ✓
                  </span>
                </div>
                <p className="text-[11px] text-emerald-400">Official Enterprise Verified Service</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              WhatsApp Cloud API
            </span>
          </div>

          {/* Chat Bubble Area */}
          <div className="p-4 space-y-3 min-h-[260px] max-h-[360px] overflow-y-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="text-center">
              <span className="rounded-lg bg-[#182229] px-3 py-1 text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                Today (End-to-End Encrypted)
              </span>
            </div>

            {messages.map((m) => (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#005c4b] p-3 text-xs shadow-md space-y-1.5 text-slate-100">
                  <div className="flex items-center justify-between gap-3 text-[10px] text-emerald-200/80 font-bold uppercase">
                    <span>{m.type}</span>
                    <span>{m.sender}</span>
                  </div>
                  <p className="leading-relaxed">{m.text}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70 pt-0.5">
                    <span>{m.time}</span>
                    <span className="text-sky-300 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Simulated Quick Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputMsg.trim()) return;
              addCustomMessage(inputMsg.trim(), "announcement");
              setInputMsg("");
            }}
            className="bg-[#1f2c34] p-2.5 flex items-center gap-2 border-t border-white/10"
          >
            <input
              type="text"
              placeholder="Type a custom simulated mobile alert..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="flex-1 rounded-xl bg-[#2a3942] px-3.5 py-2 text-xs text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </ModalDialog>
  );
}
