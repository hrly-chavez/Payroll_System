// src/pages/HR/Calendar/Payroll/VerifyEmployeeModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Modal, Descriptions, Tag, Table, Button, Alert, Spin, message } from "antd";
import api from "../../../../api/axios";
import AddCommission from "./AddCommission";
import { formatBackendTime } from "../../../helpers";
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

type AllowanceType = {
  id: number;
  code: string;
  name: string;
};

type Allowance = {
  id: number;
  amount: string;
  frequency: "Monthly" | "Per Period" | "One Time";
  effective_from: string;
  effective_to?: string | null;
  status: "Active" | "Inactive";
  allowance_type: AllowanceType;
};
type CommissionType = {
  id: number;
  name: string;
  code: string;
  is_taxable: boolean;
  is_active: boolean;
};

type Commission = {
  id: number;
  commission_type: CommissionType;
  amount: string;
  remarks?: string | null;
  created_at: string;
};

type AttendanceEvent = {
  id: number;
  type: string;
  minutes: number;
  start_time?: string | null;
  end_time?: string | null;
  approval_status: "Pending" | "Approved" | "Declined";
  event_remarks?: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "REST_DAY" | "HOLIDAY";
  time_in?: string | null;
  time_out?: string | null;
  events: AttendanceEvent[];
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
  allowances: Allowance[];
  attendances: AttendanceRow[]; 
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

    // commissions
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [openCommissionModal, setOpenCommissionModal] = useState(false);

  const canVerify = status === "Pending";
  const canAddCommission = status === "Pending";


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

  const loadCommissions = async () => {
    if (!open || !employee || !period) return;
    setCommissionLoading(true);
    try {
      const res = await api.get(
        `/payroll/periods/${period.id}/employees/${employee.id}/commissions/`
      );
      setCommissions(res.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load commissions";
      message.error(msg);
    } finally {
      setCommissionLoading(false);
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
      loadCommissions();
    } else {
      setSnapshot(null);
      setCommissions([]);
    }
  }, [open, employee?.id, period?.id]);

  const allowanceColumns = [
    {
      title: "Allowance",
      dataIndex: ["allowance_type", "name"],
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
  const commissionColumns = [
    {
      title: "Type",
      dataIndex: ["commission_type", "name"],
      render: (v: string) => v || "-",
    },
    {
      title: "Code",
      dataIndex: ["commission_type", "code"],
      render: (v: string) => v || "-",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: string) => v || "0.00",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      render: (v: string) => v || "-",
    },
  ];
  const attendanceColumns = [
    {
      title: "Date",
      dataIndex: "date",
      render: (v: string) => v || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v: string) => v || "-",
    },
    {
      title: "Time In",
      dataIndex: "time_in",
      render: (v: string | null) =>
        v ? formatBackendTime(v) : "-",
    },
    {
      title: "Time Out",
      dataIndex: "time_out",
      render: (v: string | null) =>
        v ? formatBackendTime(v) : "-",
    },
    
  ];

  const attendanceEventColumns = [
    {
      title: "Type",
      dataIndex: "type",
      render: (v: string) => v || "-",
    },
    {
      title: "Minutes",
      dataIndex: "minutes",
      render: (v: number) => (v ?? 0),
    },
    {
     title: "Start",
    dataIndex: "start_time",
    render: (v: string | null) =>
      v ? formatBackendTime(v) : "-",
    },
    {
      title: "End",
      dataIndex: "end_time",
      render: (v: string | null) =>
        v ? formatBackendTime(v) : "-",
    },
    {
      title: "Approval",
      dataIndex: "approval_status",
      render: (v: string) => v || "-",
    },
    {
      title: "Remarks",
      dataIndex: "event_remarks",
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

              <Button
                style={{ marginTop: 8 }}
                block
                onClick={() => setOpenCommissionModal(true)}
                disabled={!canAddCommission || !period}
              >
                Add Commission
              </Button>

              {status !== "Pending" ? (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Commissions are locked once the employee is Verified.
                </div>
              ) : null}



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

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
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

              <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Allowances</div>
              <Table
                columns={allowanceColumns}
                dataSource={snapshot?.allowances || []}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No allowances found" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Attendance (This Payroll Period)</div>
              <Table
                columns={attendanceColumns}
                dataSource={snapshot?.attendances || []}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No attendance found in this period" }}
                expandable={{
                  expandedRowRender: (row: AttendanceRow) => (
                    <Table
                      columns={attendanceEventColumns}
                      dataSource={row.events || []}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      locale={{ emptyText: "No events" }}
                    />
                  ),
                  rowExpandable: (row: AttendanceRow) => (row.events?.length || 0) > 0,
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Commissions</div>
              <Table
                columns={commissionColumns}
                dataSource={commissions}
                rowKey="id"
                pagination={false}
                size="small"
                loading={commissionLoading}
                locale={{ emptyText: "No commissions added" }}
              />
            </div>


              <AddCommission
                open={openCommissionModal}
                period={period}
                employee={employee}
                onClose={() => setOpenCommissionModal(false)}
                onSaved={() => {
                  loadCommissions();
                }}
              />


            </>
          )}
        </>
      )}
    </Modal>
  );
}
