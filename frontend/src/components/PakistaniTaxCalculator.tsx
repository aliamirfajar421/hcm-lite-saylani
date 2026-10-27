"use client";

import { useState } from "react";

/**
 * Official Federal Board of Revenue (FBR) Pakistan Tax Slabs (Tax Year 2025-2026)
 * for Salaried Individuals.
 */
function calculateFbrTax(annualSalary: number) {
  let annualTax = 0;
  let slabDescription = "";

  if (annualSalary <= 600000) {
    annualTax = 0;
    slabDescription = "Slab 1 (Up to PKR 600,000): 0% Tax Free";
  } else if (annualSalary <= 1200000) {
    annualTax = (annualSalary - 600000) * 0.025;
    slabDescription = "Slab 2 (PKR 600k – 1.2M): 2.5% of amount > 600,000";
  } else if (annualSalary <= 2200000) {
    annualTax = 15000 + (annualSalary - 1200000) * 0.125;
    slabDescription = "Slab 3 (PKR 1.2M – 2.2M): PKR 15,000 + 12.5% of amount > 1.2M";
  } else if (annualSalary <= 3200000) {
    annualTax = 140000 + (annualSalary - 2200000) * 0.225;
    slabDescription = "Slab 4 (PKR 2.2M – 3.2M): PKR 140,000 + 22.5% of amount > 2.2M";
  } else if (annualSalary <= 4100000) {
    annualTax = 365000 + (annualSalary - 3200000) * 0.275;
    slabDescription = "Slab 5 (PKR 3.2M – 4.1M): PKR 365,000 + 27.5% of amount > 3.2M";
  } else {
    annualTax = 612500 + (annualSalary - 4100000) * 0.35;
    slabDescription = "Slab 6 (Above PKR 4.1M): PKR 612,500 + 35% of amount > 4.1M";
  }

  return { annualTax, slabDescription };
}

export default function PakistaniTaxCalculator() {
  const [monthlyGross, setMonthlyGross] = useState<number>(150000);
  const [eobiDeduction, setEobiDeduction] = useState<boolean>(true);

  const annualGross = monthlyGross * 12;
  const { annualTax, slabDescription } = calculateFbrTax(annualGross);
  const monthlyTax = Math.round(annualTax / 12);
  const monthlyEobi = eobiDeduction ? 1300 : 0;

  // Breakdown standard Pakistani package
  const basicSalary = Math.round(monthlyGross * 0.6);
  const hra = Math.round(monthlyGross * 0.3);
  const medical = Math.round(monthlyGross * 0.1);

  const totalDeductions = monthlyTax + monthlyEobi;
  const netTakeHome = Math.max(0, monthlyGross - totalDeductions);
  const effectiveTaxRate = annualGross > 0 ? ((annualTax / annualGross) * 100).toFixed(1) : "0.0";

  return (
    <div className="surface-card rounded-2xl border border-emerald-500/30 p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-base">
            🇵🇰
          </span>
          <div>
            <h3 className="text-sm font-extrabold flex items-center gap-1.5">
              <span>Pakistani FBR Income Tax & Salary Calculator</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Tax Year 2025–2026
              </span>
            </h3>
            <p className="text-xs text-muted">
              Official Pakistani Salaried Slabs with automated EOBI & Net Take-Home estimation.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={eobiDeduction}
              onChange={(e) => setEobiDeduction(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <span>Apply EOBI (PKR 1,300)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Input Column */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-muted mb-1">
              Monthly Gross Salary (PKR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-muted">PKR</span>
              <input
                type="number"
                min="0"
                step="5000"
                value={monthlyGross}
                onChange={(e) => setMonthlyGross(Math.max(0, Number(e.target.value)))}
                className="input-field pl-12 font-bold text-base"
              />
            </div>
            <input
              type="range"
              min="30000"
              max="1000000"
              step="10000"
              value={monthlyGross}
              onChange={(e) => setMonthlyGross(Number(e.target.value))}
              className="w-full mt-2 accent-emerald-500"
            />
          </div>

          <div className="surface-subtle rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Basic Salary (60%):</span>
              <span className="font-semibold">PKR {basicSalary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">House Rent (30%):</span>
              <span className="font-semibold">PKR {hra.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Medical Allowance (10%):</span>
              <span className="font-semibold">PKR {medical.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border-color)] pt-1 text-[11px] text-muted">
              <span>Annual Equivalent:</span>
              <span className="font-bold">PKR {annualGross.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Column */}
        <div className="space-y-3">
          <div className="surface-subtle rounded-xl p-3.5 space-y-2">
            <p className="text-xs font-bold text-muted">Tax & Deduction Breakdown</p>

            <div className="flex justify-between items-center text-xs">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Monthly Income Tax:</span>
              <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                - PKR {monthlyTax.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">EOBI Employee Share:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                - PKR {monthlyEobi.toLocaleString()}
              </span>
            </div>

            <div className="border-t border-[var(--border-color)] pt-1.5 flex justify-between text-xs">
              <span className="font-semibold">Total Monthly Deductions:</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">
                - PKR {totalDeductions.toLocaleString()}
              </span>
            </div>

            <div className="text-[11px] text-muted border-t border-[var(--border-color)] pt-1">
              <span>Effective Tax Rate: </span>
              <strong className="text-emerald-500">{effectiveTaxRate}%</strong>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
            <strong>Applicable Slab:</strong> {slabDescription}
          </div>
        </div>

        {/* Net Take-Home Highlight */}
        <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-emerald-600/15 via-teal-600/10 to-transparent border border-emerald-500/40 p-4">
          <div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
              Estimated Monthly Net Pay
            </span>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              PKR {netTakeHome.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted">
              Direct transfer amount to employee bank account after statutory FBR income tax & EOBI withholding.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-500/20">
            <div className="flex justify-between text-[11px] text-muted mb-1">
              <span>Take-Home Ratio:</span>
              <span className="font-bold">
                {monthlyGross > 0 ? Math.round((netTakeHome / monthlyGross) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: `${monthlyGross > 0 ? (netTakeHome / monthlyGross) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
