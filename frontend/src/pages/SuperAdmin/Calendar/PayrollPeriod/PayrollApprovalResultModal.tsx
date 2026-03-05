"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Descriptions, Tag, Table, Spin, Alert, message, Button, Space, Input } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";

type PayslipLine = {
  id: number;
  line_type: "EARNING" | "DEDUCTION" | "INFORMATION";
  description: string;
  amount: string;
  source_type?: string | null;
  source_id?: number | null;
  quantity_min?: number | null;
  rate_applied?: string | null;

  rule?: number | null;
  rule_name?: string | null;
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

  basic_pay: string;
  total_earnings: string;
  total_deductions: string;
  net_before_excess_tax: string;
  net_pay: string;

  lines: PayslipLine[];
};

type Props = {
  open: boolean;
  periodId: number | null;
  employeeId: number | null;
  onClose: () => void;
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

const ppeStatusColor = (s?: string) => {
  const x = (s || "").toLowerCase();
  if (x === "approved") return "green";
  if (x === "declined") return "red";
  if (x === "processing") return "gold";
  if (x === "verified") return "blue";
  if (x === "pending") return "default";
  return "default";
};

export default function PayrollApprovalResultModal({ open, periodId, employeeId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");


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
  const load = async () => {
    if (!open || !periodId || !employeeId) return;

    setResult(null);
    setErrorDetail(null);
    setLoading(true);
    try {
      const res = await api.get(`/payroll/periods/${periodId}/employees/${employeeId}/payroll-result/`);
      setResult(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load payroll result";
      setErrorDetail(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && periodId && employeeId) {
      load();
    } else if (!open) {
      setResult(null);
      setErrorDetail(null);
      setDeclineOpen(false);
      setDeclineReason("");
    }
  }, [open, periodId, employeeId]);

  const canApprove = result?.ppe_status === "Processing" && result?.payroll_status === "Generated";
  const canDecline = result?.ppe_status === "Processing" && result?.payroll_status === "Generated";

  const money = (v?: string) => {
    if (v === null || v === undefined || v === "") return "0.00";
    return v;
  };

  const lines = useMemo(() => {
    const raw = result?.lines || [];

    const typeOrder: Record<PayslipLine["line_type"], number> = {
        EARNING: 1,
        DEDUCTION: 2,
        INFORMATION: 3,
    };

    const extractDate = (desc?: string) => {
        if (!desc) return null;
        const m = desc.match(/\b\d{4}-\d{2}-\d{2}\b/);
        return m ? m[0] : null;
    };

    return [...raw].sort((a, b) => {
        const ta = typeOrder[a.line_type] ?? 99;
        const tb = typeOrder[b.line_type] ?? 99;
        if (ta !== tb) return ta - tb;

        const da = extractDate(a.description);
        const db = extractDate(b.description);

        if (da && db) return da.localeCompare(db);
        if (da && !db) return -1;
        if (!da && db) return 1;

        return (a.id ?? 0) - (b.id ?? 0);
    });
    }, [result]);

  const grouped = useMemo(() => {
    const earnings = lines.filter((l) => l.line_type === "EARNING");
    const deductions = lines.filter((l) => l.line_type === "DEDUCTION");
    const info = lines.filter((l) => l.line_type === "INFORMATION");
    return { earnings, deductions, info };
  }, [lines]);

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

  const handleApprove = async () => {
    if (!periodId || !employeeId) return;
    if (!canApprove) {
      message.error("Cannot approve. Employee must be Processing and payroll must be Generated.");
      return;
    }

    setActing(true);
    try {
      const res = await api.post(`/payroll/periods/${periodId}/employees/${employeeId}/approve/`);
      message.success(res?.data?.detail || "Payroll approved.");
      await load();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Approve failed";
      message.error(msg);
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!periodId || !employeeId) return;
    if (!canDecline) {
      message.error("Cannot decline. Employee must be Processing and payroll must be Generated.");
      return;
    }

    const reason = (declineReason || "").trim();
    if (!reason) {
      message.error("Decline reason is required.");
      return;
    }

    setActing(true);
    try {
      const res = await api.post(`/payroll/periods/${periodId}/employees/${employeeId}/decline/`, {
        declined_reason: reason,
      });
      message.success(res?.data?.detail || "Payroll declined.");
      setDeclineOpen(false);
      setDeclineReason("");
      await load();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Decline failed";
      message.error(msg);
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        title={result ? `Payroll Result: ${result.employee_full_name}` : "Payroll Result"}
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
        {loading ? (
          <div style={{ padding: 18, display: "flex", justifyContent: "center" }}>
            <Spin />
          </div>
        ) : !result ? (
          <Alert
            type="warning"
            showIcon
            message="No payroll result found"
            description={errorDetail || "Payroll may not have been generated yet for this employee in this period."}
          />
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: "1 1 360px", minWidth: 280 }}>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Employee ID">{result.employee_id}</Descriptions.Item>
                  <Descriptions.Item label="Department">{result.department_name || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Payroll Period">
                    {`${dayjs(result.period_start_date).format("MM/DD/YYYY")} - ${dayjs(result.period_end_date).format("MM/DD/YYYY")}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="PPE Status">
                    <Tag color={ppeStatusColor(result.ppe_status)}>{result.ppe_status}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </div>

              <div style={{ flex: "1 1 360px", minWidth: 280 }}>
                <Descriptions bordered size="small" column={1} title="Totals">
                  <Descriptions.Item label="Payroll ID">{result.payroll_id ?? "-"}</Descriptions.Item>
                  <Descriptions.Item label="Payroll Status">
                    <Tag color={payrollStatusColor(result.payroll_status)}>{result.payroll_status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Basic Pay">{money(result.basic_pay)}</Descriptions.Item>
                  <Descriptions.Item label="Total Earnings">{money(result.total_earnings)}</Descriptions.Item>
                  <Descriptions.Item label="Total Deductions">{money(result.total_deductions)}</Descriptions.Item>
                  {(() => {
                    const nbet = Number(result?.net_before_excess_tax ?? 0);
                    const net = Number(result?.net_pay ?? 0);

                    // show ONLY if there is an actual excess tax effect
                    if (!Number.isFinite(nbet) || !Number.isFinite(net)) return null;
                    if (Math.abs(nbet - net) < 0.0001) return null;

                    return (
                      <Descriptions.Item label="Net Before Excess Tax">
                        {money(result.net_before_excess_tax)}
                      </Descriptions.Item>
                    );
                  })()}

                  <Descriptions.Item label="Net Pay">
                    <span style={{ fontWeight: 700 }}>{money(result.net_pay)}</span>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <Space>
                <Button onClick={load} disabled={acting}>
                  Refresh
                </Button>
                <Button type="primary" onClick={handleApprove} disabled={!canApprove} loading={acting}>
                  Approve
                </Button>
                <Button danger onClick={() => setDeclineOpen(true)} disabled={!canDecline || acting}>
                  Decline
                </Button>
              </Space>
            </div>

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
      </Modal>

      <Modal
        open={declineOpen}
        onCancel={() => {
          setDeclineOpen(false);
          setDeclineReason("");
        }}
        onOk={handleDecline}
        okText="Submit Decline"
        confirmLoading={acting}
        title="Decline Payroll (Reason required)"
        destroyOnClose
      >
        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          This will set PPE to <b>Declined</b> and payroll to <b>Disapproved</b>.
        </div>
        <Input.TextArea
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          rows={4}
          placeholder="Enter decline reason..."
          maxLength={500}
          showCount
        />
      </Modal>
    </>
  );
}