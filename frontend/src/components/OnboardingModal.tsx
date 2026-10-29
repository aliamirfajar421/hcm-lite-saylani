"use client";

import { useEffect, useState } from "react";
import ModalDialog from "./ModalDialog";
import { triggerConfetti } from "@/lib/confetti";
import { sound } from "@/lib/audio";

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
}

const DEFAULT_TASKS: OnboardingTask[] = [
  {
    id: "it_assets",
    title: "1. IT Assets & Workspace Laptop Allocation",
    description: "Issue MacBook / ThinkPad, company Google Workspace email, and secure VPN credentials.",
    icon: "💻",
    completed: true,
  },
  {
    id: "biometric",
    title: "2. Biometric Face & Smart NFC/QR ID Badge",
    description: "Enroll canvas facial recognition vector and issue digital NFC/QR security pass.",
    icon: "🪪",
    completed: true,
  },
  {
    id: "contract",
    title: "3. Signed Employment Contract & FBR Tax Declaration",
    description: "Collect signed appointment letter, CNIC copy, and FBR annual income tax slab declaration.",
    icon: "📝",
    completed: false,
  },
  {
    id: "orientation",
    title: "4. Department Mentor & First Week Induction",
    description: "Pair with a senior engineer / manager for Saylani code standards and team intro.",
    icon: "🤝",
    completed: false,
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  employee: {
    _id: string;
    fullName: string;
    employeeCode: string;
    departmentName?: string;
    designationTitle?: string;
  } | null;
}

export default function OnboardingModal({ open, onClose, employee }: OnboardingModalProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>(DEFAULT_TASKS);

  useEffect(() => {
    if (employee?._id) {
      try {
        const key = `onboarding_${employee._id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setTasks(JSON.parse(saved));
          return;
        }
      } catch {
        // fallback default
      }
      setTasks(DEFAULT_TASKS);
    }
  }, [employee]);

  const toggleTask = (taskId: string) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    if (employee?._id) {
      localStorage.setItem(`onboarding_${employee._id}`, JSON.stringify(updated));
    }

    const allCompleted = updated.every((t) => t.completed);
    if (allCompleted) {
      triggerConfetti(3000);
    } else {
      sound.playClick();
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  if (!employee) return null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Employee Onboarding Checklist"
      subtitle={`Track new hire orientation & setup for ${employee.fullName} (${employee.employeeCode})`}
    >
      <div className="space-y-4">
        {/* Progress Bar Header */}
        <div className="surface-subtle rounded-2xl p-4 border border-default space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted uppercase tracking-wider">
              Onboarding Progress: {completedCount} of {tasks.length} Steps
            </span>
            <span className="font-black text-teal-600 dark:text-teal-400 text-sm">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-teal-500 to-emerald-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
              <span>🎉</span> Full Onboarding Complete! Employee is active and equipped.
            </p>
          )}
        </div>

        {/* Tasks Checklist */}
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`cursor-pointer rounded-xl p-3.5 border transition flex items-start gap-3 select-none ${
                task.completed
                  ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                  : "surface-card border-default hover:border-teal-400/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                  task.completed
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-slate-400 dark:border-slate-600 bg-transparent"
                }`}
              >
                {task.completed && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{task.icon}</span>
                  <h4 className={`text-xs font-bold ${task.completed ? "line-through opacity-80" : ""}`}>
                    {task.title}
                  </h4>
                </div>
                <p className="text-[11px] text-muted">{task.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary py-2 px-5 text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
