// Tabs/PayslipsTab.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Table, Button, Space, Tag, message } from "antd";
import dayjs from "dayjs";
import api from "api/axios";
import PayrollResultModal from "../Modals/EmployeePayrollResultModal";

interface PayslipsTabProps {
  employeeId: number;
}

type EmployeePayrollRow = {
  employee_id: number;
  employee_full_name: string;
  department_name: string | null;

  period_id: number;
  period_code: string;
  period_start_date: string;
  period_end_date: string;
  pay_date: string | null;
  period_status: string;

  ppe_status: "Pending" | "Verified" | "Processing" | "Approved" | "Declined";
  declined_reason?: string | null;

  payroll_id: number | null;
  payroll_status: string | null;
  run_no: number | null;
  net_pay: string | null;
};

const PayslipsTab: React.FC<PayslipsTabProps> = ({ employeeId }) => {
  const [payrollRows, setPayrollRows] = useState<EmployeePayrollRow[]>([]);
  const [loadingPayrollRows, setLoadingPayrollRows] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [selectedPayrollRow, setSelectedPayrollRow] = useState<EmployeePayrollRow | null>(null);

  const fetchPayrolls = async () => {
    setLoadingPayrollRows(true);
    try {
      const res = await api.get("/payroll/employee-payrolls/", {
        params: { employee_id: employeeId }, // pass the employeeId from EmployeeDetailsPage
      });
      setPayrollRows(res.data || []);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || "Failed to fetch payrolls");
    } finally {
      setLoadingPayrollRows(false);
    }
  };

  useEffect(() => {
    if (!employeeId || isNaN(employeeId)) return; // skip if invalid
    fetchPayrolls();
  }, [employeeId]);

  const payrollStatusColor = (s?: string | null) => {
    const x = (s || "").toLowerCase();
    if (x === "approved") return "green";
    if (x === "disapproved") return "red";
    if (x === "paid") return "blue";
    if (x === "generated") return "gold";
    if (x === "void") return "default";
    return "default";
  };

  const ppeStatusColor = (s: EmployeePayrollRow["ppe_status"]) => {
    if (s === "Approved") return "green";
    if (s === "Declined") return "red";
    if (s === "Processing") return "gold";
    if (s === "Verified") return "blue";
    return "default";
  };

  const payrollColumns = useMemo(() => [
    {
      title: "Period",
      key: "period",
      render: (_: any, row: EmployeePayrollRow) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {dayjs(row.period_start_date).format("MMM D")} - {dayjs(row.period_end_date).format("MMM D, YYYY")}
        </span>
      ),
    },
    {
      title: "Pay Date",
      dataIndex: "pay_date",
      width: 110,
      render: (v: string | null) => (v ? dayjs(v).format("MM/DD/YYYY") : "-"),
    },
    {
      title: "Status",
      dataIndex: "ppe_status",
      width: 110,
      render: (v: EmployeePayrollRow["ppe_status"]) => <Tag color={ppeStatusColor(v)}>{v}</Tag>,
    },
    {
      title: "Payroll",
      dataIndex: "payroll_status",
      width: 100,
      render: (v: string | null) => (v ? <Tag color={payrollStatusColor(v)}>{v}</Tag> : "-"),
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      width: 120,
      align: "right" as const,
      render: (v: string | null) => (v ? v : "-"),
    },
  ], []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Employee Payroll</div>
        <Space>
          <Button size="small" onClick={fetchPayrolls} loading={loadingPayrollRows}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={payrollColumns as any}
        dataSource={payrollRows}
        rowKey={(row) => String(row.period_id)}
        size="small"
        loading={loadingPayrollRows}
        pagination={{ pageSize: 5 }}
        tableLayout="fixed"
        onRow={(row) => ({
          onClick: () => {
            setSelectedPayrollRow(row);
            setPayrollModalOpen(true);
          },
          style: { cursor: "pointer" },
        })}
        locale={{ emptyText: "No payroll records found." }}
      />

      <PayrollResultModal
        open={payrollModalOpen}
        onClose={() => {
          setPayrollModalOpen(false);
          setSelectedPayrollRow(null);
        }}
        employee={
          selectedPayrollRow
            ? {
                id: selectedPayrollRow.employee_id,
                full_name: selectedPayrollRow.employee_full_name,
                department_name: selectedPayrollRow.department_name || "-",
                status: selectedPayrollRow.ppe_status,
              }
            : null
        }
        period={
          selectedPayrollRow
            ? {
                id: selectedPayrollRow.period_id,
                code: selectedPayrollRow.period_code,
                start_date: selectedPayrollRow.period_start_date,
                end_date: selectedPayrollRow.period_end_date,
                pay_date: selectedPayrollRow.pay_date,
                status: selectedPayrollRow.period_status,
              }
            : null
        }
      />
    </div>
  );
};

export default PayslipsTab;