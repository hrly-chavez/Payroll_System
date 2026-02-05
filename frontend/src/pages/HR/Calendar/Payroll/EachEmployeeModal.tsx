// src/pages/HR/Calendar/Payroll/EachEmployeeModal.tsx
"use client";

import React from "react";
import { Modal, Descriptions, Tag } from "antd";

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

type Props = {
  open: boolean;
  employee: EligibleEmployee | null;
  period: PayrollPeriod | null;
  onClose: () => void;
};

export default function EachEmployeeModal({ open, employee, period, onClose }: Props) {
  const status = employee?.status || "Pending";

  const map: Record<EligibleEmployee["status"], { text: string; color: string }> = {
    Pending: { text: "Pending", color: "default" },
    Verified: { text: "Verified", color: "blue" },
    Processing: { text: "Processing", color: "gold" },
    Approved: { text: "Approved", color: "green" },
    Declined: { text: "Declined", color: "red" },
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      title={employee ? `Employee: ${employee.full_name}` : "Employee"}
      style={{ top: 80 }}
      destroyOnClose
    >
      {employee ? (
        <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Employee ID">{employee.id}</Descriptions.Item>
        <Descriptions.Item label="Department">{employee.department_name || "-"}</Descriptions.Item>

        <Descriptions.Item label="Payroll Period">
            {period ? `${period.start_date} - ${period.end_date}` : "-"}
        </Descriptions.Item>

        <Descriptions.Item label="Status">
            <Tag color={map[status].color}>{map[status].text}</Tag>
        </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>
  );
}
