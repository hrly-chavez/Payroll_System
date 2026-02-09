// src/pages/HR/Calendar/Payroll/VerifyEmployeeModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Modal, Descriptions, Tag, Table, Button, Alert, Spin, message } from "antd";
import api from "../../../../api/axios";

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

type Shift = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
  is_overnight: boolean;
  workdays: { day_of_week: number; day: string; is_workday: boolean }[];
};

type Salary = {
  id: number;
  pay_type: "Monthly" | "Per Period" | "Daily" | "Hourly";
  base_rate: string;
  effective_from: string;
};

type DeductionType = {
  id: number;
  code: string;
  category?: "TAX" | "OTHER";
  calculation_type: "Fixed" | "Percent";
  amount: string;
  salary_range_from: string;
  salary_range_to: string;
};

type Deduction = {
  id: number;
  amount: string;
  frequency: "Monthly" | "Per Period" | "One Time";
  effective_from: string;
  effective_to?: string | null;
  status: "Active" | "Inactive";
  deduction_type?: DeductionType | null;

  total_loan_amount?: string | null;
  balance?: string | null;
  amortization_per_period?: string | null;
};

type Snapshot = {
  period_id: number;
  employee_id: number;
  full_name: string;
  department_name?: string | null;
  status: string;
  shift: Shift | null;
  salary: Salary | null;
  taxes: Deduction[];
  loans: Deduction[];
  warnings?: string[];
};

type Props = {
  open: boolean;
  employee: EligibleEmployee | null;
  period: PayrollPeriod | null;
  onClose: () => void;
  onVerified: () => void;
};

export default function VerifyEmployeeModal({ open, employee, period, onClose, onVerified }: Props) {
  const status = employee?.status || "Pending";

  const map: Record<EligibleEmployee["status"], { text: string; color: string }> = {
    Pending: { text: "Pending", color: "default" },
    Verified: { text: "Verified", color: "blue" },
    Processing: { text: "Processing", color: "gold" },
    Approved: { text: "Approved", color: "green" },
    Declined: { text: "Declined", color: "red" },
  };

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const canVerify = status === "Pending";

  const loadSnapshot = async () => {
    if (!open || !employee || !period) return;
    setSnapshot(null);
    setLoading(true);
    try {
      const res = await api.get(
        `/payroll/periods/${period.id}/employees/${employee.id}/verify-snapshot/`
      );
      setSnapshot(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load employee verification details";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!employee || !period) return;
    if (!canVerify) return;

    setVerifying(true);
    try {
      const res = await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/verify/`
      );
      message.success(res?.data?.detail || "Employee verified.");
      onVerified();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to verify employee";
      message.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSnapshot();
    } else {
      setSnapshot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id, period?.id]);

  const taxColumns = [
    {
      title: "Tax Type",
      dataIndex: ["deduction_type", "code"],
      render: (v: string) => v || "-",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: string) => v || "0.00",
    },
    {
      title: "Frequency",
      dataIndex: "frequency",
      render: (v: string) => v || "-",
    },
  ];

  const loanColumns = [
    {
      title: "Loan",
      dataIndex: ["deduction_type", "code"],
      render: (_: any, row: Deduction) => row?.deduction_type?.code || "Loan",
    },
    {
      title: "Amort/Period",
      dataIndex: "amortization_per_period",
      render: (v: string) => v || "-",
    },
    {
      title: "Balance",
      dataIndex: "balance",
      render: (v: string) => v || "-",
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      title={employee ? `Verify Employee: ${employee.full_name}` : "Verify Employee"}
      style={{ top: 60 }}
      destroyOnClose
    >
      {!employee ? null : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
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
            </div>

            <div style={{ width: 220 }}>
              <Button
                type="primary"
                block
                onClick={handleVerify}
                disabled={!canVerify}
                loading={verifying}
              >
                Verify Employee
              </Button>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                {canVerify ? "This will mark the employee as Verified for this payroll period." : "Employee is not in Pending status."}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 18, display: "flex", justifyContent: "center" }}>
              <Spin />
            </div>
          ) : (
            <>
              {snapshot?.warnings?.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Warnings"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {snapshot.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  }
                  style={{ marginBottom: 12 }}
                />
              ) : null}

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <Descriptions bordered size="small" column={1} title="Shift">
                    <Descriptions.Item label="Shift">
                      {snapshot?.shift?.name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Time">
                      {snapshot?.shift ? `${snapshot.shift.start_time} - ${snapshot.shift.end_time}` : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Break / Grace">
                      {snapshot?.shift
                        ? `${snapshot.shift.break_minutes} mins break, ${snapshot.shift.grace_minutes} mins grace`
                        : "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                <div style={{ flex: 1 }}>
                  <Descriptions bordered size="small" column={1} title="Salary">
                    <Descriptions.Item label="Pay Type">
                      {snapshot?.salary?.pay_type || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Base Rate">
                      {snapshot?.salary?.base_rate || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Effective From">
                      {snapshot?.salary?.effective_from || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Taxes</div>
                  <Table
                    columns={taxColumns}
                    dataSource={snapshot?.taxes || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No tax deductions found" }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Loans</div>
                  <Table
                    columns={loanColumns}
                    dataSource={snapshot?.loans || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No loans found" }}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
