// src/pages/HR/Calendar/Payroll/PayrollResultModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Descriptions, Tag, Table, Spin, Alert, message, Button, Space, Input } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";


type EligibleEmployee = {
  id: number;
  full_name: string;
  department_name?: string;
  status: "Pending" | "Verified" | "Processing" | "Approved" | "Declined";
};

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: string;
};

type PayslipLine = {
  id: number;
  line_type: "EARNING" | "DEDUCTION" | "INFORMATION";
  description: string;
  amount: string;
  source_type?: string | null;
  source_id?: number | null;
  quantity_min?: number | null;
  rate_applied?: string | null;
  created_at?: string;

  rule?: number | null;
  rule_name?: string | null;
  rule_event_type?: string | null;
  rule_category?: string | null;
};

type PayrollResult = {
  payroll_id: number;
  payroll_status: string;

  period_id: number;
  period_code: string;
  period_start_date: string;
  period_end_date: string;

  employee_id: number;
  employee_full_name: string;
  department_name?: string | null;

  ppe_status: string;
  declined_reason?: string | null;

  basic_pay: string;
  total_earnings: string;
  total_deductions: string;
  net_pay: string;

  lines: PayslipLine[];
};

type Props = {
  open: boolean;
  employee: EligibleEmployee | null;
  period: PayrollPeriod | null;
  onClose: () => void;
};

