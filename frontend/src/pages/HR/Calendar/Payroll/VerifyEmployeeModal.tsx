// src/pages/HR/Calendar/Payroll/VerifyEmployeeModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Descriptions, Tag, Table, Button, Alert, Spin, message, Row, Col, Space, Divider, Typography, Card } from "antd";
import api from "../../../../api/axios";
import AddCommission from "./AddCommission";
import { formatBackendTime } from "../../../helpers";
import dayjs from "dayjs";

const { Text } = Typography;

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
  crosses_midnight?: boolean;
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

  // NEW (run-specific)
  is_excluded_for_run?: boolean;
  exclusion_id?: number | null;
  exclusion_remarks?: string | null;
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

  // NEW
  is_excluded_for_run?: boolean;
  exclusion_id?: number | null;
  exclusion_remarks?: string | null;
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

type LeaveTypeMini = {
  id: number;
  name?: string;
  code?: string;
};

type LeaveRequestMini = {
  id: number;
  status: string;
  leave_type?: LeaveTypeMini | null;
};

type LeaveDayRow = {
  id: number;
  date: string;
  units: string | number;
  is_paid: boolean;
  pay_rate: string | number;
  leave_request?: LeaveRequestMini | null;
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
  leaves: LeaveDayRow[];
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
  const [generating, setGenerating] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // commissions
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [openCommissionModal, setOpenCommissionModal] = useState(false);

  const canVerify = status === "Pending";
  const canAddCommission = status === "Pending";

  const canGenerateEmployee =
    status === "Verified" && (period?.status === "Open" || period?.status === "Processing");

  const loadSnapshot = async () => {
    if (!open || !employee || !period) return;
    setSnapshot(null);
    setLoading(true);
    try {
      const res = await api.get(`/payroll/periods/${period.id}/employees/${employee.id}/verify-snapshot/`);
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
      const res = await api.get(`/payroll/periods/${period.id}/employees/${employee.id}/commissions/`);
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
      const res = await api.post(`/payroll/periods/${period.id}/employees/${employee.id}/verify/`);
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

  const handleGenerateEmployeePayroll = async () => {
      if (!employee || !period) return;
      if (!canGenerateEmployee) {
        message.error("Generate is allowed only when employee is Verified and period is Open.");
        return;
      }

      setGenerating(true);
      try {
        const res = await api.post(`/payroll/periods/${period.id}/employees/${employee.id}/generate/`);
        message.success(res?.data?.detail || "Payroll generated for this employee.");
        onVerified();
        onClose();
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Generate payroll failed";
        message.error(msg);
      } finally {
        setGenerating(false);
      }
    };
    const handleExcludeTax = async (row: Deduction) => {
    if (!employee || !period) return;

    try {
      await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/exclude-input/`,
        {
          source_type: "DEDUCTION",
          source_id: row.id,
        }
      );

      message.success("Tax excluded for this payroll run.");
      loadSnapshot(); // refresh UI
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to exclude tax";
      message.error(msg);
    }
  };

  const handleIncludeTax = async (row: Deduction) => {
    if (!employee || !period) return;

    try {
      await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/include-input/`,
        {
          source_type: "DEDUCTION",
          source_id: row.id,
        }
      );

      message.success("Tax restored for this payroll run.");
      loadSnapshot();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to restore tax";
      message.error(msg);
    }
  };
  const handleExcludeCommission = async (row: Commission) => {
  if (!employee || !period) return;

  try {
    await api.post(
      `/payroll/periods/${period.id}/employees/${employee.id}/exclude-input/`,
      {
        source_type: "COMMISSION",
        source_id: row.id,
      }
    );

    message.success("Commission excluded for this payroll run.");
    loadCommissions();
  } catch (err: any) {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      "Failed to exclude commission";
    message.error(msg);
  }
};

  const handleIncludeCommission = async (row: Commission) => {
    if (!employee || !period) return;

    try {
      await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/include-input/`,
        {
          source_type: "COMMISSION",
          source_id: row.id,
        }
      );

      message.success("Commission restored for this payroll run.");
      loadCommissions();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to restore commission";
      message.error(msg);
    }
  };

  useEffect(() => {
    if (open && employee?.id && period?.id) {
      loadSnapshot();
      loadCommissions();
    } else if (!open) {
      setSnapshot(null);
      setCommissions([]);
    }
  }, [open, employee?.id, period?.id]);

  const tableBoxStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    overflow: "hidden",
  };

  const sectionCardStyle: React.CSSProperties = {
    borderRadius: 12,
    marginBottom: 12,
  };

  const allowanceColumns = [
    { title: "Allowance", dataIndex: ["allowance_type", "name"], render: (v: string) => v || "-" },
    { title: "Amount", dataIndex: "amount", render: (v: string) => v || "0.00" },
    { title: "Frequency", dataIndex: "frequency", render: (v: string) => v || "-" },
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
    {
      title: "Status",
      render: (_: any, row: Deduction) =>
        row.is_excluded_for_run ? (
          <Tag color="red">Excluded</Tag>
        ) : (
          <Tag color="green">Included</Tag>
        ),
    },
    {
      title: "Action",
      render: (_: any, row: Deduction) => {
        if (row.is_excluded_for_run) {
          return (
            <Button size="small" onClick={() => handleIncludeTax(row)}>
              Restore
            </Button>
          );
        }

        return (
          <Button danger size="small" onClick={() => handleExcludeTax(row)}>
            X
          </Button>
        );
      },
    },
  ];

  const loanColumns = [
    {
      title: "Loan",
      dataIndex: ["deduction_type", "code"],
      render: (_: any, row: Deduction) => row?.deduction_type?.code || "Loan",
    },
    { title: "Amort/Period", dataIndex: "amortization_per_period", render: (v: string) => v || "-" },
    { title: "Balance", dataIndex: "balance", render: (v: string) => v || "-" },
  ];

  const commissionColumns = [
    {
      title: "Type",
      dataIndex: ["commission_type", "name"],
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
    {
      title: "Status",
      render: (_: any, row: Commission) =>
        row.is_excluded_for_run ? (
          <Tag color="red">Excluded</Tag>
        ) : (
          <Tag color="green">Included</Tag>
        ),
    },
    {
      title: "Action",
      render: (_: any, row: Commission) => {
        if (row.is_excluded_for_run) {
          return (
            <Button
              size="small"
              onClick={() => handleIncludeCommission(row)}
              disabled={status !== "Pending"}
            >
              Restore
            </Button>
          );
        }

        return (
          <Button
            danger
            size="small"
            onClick={() => handleExcludeCommission(row)}
            disabled={status !== "Pending"}
          >
            X
          </Button>
        );
      },
    },
  ];

  const attendanceColumns = [
    { title: "Date", dataIndex: "date", render: (v: string) => v || "-" },
    { title: "Status", dataIndex: "status", render: (v: string) => v || "-" },
    { title: "Time In", dataIndex: "time_in", render: (v: string | null) => (v ? formatBackendTime(v) : "-") },
    { title: "Time Out", dataIndex: "time_out", render: (v: string | null) => (v ? formatBackendTime(v) : "-") },
  ];

  const attendanceEventColumns = [
    { title: "Type", dataIndex: "type", render: (v: string) => v || "-" },
    { title: "Minutes", dataIndex: "minutes", render: (v: number) => v ?? 0 },
    { title: "Start", dataIndex: "start_time", render: (v: string | null) => (v ? formatBackendTime(v) : "-") },
    { title: "End", dataIndex: "end_time", render: (v: string | null) => (v ? formatBackendTime(v) : "-") },
    { title: "Approval", dataIndex: "approval_status", render: (v: string) => v || "-" },
    { title: "Remarks", dataIndex: "event_remarks", render: (v: string) => v || "-" },
  ];

  const leaveColumns = [
    {
      title: "Date",
      dataIndex: "date",
      render: (v: string) => {
        if (!v) return "-";
        const d = dayjs(v);
        return d.isValid() ? d.format("YYYY-MM-DD") : v;
      },
    },
    { title: "Leave Type", dataIndex: ["leave_request", "leave_type", "name"], render: (v: string) => v || "-" },
    { title: "Units", dataIndex: "units", render: (v: any) => v ?? "-" },
    {
      title: "Paid?",
      dataIndex: "is_paid",
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Paid" : "Unpaid"}</Tag>,
    },
    { title: "Pay Rate", dataIndex: "pay_rate", render: (v: any) => v ?? "-" },
  ];

  const headerPeriodText = useMemo(() => {
    if (!period) return "-";
    return `${dayjs(period.start_date).format("YYYY-MM-DD")} to ${dayjs(period.end_date).format("YYYY-MM-DD")}`;
  }, [period]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={980}
      title={employee ? `Verify Employee: ${employee.full_name}` : "Verify Employee"}
      style={{ top: 40 }}
      destroyOnClose
    >
      {!employee ? null : (
        <>
          {/* Header */}
          <Card style={{ ...sectionCardStyle, marginBottom: 14 }} bodyStyle={{ padding: 16 }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={16}>
                <Descriptions bordered size="small" column={2} labelStyle={{ width: 140 }}>
                  <Descriptions.Item label="Employee ID">{employee.id}</Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={map[status].color}>{map[status].text}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">{employee.department_name || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Payroll Period">{headerPeriodText}</Descriptions.Item>
                </Descriptions>
              </Col>

              <Col xs={24} md={8}>
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Button type="primary" block onClick={handleVerify} disabled={!canVerify} loading={verifying}>
                    Verify Employee
                  </Button>

                  <Button block onClick={() => setOpenCommissionModal(true)} disabled={!canAddCommission || !period}>
                    Add Commission
                  </Button>

                  <Button
                    type="primary"
                    block
                    onClick={handleGenerateEmployeePayroll}
                    disabled={!canGenerateEmployee || verifying}
                    loading={generating}
                  >
                    Generate Payroll (Employee)
                  </Button>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {status !== "Pending"
                      ? "Commissions are locked once the employee is Verified."
                      : "This will mark the employee as Verified for this payroll period."}
                  </Text>
                </Space>
              </Col>
            </Row>
          </Card>

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

              {/* Shift + Salary */}
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Card title="Shift" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Shift">{snapshot?.shift?.name || "-"}</Descriptions.Item>
                      <Descriptions.Item label="Time">
                        {snapshot?.shift ? `${snapshot.shift.start_time} - ${snapshot.shift.end_time}` : "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Break / Grace">
                        {snapshot?.shift
                          ? `${snapshot.shift.break_minutes} mins break, ${snapshot.shift.grace_minutes} mins grace`
                          : "-"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card title="Salary" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Pay Type">{snapshot?.salary?.pay_type || "-"}</Descriptions.Item>
                      <Descriptions.Item label="Base Rate">{snapshot?.salary?.base_rate || "-"}</Descriptions.Item>
                      <Descriptions.Item label="Effective From">
                        {snapshot?.salary?.effective_from ? dayjs(snapshot.salary.effective_from).format("YYYY-MM-DD") : "-"}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>

              {/* Taxes + Loans */}
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Card title="Taxes" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                    <div style={tableBoxStyle}>
                      <Table
                        columns={taxColumns}
                        dataSource={snapshot?.taxes || []}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: "No tax deductions found" }}
                      />
                    </div>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card title="Loans" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                    <div style={tableBoxStyle}>
                      <Table
                        columns={loanColumns}
                        dataSource={snapshot?.loans || []}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        locale={{ emptyText: "No loans found" }}
                      />
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Commissions */}
              <Card title="Commissions" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                <div style={tableBoxStyle}>
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
              </Card>

              {/* Allowances */}
              <Card title="Allowances" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                <div style={tableBoxStyle}>
                  <Table
                    columns={allowanceColumns}
                    dataSource={snapshot?.allowances || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No allowances found" }}
                  />
                </div>
              </Card>

              {/* Leaves */}
              <Card title="Approved Leaves (This Payroll Period)" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                <div style={tableBoxStyle}>
                  <Table
                    columns={leaveColumns as any}
                    dataSource={snapshot?.leaves || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No approved leaves in this period" }}
                  />
                </div>
              </Card>

              {/* Attendance */}
              <Card title="Attendance (This Payroll Period)" style={sectionCardStyle} bodyStyle={{ padding: 14 }}>
                <div style={tableBoxStyle}>
                  <Table
                    columns={attendanceColumns}
                    dataSource={snapshot?.attendances || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No attendance found in this period" }}
                    expandable={{
                      expandedRowRender: (row: AttendanceRow) => (
                        <div style={{ padding: 10 }}>
                          <Divider style={{ margin: "0 0 10px 0" }} />
                          <div style={tableBoxStyle}>
                            <Table
                              columns={attendanceEventColumns}
                              dataSource={row.events || []}
                              rowKey="id"
                              pagination={false}
                              size="small"
                              locale={{ emptyText: "No events" }}
                            />
                          </div>
                        </div>
                      ),
                      rowExpandable: (row: AttendanceRow) => (row.events?.length || 0) > 0,
                    }}
                  />
                </div>
              </Card>

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