  //src/pages/Employee/Attendance/LoanRequest/RequestLoanLogs.tsx
  "use client";

  import React, { useEffect, useMemo, useState } from "react";
  import { message, Spin, Tag, Empty } from "antd";
  import api from "../../../../api/axios";

  import dayjs from "dayjs";

  type Props = {
    refreshKey?: number;
  };

  type LoanRequestRow = {
    id: number;
    rule: number | null;
    rule_name?: string | null;
    name: string;
    principal_amount: string;
    remaining_balance: string;
    deduction_mode?: "FIXED" | "PERCENT" | null;
    deduction_value?: string | null;
    apply_to_cutoff?: "FIRST" | "SECOND" | "BOTH" | null;
    effective_from: string;
    effective_to: string | null;
    status: "Pending" | "Approved" | "Active" | "Completed" | "Cancelled";
    remarks?: string | null;
    declined_reason?: string | null;
    approved_at?: string | null;
    created_at?: string | null;
  };

    

  const extractDRFError = (err: any): string => {
    const data = err?.response?.data;

    if (!data) return err?.message || "Unknown error";
    if (typeof data === "string") return data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data)) return data.map(String).join(" ");
    if (typeof data === "object") {
      return Object.entries(data)
        .map(([key, val]) =>
          `${key}: ${Array.isArray(val) ? val.join(" ") : String(val)}`
        )
        .join(" | ");
    }

    return "Unknown error format";
  };

  export default function RequestLoanLogs({ refreshKey = 0 }: Props) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<LoanRequestRow[]>([]);

    const fetchLoans = async () => {
      setLoading(true);
      try {
        const res = await api.get("/approvals/loans/");
        const sorted = [...(res.data || [])].sort((a: any, b: any) => b.id - a.id);
        setRows(sorted);
      } catch (error: any) {
        console.error(error);
        message.error(extractDRFError(error));
      } finally {
        setLoading(false);
      }
    };
    const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    const d = dayjs(value);
      if (!d.isValid()) return value;

      // Example: Mar 21, 2026 • 7:21 AM
      return d.format("MMM DD, YYYY • h:mm A");
    };

    const formatDateOnly = (value?: string | null) => {
      if (!value) return "-";

      const d = dayjs(value);
      if (!d.isValid()) return value;

      // Example: Mar 21, 2026
      return d.format("MMM DD, YYYY");
    };
    useEffect(() => {
      fetchLoans();
    }, [refreshKey]);

    const formatMoney = (val: any) => {
      const num = Number(val ?? 0);
      if (!Number.isFinite(num)) return String(val ?? "");
      return `₱${num.toFixed(2)}`;
    };

    const formatDeductionValue = (row: LoanRequestRow) => {
      if (!row.deduction_mode || row.deduction_value === null || row.deduction_value === undefined) {
        return "To be determined upon approval";
      }

      const num = Number(row.deduction_value);
      if (!Number.isFinite(num)) return String(row.deduction_value ?? "");

      if (row.deduction_mode === "PERCENT") {
        return `${(num * 100).toFixed(2)}%`;
      }

      return formatMoney(num);
    };

    const formatCutoff = (value?: string | null) => {
      if (!value) return "To be determined upon approval";
      if (value === "FIRST") return "First Cutoff";
      if (value === "SECOND") return "Second Cutoff";
      if (value === "BOTH") return "Both";
      return value;
    };

    const statusTag = (status: LoanRequestRow["status"]) => {
      switch (status) {
        case "Pending":
          return <Tag color="gold">Pending</Tag>;
        case "Approved":
          return <Tag color="blue">Approved</Tag>;
        case "Active":
          return <Tag color="green">Active</Tag>;
        case "Completed":
          return <Tag color="default">Completed</Tag>;
        case "Cancelled":
          return <Tag color="red">Cancelled</Tag>;
        default:
          return <Tag>{status}</Tag>;
      }
    };

    const content = useMemo(() => {
      if (loading) return <Spin />;

      if (!rows.length) {
        return <Empty description="No loan requests found." />;
      }

      return (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 10,
                padding: 16,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{row.name}</div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    Rule: {row.rule_name || (row.status === "Pending" ? "Will be assigned upon approval" : "Not assigned")}
                  </div>
                </div>

                <div>{statusTag(row.status)}</div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>Principal Amount:</strong> {formatMoney(row.principal_amount)}
                </div>
                <div>
                  <strong>Remaining Balance:</strong> {formatMoney(row.remaining_balance)}
                </div>
                <div>
                  <strong>Deduction:</strong>{" "}
                  {row.deduction_mode
                    ? `${row.deduction_mode} - ${formatDeductionValue(row)}`
                    : "To be determined upon approval"}
                </div>
                <div>
                  <strong>Apply To Cutoff:</strong> {formatCutoff(row.apply_to_cutoff)}
                </div>
                <div>
                  <strong>Effective From:</strong> {formatDateOnly(row.effective_from)}
                </div>

                {row.effective_to && (
                  <div>
                    <strong>Effective To:</strong> {formatDateOnly(row.effective_to)}
                  </div>
                )}

                {row.remarks && (
                  <div>
                    <strong>Remarks:</strong> {row.remarks}
                  </div>
                )}

                {row.declined_reason && (
                  <div style={{ color: "#cf1322" }}>
                    <strong>Declined Reason:</strong> {row.declined_reason}
                  </div>
                )}

                {row.created_at && (
                  <div>
                    <strong>Requested At:</strong> {formatDateTime(row.created_at)}
                  </div>
                )}

                {row.approved_at && (
                  <div>
                    <strong>Reviewed At:</strong> {formatDateTime(row.approved_at)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }, [loading, rows]);

    return <div>{content}</div>;
  }