"use client";

import { useState } from "react";
import { Department, Designation } from "@/api/hcm";

interface OrgHierarchyChartProps {
  companyName: string;
  departments: Department[];
  designations: Designation[];
}

export default function OrgHierarchyChart({
  companyName,
  departments,
  designations,
}: OrgHierarchyChartProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  const getDesignationsForDept = (deptId: string) => {
    return designations.filter((d) => {
      const dId = typeof d.departmentId === "object" && d.departmentId !== null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (d.departmentId as any)._id || (d.departmentId as any).id
        : d.departmentId;
      return String(dId) === String(deptId);
    });
  };

  const activeDept = departments.find((d) => d._id === selectedDeptId);
  const activeDesignations = selectedDeptId ? getDesignationsForDept(selectedDeptId) : [];

  return (
    <div className="surface-card rounded-2xl border border-[var(--border-color)] p-6 space-y-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-500 mb-1">
            <span>🌳</span> Visual Structure
          </span>
          <h3 className="text-base font-extrabold text-foreground">
            Interactive Organizational Hierarchy Tree
          </h3>
          <p className="text-xs text-muted">
            Explore corporate leadership, department breakdown, and designation tiers across the company.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDeptId(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              selectedDeptId === null
                ? "bg-teal-600 text-white border-teal-500"
                : "bg-surface text-muted border-default hover:text-foreground"
            }`}
          >
            Show All Departments
          </button>
        </div>
      </div>

      {/* Tree Visualization */}
      <div className="flex flex-col items-center space-y-8 overflow-x-auto py-4">
        {/* Level 1: Root Node (Executive / Company) */}
        <div className="flex flex-col items-center">
          <div className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 p-4 shadow-xl text-center min-w-[260px] relative hover:scale-105 transition">
            <span className="text-2xl">🏢</span>
            <h4 className="font-black text-sm text-foreground mt-1">{companyName || "Saylani Tech"}</h4>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Executive Board & Headquarters
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-muted">
              <span>Karachi, PK</span> • <span>{departments.length} Divisions</span>
            </div>
          </div>
          <div className="h-8 w-0.5 bg-gradient-to-b from-amber-500 to-teal-500" />
        </div>

        {/* Level 2: Departments Row */}
        <div className="w-full">
          <div className="flex flex-wrap items-start justify-center gap-4">
            {departments.map((dept) => {
              const deptDesigs = getDesignationsForDept(dept._id);
              const isSelected = selectedDeptId === dept._id;

              return (
                <div
                  key={dept._id}
                  className={`flex flex-col items-center transition-all ${
                    selectedDeptId && !isSelected ? "opacity-40 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDeptId(isSelected ? null : dept._id)}
                    className={`rounded-xl border p-3.5 text-left w-52 shadow-md transition-all ${
                      isSelected
                        ? "border-teal-500 bg-teal-500/15 shadow-teal-500/20 scale-105 ring-2 ring-teal-500"
                        : "border-[var(--border-color)] surface-card hover:border-teal-500/50 hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-teal-600 dark:text-teal-400">
                        {dept.code}
                      </span>
                      <span className="text-[10px] font-semibold text-muted">
                        {deptDesigs.length} Roles
                      </span>
                    </div>
                    <h5 className="mt-1.5 font-bold text-xs text-foreground truncate">
                      {dept.name}
                    </h5>
                    <p className="mt-0.5 text-[10px] text-muted line-clamp-2">
                      {dept.description || "Active functional division"}
                    </p>
                  </button>

                  {/* Level 3: Designations directly nested */}
                  <div className="mt-3 flex flex-col items-center space-y-2 w-full max-w-[200px]">
                    <div className="h-3 w-0.5 bg-teal-500/40" />
                    {deptDesigs.length === 0 ? (
                      <span className="text-[10px] text-muted italic">No roles mapped</span>
                    ) : (
                      deptDesigs.map((des) => (
                        <div
                          key={des._id}
                          className="w-full rounded-lg surface-subtle border border-[var(--border-color)] px-2.5 py-1.5 text-left shadow-xs flex items-center justify-between gap-1.5"
                        >
                          <div className="truncate">
                            <p className="font-semibold text-[11px] truncate">{des.title}</p>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0 ${
                              des.level === "Senior" || des.level === "Lead"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                : des.level === "Mid"
                                ? "bg-teal-500/15 text-teal-600 dark:text-teal-400"
                                : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {des.level || "Mid"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Division Inspector */}
      {activeDept && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-teal-700 dark:text-teal-300">
              Active Inspector: {activeDept.name} ({activeDept.code})
            </h4>
            <span className="text-[10px] text-muted">
              {activeDesignations.length} Designated Tiers
            </span>
          </div>
          <p className="text-xs text-muted">
            {activeDept.description || "Operational team within Saylani Tech."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {activeDesignations.map((d) => (
              <span
                key={d._id}
                className="inline-flex items-center gap-1 rounded-md bg-surface border border-default px-2.5 py-1 text-xs font-medium"
              >
                <span>✦</span> {d.title} ({d.level || "Mid"})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
