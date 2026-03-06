//src/pages/SuperAdmin/Calendar/PayrollPeriod/BulkDeclineModal.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Modal, Input } from "antd";

type DeclineEmployee = {
  employee_id: number;
  full_name: string;
  department_name?: string | null;
};

type Props = {
  open: boolean;
  employee: DeclineEmployee | null;
  loading?: boolean;
  initialReason?: string;
  currentIndex?: number;
  totalCount?: number;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export default function BulkDeclineModal({
  open,
  employee,
  loading = false,
  initialReason = "",
  currentIndex,
  totalCount,
  onCancel,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    if (open) {
      setReason(initialReason || "");
    } else {
      setReason("");
    }
  }, [open, initialReason, employee?.employee_id]);

  const handleOk = () => {
    const trimmed = (reason || "").trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={currentIndex !== undefined && totalCount !== undefined && currentIndex < totalCount - 1 ? "Next" : "Submit"}
      confirmLoading={loading}
      title="Decline Payroll"
      destroyOnClose
    >
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        {currentIndex !== undefined && totalCount !== undefined ? (
          <div style={{ marginBottom: 8, opacity: 0.75 }}>
            Decline {currentIndex + 1} of {totalCount}
          </div>
        ) : null}

        <div>
          Decline reason for: <b>{employee?.full_name || "-"}</b>
        </div>

        <div style={{ marginTop: 4, opacity: 0.8 }}>
          Department: <b>{employee?.department_name || "-"}</b>
        </div>
      </div>

      <Input.TextArea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={500}
        showCount
        placeholder="Enter decline reason..."
      />
    </Modal>
  );
}