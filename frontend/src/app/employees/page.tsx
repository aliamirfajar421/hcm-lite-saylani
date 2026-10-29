"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  Department,
  Designation,
  downloadPayslipPdf,
  downloadOfferLetterPdf,
  downloadExperiencePdf,
  EmployeeRecord,
  exportEmployeesCsvDownload,
  getEmployee360Api,
  importEmployeesCsvApi,
  listDepartmentsApi,
  listDesignationsApi,
  listEmployeesApi,
  registerEmployeeApi,
  updateEmployeeApi,
  updateOwnContactApi,
  updateSalaryStructureApi,
} from "@/api/hcm";
import { getApiErrorMessage } from "@/lib/api";
import { StatusPill } from "@/components/Charts";
import ModalDialog from "@/components/ModalDialog";
import OnboardingModal from "@/components/OnboardingModal";

export default function EmployeesPage() {
  const { user, currency } = useAuth();
  const isHr = user?.role === "hr";
  const isEmployee = user?.role === "employee";

  // Directory state (Admin/HR)
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  // Created employee temp credentials banner
  const [lastCreatedLogin, setLastCreatedLogin] = useState<{
    name: string;
    email: string;
    tempPass: string;
  } | null>(null);

  // Onboarding Checklist Modal
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedOnboardingEmp, setSelectedOnboardingEmp] = useState<{
    _id: string;
    fullName: string;
    employeeCode: string;
    departmentName?: string;
    designationTitle?: string;
  } | null>(null);

  // Register Employee Modal (HR)
  const [registerOpen, setRegisterOpen] = useState(false);
  const [empCode, setEmpCode] = useState("EMP001");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("male");
  const [regDeptId, setRegDeptId] = useState("");
  const [regDesigId, setRegDesigId] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [basicSalary, setBasicSalary] = useState("80000");
  const [tempPassword, setTempPassword] = useState("EmpTemp@123");

  // CSV Import Modal (HR)
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvTempPass, setCsvTempPass] = useState("ChangeMe@123");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [csvReport, setCsvReport] = useState<any>(null);

  // Employee 360 State (Modal for Admin/HR, Main View for Employee)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emp360, setEmp360] = useState<any>(null);
  const [emp360Open, setEmp360Open] = useState(false);

  // Own Contact Edit (Employee) & HR Edit Salary/Status
  const [ownPhone, setOwnPhone] = useState("");
  const [ownAddress, setOwnAddress] = useState("");
  const [editBasic, setEditBasic] = useState("");
  const [editHraPct, setEditHraPct] = useState("40");
  const [editMedPct, setEditMedPct] = useState("10");
  const [editOtherAllow, setEditOtherAllow] = useState("0");
  const [editStatus, setEditStatus] = useState("active");

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isEmployee) {
        const me360 = await getEmployee360Api("me");
        setEmp360(me360);
        setOwnPhone(me360.employee.phone || "");
        setOwnAddress(me360.employee.address || "");
      } else {
        const [dir, depts, desigs] = await Promise.all([
          listEmployeesApi({
            q: q || undefined,
            departmentId: departmentId || undefined,
            status: statusFilter || undefined,
            page,
            limit: 15,
          }),
          listDepartmentsApi(),
          listDesignationsApi(),
        ]);
        setEmployees(dir.employees);
        setTotal(dir.total);
        setPages(dir.pages);
        setDepartments(depts);
        setDesignations(desigs);
        if (depts.length > 0 && !regDeptId) setRegDeptId(depts[0]._id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isEmployee, q, departmentId, statusFilter, page, regDeptId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const open360 = async (id: string) => {
    setError("");
    try {
      const res = await getEmployee360Api(id);
      setEmp360(res);
      setEditBasic(String(res.employee.salaryStructure?.basic || 0));
      setEditHraPct(String(res.employee.salaryStructure?.hraPercent ?? 40));
      setEditMedPct(String(res.employee.salaryStructure?.medicalPercent ?? 10));
      setEditOtherAllow(String(res.employee.salaryStructure?.otherAllowances || 0));
      setEditStatus(res.employee.employmentStatus);
      setEmp360Open(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const computedRegGross = Math.round(Number(basicSalary || 0) * 1.5);

  return (
    <AppShell>
      {isEmployee ? (
        /* ================== EMPLOYEE OWN 360 PROFILE (#06 & #07) ================== */
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My Employee 360 Profile</h1>
            <p className="text-xs text-muted">
              View your job details, salary structure, attendance, leave balances, and update your
              phone or address.
            </p>
          </div>

          {toast && (
            <div className="rounded-xl bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {toast}
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-rose-500/15 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading || !emp360 ? (
            <div className="surface-card h-40 animate-pulse rounded-2xl p-6" />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Job & Salary Card */}
              <div className="surface-card rounded-2xl p-5 space-y-4 lg:col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{emp360.employee.fullName}</h2>
                    <p className="text-xs text-muted">
                      {emp360.employee.employeeCode} · {emp360.employee.email}
                    </p>
                  </div>
                  <StatusPill status={emp360.employee.employmentStatus} />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                  <div className="surface-subtle rounded-xl p-3">
                    <p className="text-muted">Department</p>
                    <p className="mt-1 font-bold">{emp360.employee.departmentId?.name || "-"}</p>
                  </div>
                  <div className="surface-subtle rounded-xl p-3">
                    <p className="text-muted">Designation</p>
                    <p className="mt-1 font-bold">{emp360.employee.designationId?.title || "-"}</p>
                  </div>
                  <div className="surface-subtle rounded-xl p-3">
                    <p className="text-muted">Joining Date</p>
                    <p className="mt-1 font-bold">{emp360.employee.joiningDate}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-color)]">
                  <h3 className="text-xs font-bold uppercase text-muted mb-2">
                    Monthly Salary Structure
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                    <div className="surface-subtle rounded-xl p-3">
                      <p className="text-muted">Basic</p>
                      <p className="mt-1 font-bold">
                        {currency} {Number(emp360.employee.salaryStructure?.basic).toLocaleString()}
                      </p>
                    </div>
                    <div className="surface-subtle rounded-xl p-3">
                      <p className="text-muted">HRA (40%)</p>
                      <p className="mt-1 font-bold">
                        {currency} {Number(emp360.employee.salaryStructure?.hra).toLocaleString()}
                      </p>
                    </div>
                    <div className="surface-subtle rounded-xl p-3">
                      <p className="text-muted">Medical (10%)</p>
                      <p className="mt-1 font-bold">
                        {currency}{" "}
                        {Number(emp360.employee.salaryStructure?.medical).toLocaleString()}
                      </p>
                    </div>
                    <div className="surface-subtle rounded-xl p-3">
                      <p className="text-muted">Monthly Gross</p>
                      <p className="mt-1 font-bold text-teal-600 dark:text-teal-400">
                        {currency} {Number(emp360.employee.salaryStructure?.gross).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Self-Service Contact Update (#06) */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    const res = await updateOwnContactApi({
                      phone: ownPhone,
                      address: ownAddress,
                    });
                    setToast(res.message);
                    void loadDirectory();
                  } catch (err) {
                    setError(getApiErrorMessage(err));
                  }
                }}
                className="surface-card rounded-2xl p-5 space-y-4"
              >
                <h2 className="text-sm font-bold">Update My Contact Info</h2>
                <div>
                  <label htmlFor="my-phone" className="block text-xs font-semibold mb-1">
                    Phone Number
                  </label>
                  <input
                    id="my-phone"
                    type="tel"
                    autoComplete="tel"
                    value={ownPhone}
                    onChange={(e) => setOwnPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="my-addr" className="block text-xs font-semibold mb-1">
                    Residential Address
                  </label>
                  <textarea
                    id="my-addr"
                    rows={3}
                    value={ownAddress}
                    onChange={(e) => setOwnAddress(e.target.value)}
                    placeholder="Street, City"
                    className="input-field"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">
                  Save Phone & Address
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* ================== ADMIN & HR EMPLOYEE DIRECTORY ================== */
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Employee Directory ({total})</h1>
              <p className="text-xs text-muted">
                Server-side search, filters, Employee 360 profile, salary structures, and CSV
                import/export.
              </p>
            </div>

            {isHr && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  className="btn-primary"
                >
                  + Register Employee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvReport(null);
                    setCsvOpen(true);
                  }}
                  className="btn-secondary"
                >
                  ⬆ CSV Import
                </button>
                <button
                  type="button"
                  onClick={() => void exportEmployeesCsvDownload()}
                  className="btn-secondary"
                >
                  ⬇ CSV Export
                </button>
              </div>
            )}
          </div>

          {lastCreatedLogin && (
            <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-4 text-xs">
              <strong>Employee Login Ready for {lastCreatedLogin.name}:</strong> Email:{" "}
              <code className="font-mono font-bold">{lastCreatedLogin.email}</code> · Temporary
              Password: <code className="font-mono font-bold">{lastCreatedLogin.tempPass}</code>{" "}
              (Employee will be required to change password on first sign-in.)
            </div>
          )}

          {toast && (
            <div className="rounded-xl bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {toast}
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-rose-500/15 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Search & Filters */}
          <div className="surface-card rounded-xl p-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="search"
              placeholder="Search name, code, or email..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              aria-label="Search employees"
              className="input-field sm:col-span-2"
            />
            <select
              value={departmentId}
              onChange={(e) => {
                setPage(1);
                setDepartmentId(e.target.value);
              }}
              aria-label="Filter by department"
              className="input-field"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              aria-label="Filter by status"
              className="input-field"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="exited">Exited</option>
            </select>
          </div>

          {/* Responsive Directory Table */}
          <div className="table-wrapper">
            <table
              className="stack-table"
              style={
                {
                  "--label-2": '"Code"',
                  "--label-3": '"Department"',
                  "--label-4": '"Monthly Gross"',
                  "--label-5": '"Status"',
                  "--label-6": '"Profile"',
                } as React.CSSProperties
              }
            >
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Monthly Gross</th>
                  <th>Status</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      {loading
                        ? "Loading employees..."
                        : "No employees found. HR can register employees or import via CSV."}
                    </td>
                  </tr>
                ) : (
                  employees.map((e) => (
                    <tr key={e._id}>
                      <th>
                        <div>
                          <p>{e.fullName}</p>
                          <p className="text-xs font-normal text-muted">{e.email}</p>
                        </div>
                      </th>
                      <td className="font-mono text-xs">{e.employeeCode}</td>
                      <td>
                        <p>{e.departmentId?.name || "-"}</p>
                        <p className="text-xs text-muted">{e.designationId?.title || ""}</p>
                      </td>
                      <td className="font-mono font-semibold">
                        {currency} {Number(e.salaryStructure?.gross || 0).toLocaleString()}
                      </td>
                      <td>
                        <StatusPill status={e.employmentStatus} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void open360(e._id)}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            360 Profile →
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOnboardingEmp({
                                _id: e._id,
                                fullName: e.fullName,
                                employeeCode: e.employeeCode,
                                departmentName: e.departmentId?.name,
                                designationTitle: e.designationId?.title,
                              });
                              setOnboardingOpen(true);
                            }}
                            title="Interactive Onboarding Checklist"
                            className="rounded-lg border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-1 text-xs font-bold text-teal-600 dark:text-teal-400 transition"
                          >
                            📋 Onboarding
                          </button>
                          <button
                            type="button"
                            onClick={() => void downloadOfferLetterPdf(e._id, e.employeeCode)}
                            title="Download Official Offer Letter PDF"
                            className="rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 transition"
                          >
                            📄 Offer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary py-1 px-3"
              >
                Previous
              </button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary py-1 px-3"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: HR REGISTER EMPLOYEE (#06) */}
      <ModalDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register New Employee"
        subtitle="Creates employee record, salary structure (Gross = 1.5x Basic), and first-time login"
        maxWidthClass="max-w-2xl"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const res = await registerEmployeeApi({
                employeeCode: empCode,
                fullName,
                email,
                phone,
                address,
                gender,
                departmentId: regDeptId,
                designationId: regDesigId || null,
                joiningDate,
                basicSalary: Number(basicSalary),
                temporaryPassword: tempPassword,
              });
              setLastCreatedLogin({
                name: res.employee.fullName,
                email: res.credentials.email,
                tempPass: res.credentials.temporaryPassword,
              });
              setToast("Employee registered and login created!");
              setFullName("");
              setEmail("");
              const nextNum = Number(empCode.replace(/\D/g, "") || 1) + 1;
              setEmpCode(`EMP${String(nextNum).padStart(3, "0")}`);
              setRegisterOpen(false);
              void loadDirectory();
            } catch (err) {
              setError(getApiErrorMessage(err));
            }
          }}
          className="space-y-4"
        >
          {departments.length === 0 && (
            <div className="rounded-lg bg-amber-500/15 p-3 text-xs text-amber-700 dark:text-amber-300">
              No departments exist yet! Ask Admin to create at least one department in Organization
              Setup first.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="re-code" className="block text-xs font-semibold mb-1">
                Employee Code *
              </label>
              <input
                id="re-code"
                required
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-name" className="block text-xs font-semibold mb-1">
                Full Name *
              </label>
              <input
                id="re-name"
                required
                placeholder="Sara Ahmed"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-email" className="block text-xs font-semibold mb-1">
                Work Email (Login ID) *
              </label>
              <input
                id="re-email"
                type="email"
                required
                placeholder="sara@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-pass" className="block text-xs font-semibold mb-1">
                Temporary Password *
              </label>
              <input
                id="re-pass"
                required
                minLength={6}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-dept" className="block text-xs font-semibold mb-1">
                Department *
              </label>
              <select
                id="re-dept"
                required
                value={regDeptId}
                onChange={(e) => setRegDeptId(e.target.value)}
                className="input-field"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="re-desig" className="block text-xs font-semibold mb-1">
                Designation
              </label>
              <select
                id="re-desig"
                value={regDesigId}
                onChange={(e) => setRegDesigId(e.target.value)}
                className="input-field"
              >
                <option value="">None / General</option>
                {designations.map((ds) => (
                  <option key={ds._id} value={ds._id}>
                    {ds.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="re-join" className="block text-xs font-semibold mb-1">
                Joining Date (YYYY-MM-DD) *
              </label>
              <input
                id="re-join"
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-gen" className="block text-xs font-semibold mb-1">
                Gender
              </label>
              <select
                id="re-gen"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="input-field"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="re-basic" className="block text-xs font-semibold mb-1">
                Monthly Basic Salary ({currency}) *
              </label>
              <input
                id="re-basic"
                type="number"
                min={1}
                required
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="surface-subtle rounded-xl p-3 flex flex-col justify-center text-xs">
              <span className="text-muted">Auto Gross = 1.5 × Basic (HRA 40% + Med 10%)</span>
              <span className="mt-0.5 text-sm font-bold text-teal-600 dark:text-teal-400">
                {currency} {computedRegGross.toLocaleString()} / month
              </span>
            </div>
            <div>
              <label htmlFor="re-phone" className="block text-xs font-semibold mb-1">
                Phone
              </label>
              <input
                id="re-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="re-addr" className="block text-xs font-semibold mb-1">
                Address
              </label>
              <input
                id="re-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRegisterOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={!regDeptId} className="btn-primary">
              Register & Create Login
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* MODAL 2: CSV IMPORT WITH DRY-RUN VALIDATION (#08) */}
      <ModalDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        title="CSV Employee Import (Dry-Run & Commit)"
        subtitle="Validates required fields, unique code/email, known department, ISO date, and salary > 0"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="btn-secondary cursor-pointer text-xs">
              📂 Load .csv File
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const txt = await file.text();
                    setCsvText(txt);
                    setCsvReport(null);
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const sampleDept = departments[0]?.name || "Engineering";
                setCsvText(
                  `employeeCode,fullName,email,department,joiningDate,basicSalary,gender\nEMP101,Bilal Khan,bilal@company.com,${sampleDept},2026-10-01,90000,male\nEMP102,Ayesha Noor,ayesha@company.com,${sampleDept},2026-10-05,110000,female`
                );
                setCsvReport(null);
              }}
              className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
            >
              Insert Sample CSV Template
            </button>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvReport(null);
            }}
            placeholder="employeeCode,fullName,email,department,joiningDate,basicSalary"
            aria-label="CSV content"
            className="input-field font-mono text-xs"
          />

          <div className="flex items-center gap-3">
            <label htmlFor="csv-pass" className="font-semibold shrink-0">
              Default Temp Password:
            </label>
            <input
              id="csv-pass"
              value={csvTempPass}
              onChange={(e) => setCsvTempPass(e.target.value)}
              className="input-field max-w-xs"
            />
          </div>

          {csvReport && (
            <div className="surface-subtle rounded-xl p-3.5 space-y-2">
              <p className="font-bold">
                {csvReport.dryRun ? "Dry-Run Validation Result:" : "Import Completed:"} Valid Rows:{" "}
                <span className="text-emerald-600">{csvReport.validCount ?? csvReport.importedCount}</span>{" "}
                · Errors: <span className="text-rose-600">{csvReport.errorCount}</span>
              </p>
              {(csvReport.errors || []).length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {csvReport.errors.map((errItem: any, i: number) => (
                    <p key={i} className="text-rose-600 dark:text-rose-400 font-mono">
                      Row {errItem.row} [{errItem.field}]: {errItem.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={!csvText.trim()}
              onClick={async () => {
                try {
                  const rep = await importEmployeesCsvApi({
                    csvText,
                    dryRun: true,
                    defaultTemporaryPassword: csvTempPass,
                  });
                  setCsvReport(rep);
                } catch (err) {
                  setError(getApiErrorMessage(err));
                }
              }}
              className="btn-secondary"
            >
              1. Run Dry-Run Check
            </button>
            <button
              type="button"
              disabled={!csvText.trim()}
              onClick={async () => {
                try {
                  const rep = await importEmployeesCsvApi({
                    csvText,
                    dryRun: false,
                    defaultTemporaryPassword: csvTempPass,
                  });
                  setCsvReport(rep);
                  setToast(`Imported ${rep.importedCount} employee(s)! Temp password: ${csvTempPass}`);
                  void loadDirectory();
                } catch (err) {
                  setError(getApiErrorMessage(err));
                }
              }}
              className="btn-primary"
            >
              2. Commit Valid Rows
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* MODAL 3: EMPLOYEE 360 & SALARY STRUCTURE (#07 & #14) */}
      <ModalDialog
        open={emp360Open && Boolean(emp360)}
        onClose={() => setEmp360Open(false)}
        title={emp360 ? `${emp360.employee.fullName} (${emp360.employee.employeeCode})` : "Employee 360"}
        subtitle={emp360 ? `${emp360.employee.email} · Joined ${emp360.employee.joiningDate}` : ""}
        maxWidthClass="max-w-3xl"
      >
        {emp360 && (
          <div className="space-y-5 text-xs">
            {/* HR Employment Status & Salary Structure Editor */}
            {isHr && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await updateEmployeeApi(emp360.employee._id, {
                      employmentStatus: editStatus,
                    });
                    setToast("Employment status updated");
                    void open360(emp360.employee._id);
                    void loadDirectory();
                  }}
                  className="surface-subtle rounded-xl p-3.5 space-y-2.5"
                >
                  <p className="font-bold">Employment Status</p>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    aria-label="Employment Status"
                    className="input-field"
                  >
                    <option value="active">Active</option>
                    <option value="probation">Probation</option>
                    <option value="exited">Exited (Deactivates Login)</option>
                  </select>
                  <button type="submit" className="btn-secondary w-full text-xs">
                    Update Status
                  </button>
                </form>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await updateSalaryStructureApi(emp360.employee._id, {
                      basic: Number(editBasic),
                      hraPercent: Number(editHraPct),
                      medicalPercent: Number(editMedPct),
                      otherAllowances: Number(editOtherAllow),
                    });
                    setToast("Salary structure updated");
                    void open360(emp360.employee._id);
                    void loadDirectory();
                  }}
                  className="surface-subtle rounded-xl p-3.5 space-y-2"
                >
                  <p className="font-bold">Salary Structure (#14)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted">Basic</label>
                      <input
                        type="number"
                        value={editBasic}
                        onChange={(e) => setEditBasic(e.target.value)}
                        className="input-field py-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted">Other Allow.</label>
                      <input
                        type="number"
                        value={editOtherAllow}
                        onChange={(e) => setEditOtherAllow(e.target.value)}
                        className="input-field py-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted">HRA %</label>
                      <input
                        type="number"
                        value={editHraPct}
                        onChange={(e) => setEditHraPct(e.target.value)}
                        className="input-field py-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted">Medical %</label>
                      <input
                        type="number"
                        value={editMedPct}
                        onChange={(e) => setEditMedPct(e.target.value)}
                        className="input-field py-1"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary w-full py-1.5 text-xs">
                    Save Salary Structure
                  </button>
                </form>
              </div>
            )}

            {/* Leave Balances */}
            <div>
              <h3 className="font-bold mb-2">Leave Balances</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(emp360.leaveBalances || []).map((b: any) => (
                  <div key={b.leaveTypeId} className="surface-subtle rounded-lg p-2.5">
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-sm font-bold">
                      {b.isUnlimited ? "Unlimited" : `${b.remaining} / ${b.quota}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance & Payslips */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-bold mb-2">Recent Attendance</h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(emp360.recentAttendance || []).length === 0 ? (
                    <p className="text-muted">No attendance records yet.</p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    emp360.recentAttendance.map((a: any) => (
                      <div
                        key={a._id}
                        className="surface-subtle flex items-center justify-between rounded-lg px-2.5 py-1.5"
                      >
                        <span className="font-mono">{a.date}</span>
                        <StatusPill status={a.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-2">Payslips</h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(emp360.payslips || []).length === 0 ? (
                    <p className="text-muted">No payslips yet.</p>
                  ) : (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    emp360.payslips.map((p: any) => (
                      <div
                        key={p._id}
                        className="surface-subtle flex items-center justify-between rounded-lg px-2.5 py-1.5"
                      >
                        <span>
                          {p.month}/{p.year} · Net {currency} {Number(p.netPay).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadPayslipPdf(
                              p._id,
                              emp360.employee.employeeCode,
                              p.year,
                              p.month
                            )
                          }
                          className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
                        >
                          PDF
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Official Corporate Letters (#Offer & #Experience) */}
              <div className="pt-2 border-t border-[var(--border-color)]">
                <h3 className="font-bold mb-2">Official Employment Documents</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void downloadOfferLetterPdf(
                        emp360.employee._id,
                        emp360.employee.employeeCode
                      )
                    }
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <span>📄</span>
                    <span>Download Offer Letter PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void downloadExperiencePdf(
                        emp360.employee._id,
                        emp360.employee.employeeCode
                      )
                    }
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <span>🎖️</span>
                    <span>Download Experience Certificate PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      <OnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        employee={selectedOnboardingEmp}
      />
    </AppShell>
  );
}

