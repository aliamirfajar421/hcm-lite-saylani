"use client";

import { useState } from "react";
import ModalDialog from "./ModalDialog";

interface DigitalEmployeeBadgeProps {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  employeeData?: any;
  companyName?: string;
}

export default function DigitalEmployeeBadge({
  open,
  onClose,
  employeeData,
  companyName = "Saylani Tech",
}: DigitalEmployeeBadgeProps) {
  const [flipped, setFlipped] = useState(false);

  if (!employeeData) return null;

  const empCode = employeeData.employeeCode || employeeData.code || "EMP001";
  const fullName = employeeData.fullName || employeeData.name || "Muhammad Ali";
  const designation = employeeData.designation || employeeData.designationName || "Senior Software Engineer";
  const department = employeeData.department || employeeData.departmentName || "Engineering";
  const bloodGroup = employeeData.bloodGroup || "O+";
  const email = employeeData.email || "employee@saylani.com";
  const joiningDate = employeeData.joiningDate || "2026-01-15";

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="🪪 Digital Smart NFC & QR Employee ID Badge"
      subtitle="Official corporate identification card with biometric verification QR code"
    >
      <div className="space-y-6">
        {/* ID Card Presentation Stage */}
        <div className="flex flex-col items-center justify-center py-2">
          {/* Badge Container */}
          <div
            onClick={() => setFlipped((f) => !f)}
            className="cursor-pointer select-none transition-transform duration-500 hover:scale-[1.02] shadow-2xl rounded-3xl"
            title="Click to flip badge"
          >
            {!flipped ? (
              /* FRONT OF BADGE */
              <div className="relative w-80 sm:w-96 rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-2xl overflow-hidden">
                {/* Holographic Sheen Overlay */}
                <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-teal-400/20 via-cyan-400/10 to-transparent blur-2xl pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-sm shadow-md">
                      ST
                    </div>
                    <div>
                      <h4 className="text-xs font-black tracking-wider uppercase text-emerald-400">
                        {companyName}
                      </h4>
                      <p className="text-[10px] text-slate-400">Digital Workforce Pass</p>
                    </div>
                  </div>
                  <div className="h-5 w-7 rounded-sm bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 shadow-inner border border-amber-600/40 flex items-center justify-center">
                    <div className="h-3 w-4 border-t border-b border-amber-800/40" />
                  </div>
                </div>

                {/* Avatar & Key Details */}
                <div className="my-5 flex items-center gap-4">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 p-0.5 shadow-xl">
                      <div className="h-full w-full rounded-2xl bg-slate-900 flex items-center justify-center text-2xl font-black text-emerald-400">
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[10px]" title="Active Status">
                      ✓
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-extrabold text-base truncate text-slate-100">{fullName}</h3>
                    <p className="text-xs font-semibold text-teal-300 truncate">{designation}</p>
                    <span className="inline-block rounded-md bg-teal-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-teal-300 border border-teal-500/30">
                      {department}
                    </span>
                  </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] surface-subtle rounded-2xl p-3 border border-white/5">
                  <div>
                    <span className="text-slate-400 block text-[10px]">EMPLOYEE CODE</span>
                    <strong className="font-mono text-emerald-400">{empCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BLOOD GROUP</span>
                    <strong className="text-rose-400">{bloodGroup}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">JOINED</span>
                    <span className="text-slate-200">{joiningDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">STATUS</span>
                    <span className="text-emerald-400 font-bold uppercase">Active Permanent</span>
                  </div>
                </div>

                {/* Footer with Scannable QR */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    <p className="font-mono">{email}</p>
                    <p className="text-[9px] text-teal-400">Click card to view magnetic strip →</p>
                  </div>
                  {/* Clean Vector QR Code Simulation */}
                  <div className="h-10 w-10 bg-white p-1 rounded-lg shadow-md flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="h-3 w-3 bg-black rounded-xs" />
                      <div className="h-3 w-3 bg-black rounded-xs" />
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 w-3 bg-black rounded-xs" />
                      <div className="h-1.5 w-1.5 bg-black rounded-xs self-center" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* BACK OF BADGE */
              <div className="relative w-80 sm:w-96 rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-2xl overflow-hidden space-y-4">
                <div className="h-10 -mx-6 bg-slate-950 border-t border-b border-white/20 flex items-center px-6">
                  <span className="text-[9px] font-mono text-slate-500 tracking-widest">
                    ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <h5 className="font-bold text-emerald-400 text-xs">Security & Facility Terms</h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This credential is valid for authorized entry at Saylani Tech facilities. If found, please return to People & Culture Operations, Zaitoon Ashraf IT Park, Karachi.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Emergency Helpline: +92 21 111-729-526
                  </p>
                </div>

                <div className="surface-subtle p-3 rounded-xl border border-white/10 text-center space-y-1">
                  <p className="text-[10px] text-slate-400">NFC TAP ACCESS READY</p>
                  <p className="text-xs font-mono font-bold text-teal-300">NFC-UID: 9A4F-C821-B490</p>
                </div>

                <p className="text-center text-[9px] text-teal-400">Click to flip back to photo →</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 print:hidden">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="btn-secondary text-xs"
          >
            🔄 Flip Card ({flipped ? "Show Front" : "Show Back"})
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <span>🖨</span>
              <span>Print Official ID Badge</span>
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