export default function PayrollResultModal({ open, employee, period, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const status = (employee?.status || "Processing") as EligibleEmployee["status"];
  // reset after decline
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetting, setResetting] = useState(false);

  const canReset =
    !!period?.id &&
    !!employee?.id &&
    ((result?.ppe_status || status) === "Declined");

  const handleResetAfterDecline = async () => {
    if (!period?.id || !employee?.id) return;
    if (!canReset) {
      message.error("Reset is allowed only when employee status is Declined.");
      return;
    }

    setResetting(true);
    try {
      const res = await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/reset-after-decline/`,
        { void_reason: (resetReason || "").trim() || null }
      );

      message.success(res?.data?.detail || "Employee reset to Pending. Previous payroll voided.");
      setResetOpen(false);
      setResetReason("");

      // Close modal so the parent table refresh can happen via onClose()
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Reset failed";
      message.error(msg);
    } finally {
      setResetting(false);
    }
  };
  const formatNightDiffInfoDescription = (text: string) => {
    // Supports:
    // "Night Differential days: 2026-01-01, 2026-01-02"
    // "Night Differential days (cont.): 2026-02-03, 2026-02-04"
    const m = (text || "").match(/^Night Differential days(?:\s*\(cont\.\))?:\s*(.*)$/);
    if (!m) return null;

    const title = "Night Differential days:";
    const raw = (m[1] || "").trim();

    if (!raw) return { title, formatted: [], rawDates: [] as string[] };

    const rawDates = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const formatted = rawDates.map((d) => {
      const parsed = dayjs(d, "YYYY-MM-DD", true);
      return parsed.isValid() ? parsed.format("MMM DD, YYYY") : d;
    });

    return { title, formatted, rawDates };
  };


  const statusMap: Record<EligibleEmployee["status"], { text: string; color: string }> = {
    Pending: { text: "Pending", color: "default" },
    Verified: { text: "Verified", color: "blue" },
    Processing: { text: "Processing", color: "gold" },
    Approved: { text: "Approved", color: "green" },
    Declined: { text: "Declined", color: "red" },
  };

  const payrollStatusColor = (s?: string) => {
    const x = (s || "").toLowerCase();
    if (x === "approved") return "green";
    if (x === "disapproved") return "red";
    if (x === "paid") return "blue";
    if (x === "generated") return "gold";
    if (x === "void") return "default";
    return "default";
  };

  const loadPayrollResult = async () => {
    if (!open || !employee?.id || !period?.id) return;

    setResult(null);
    setErrorDetail(null);
    setLoading(true);

    try {
        const res = await api.get(
        `/payroll/periods/${period.id}/employees/${employee.id}/payroll-result/`
        );
        setResult(res.data);
    } catch (err: any) {
        const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load payroll result";
        setErrorDetail(msg);

        // optional toast (keep if you want)
        // message.error(msg);
    } finally {
        setLoading(false);
    }
    };

  useEffect(() => {
    if (open && employee?.id && period?.id) {
      loadPayrollResult();
    } else if (!open) {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id, period?.id]);

  const lines = useMemo(() => {
    const raw = result?.lines || [];

    const typeOrder: Record<PayslipLine["line_type"], number> = {
      EARNING: 1,
      DEDUCTION: 2,
      INFORMATION: 3,
    };

    const extractDate = (desc?: string) => {
      if (!desc) return null;
      // matches YYYY-MM-DD anywhere in the description
      const m = desc.match(/\b\d{4}-\d{2}-\d{2}\b/);
      return m ? m[0] : null;
    };

    return [...raw].sort((a, b) => {
      // 1) type grouping
      const ta = typeOrder[a.line_type] ?? 99;
      const tb = typeOrder[b.line_type] ?? 99;
      if (ta !== tb) return ta - tb;

      // 2) within same type, sort by embedded date if present
      const da = extractDate(a.description);
      const db = extractDate(b.description);
      if (da && db) return da.localeCompare(db);
      if (da && !db) return -1;
      if (!da && db) return 1;

      // 3) otherwise keep stable-ish
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }, [result]);

  const grouped = useMemo(() => {
    const earnings = lines.filter((l) => l.line_type === "EARNING");
    const deductions = lines.filter((l) => l.line_type === "DEDUCTION");
    const info = lines.filter((l) => l.line_type === "INFORMATION");
    return { earnings, deductions, info };
  }, [lines]);

  const money = (v?: string) => {
    if (v === null || v === undefined || v === "") return "0.00";
    return v;
  };

  const lineColumns = [
    {
      title: "Type",
      dataIndex: "line_type",
      width: 120,
      render: (v: PayslipLine["line_type"]) => {
        const map: Record<PayslipLine["line_type"], { text: string; color: string }> = {
          EARNING: { text: "Earning", color: "green" },
          DEDUCTION: { text: "Deduction", color: "red" },
          INFORMATION: { text: "Info", color: "blue" },
        };
        const meta = map[v];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      render: (v: string, row: PayslipLine) => {
        const ruleLabel = row.rule_name ? ` (${row.rule_name})` : "";

        // Pretty format Night Differential INFO dates
        if (row.line_type === "INFORMATION") {
          const info = formatNightDiffInfoDescription(v || "");
          if (info) {
            return (
              <div>
                <div style={{ fontWeight: 600 }}>{info.title}</div>

                {info.formatted.length > 0 ? (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {info.formatted.map((label, idx) => (
                      <Tag key={`${info.rawDates[idx]}-${idx}`}>{label}</Tag>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>-</div>
                )}

                {ruleLabel ? (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{ruleLabel}</div>
                ) : null}
              </div>
            );
          }
        }

        // Default rendering for all other lines
        return (
          <div>
            <div>{v || "-"}</div>

            {row.source_type ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Source: {row.source_type}
                {row.source_id ? ` #${row.source_id}` : ""}
                {ruleLabel}
              </div>
            ) : ruleLabel ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>{ruleLabel}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Minutes",
      dataIndex: "quantity_min",
      width: 110,
      align: "right" as const,
      render: (v: number | null | undefined) => (v === null || v === undefined ? "-" : v),
    },
    {
      title: "Rate",
      dataIndex: "rate_applied",
      width: 120,
      align: "right" as const,
      render: (v: string | null | undefined) => (v ? v : "-"),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      width: 140,
      align: "right" as const,
      render: (v: string) => money(v),
    },
  ];

  return (
    <>
    <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        title={employee ? `Payroll Result: ${employee.full_name}` : "Payroll Result"}
        centered
        destroyOnClose
        width="min(1100px, calc(100vw - 24px))"
        style={{ top: 12 }}
        styles={{
          body: {
            padding: 12,
            maxHeight: "calc(100vh - 120px)",
            overflow: "auto",
          },
        }}
      >
      {!employee || !period ? null : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: "1 1 360px", minWidth: 280 }}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Employee ID">{employee.id}</Descriptions.Item>
                <Descriptions.Item label="Department">{employee.department_name || "-"}</Descriptions.Item>
                <Descriptions.Item label="Payroll Period">
                  {period
                    ? `${dayjs(period.start_date).format("MM/DD/YYYY")} - ${dayjs(period.end_date).format("MM/DD/YYYY")}`
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Employee Status">
                  <Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Payroll Period Status">
                  <Tag color={period.status === "Open" ? "blue" : period.status === "Processing" ? "gold" : "default"}>
                    {period.status}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            <div style={{ flex: "1 1 360px", minWidth: 280 }}>
              <Descriptions bordered size="small" column={1} title="Totals">
                <Descriptions.Item label="Payroll ID">{result?.payroll_id ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="Payroll Status">
                  {result?.payroll_status ? (
                    <Tag color={payrollStatusColor(result.payroll_status)}>{result.payroll_status}</Tag>
                  ) : (
                    "-"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Basic Pay">{money(result?.basic_pay)}</Descriptions.Item>
                <Descriptions.Item label="Total Earnings">{money(result?.total_earnings)}</Descriptions.Item>
                <Descriptions.Item label="Total Deductions">{money(result?.total_deductions)}</Descriptions.Item>
                <Descriptions.Item label="Net Pay">
                  <span style={{ fontWeight: 700 }}>{money(result?.net_pay)}</span>
                </Descriptions.Item>
              </Descriptions>
               {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <Space>
                    <Button onClick={loadPayrollResult} disabled={loading || resetting}>
                      Refresh
                    </Button>

                    <Button
                      danger
                      onClick={() => setResetOpen(true)}
                      disabled={!canReset || loading || resetting}
                    >
                      Reset After Decline
                    </Button>
                  </Space>
                </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 18, display: "flex", justifyContent: "center" }}>
              <Spin />
            </div>
          ) : !result ? (
            <Alert
                type="warning"
                showIcon title="No payroll result found"
                description={errorDetail || "Payroll may not have been generated yet for this employee in this period."}
            />
            ) : (
            <>
             {/* Decline Reason (only if declined) */}
            {result && (result.ppe_status === "Declined" || (result.payroll_status || "").toLowerCase() === "disapproved") ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}  
              message="Declined Reason"
              description={result.declined_reason ? result.declined_reason : "No reason provided."}
            />
          ) : null}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Payslip Lines</div>
                <Table
                  columns={lineColumns as any}
                  dataSource={lines}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: "No payslip lines found" }}
                  
                />
              </div>

              {grouped.info.length > 0 ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Note: INFORMATION lines are shown for audit/reference and do not affect totals.
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </Modal>
     {/* Reset After Decline Modal */}
    <Modal
      open={resetOpen}
      onCancel={() => {
        if (resetting) return;
        setResetOpen(false);
        setResetReason("");
      }}
      onOk={handleResetAfterDecline}
      okText="Confirm Reset"
      confirmLoading={resetting}
      title="Reset After Decline"
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        message="This will void the latest active payroll run for this employee and reset the employee back to Pending."
        style={{ marginBottom: 12 }}
      />

      <div style={{ marginBottom: 6, fontSize: 12, opacity: 0.8 }}>
        Optional: add a void reason (for audit trail).
      </div>

      <Input.TextArea
        value={resetReason}
        onChange={(e) => setResetReason(e.target.value)}
        rows={4}
        placeholder="Void reason (optional)..."
        maxLength={500}
        showCount
      />
    </Modal>
    </>
  );
}
