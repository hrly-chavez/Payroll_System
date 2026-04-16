  //src/pages/Employee/Attendance/LoanRequest/RequestLoanLogs.tsx
  "use client";

  import React, { useEffect, useMemo, useState } from "react";
  import api from "../../../../api/axios";
  import { message, Spin, Tag, Empty, Modal } from "antd";
  import styles from "./RequestLoanLogs.module.css";

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

    //Modal
    const [selectedLoan, setSelectedLoan] = useState<LoanRequestRow | null>(null);
    const [open, setOpen] = useState(false);

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

    const handleOpen = (row: LoanRequestRow) => {
      setSelectedLoan(row);
      setOpen(true);
    };

    const handleClose = () => {
      setOpen(false);
      setSelectedLoan(null);
    };

    const content = useMemo(() => {
      if (loading) return <Spin />;

      if (!rows.length) {
        return <Empty description="No loan requests found." />;
      }

      return (
      <div className={styles.container}>
        {rows.map((row) => (
          <div
            key={row.id}
            className={styles.card} // ✅ CSS instead of inline
            onClick={() => handleOpen(row)} // ✅ CLICK HANDLER ADDED
          >
            <div className={styles.header}>
              <div>
                <div className={styles.name}>{row.name}</div>
                <div className={styles.rule}>
                  Rule:{" "}
                  {row.rule_name ||
                    (row.status === "Pending"
                      ? "Will be assigned upon approval"
                      : "Not assigned")}
                </div>
              </div>

              <div>{statusTag(row.status)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [loading, rows]);

  // =========================
  // FINAL RETURN
  // =========================
  return (
    <>
      <div>{content}</div>

      {/* ✅ MODAL ADDED */}
      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        title={null} // ✅ we will create custom header
      >
        {selectedLoan && (
          <>
            {/* ✅ CUSTOM HEADER */}
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{selectedLoan.name}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              {statusTag(selectedLoan.status)}
            </div>

            <div className={styles.divider} />

            {/* ✅ FINANCIAL INFO */}
            <div className={styles.modalSection}>
              <div className={styles.modalGrid}>
                <div className={styles.label}>Principal</div>
                <div className={`${styles.value} ${styles.money}`}>
                  {formatMoney(selectedLoan.principal_amount)}
                </div>

                <div className={styles.label}>Remaining</div>
                <div className={`${styles.value} ${styles.money}`}>
                  {formatMoney(selectedLoan.remaining_balance)}
                </div>

                <div className={styles.label}>Deduction</div>
                <div className={styles.value}>
                  {selectedLoan.deduction_mode
                    ? `${selectedLoan.deduction_mode} - ${formatDeductionValue(selectedLoan)}`
                    : "To be determined upon approval"}
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            {/* ✅ SCHEDULE INFO */}
            <div className={styles.modalSection}>
              <div className={styles.modalGrid}>
                <div className={styles.label}>Cutoff</div>
                <div className={styles.value}>
                  {formatCutoff(selectedLoan.apply_to_cutoff)}
                </div>

                <div className={styles.label}>Effective From</div>
                <div className={styles.value}>
                  {formatDateOnly(selectedLoan.effective_from)}
                </div>

                {selectedLoan.effective_to && (
                  <>
                    <div className={styles.label}>Effective To</div>
                    <div className={styles.value}>
                      {formatDateOnly(selectedLoan.effective_to)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ✅ REASON */}
            {selectedLoan.remarks !== null && selectedLoan.remarks !== undefined && (              
              <>
                <div className={styles.modalSection}>
                <div className={styles.modalGrid}>
                  <div className={styles.label}>Reason</div>
                  <div className={styles.value}>
                    {selectedLoan.remarks?.trim() || "No reason provided"}
                  </div>
                </div>
              </div>
              </>
            )}

            {/* ❌ DECLINED */}
            {selectedLoan.declined_reason && (
              <>
                <div className={styles.divider} />
                <div className={styles.danger}>
                  Declined: {selectedLoan.declined_reason}
                </div>
              </>
            )}

            {/* 🕒 TIMESTAMPS */}
            <div className={styles.divider} />
            <div className={styles.modalSection}>
              <div className={styles.modalGrid}>
                {selectedLoan.created_at && (
                  <>
                    <div className={styles.label}>Requested</div>
                    <div className={styles.value}>
                      {formatDateTime(selectedLoan.created_at)}
                    </div>
                  </>
                )}

                {selectedLoan.approved_at && (
                  <>
                    <div className={styles.label}>Reviewed</div>
                    <div className={styles.value}>
                      {formatDateTime(selectedLoan.approved_at)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}