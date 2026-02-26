//src/pages/Employee/Payslips/Payroll.tsx


import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import { Layout, Card, Table, Tag, Button, Space, message } from "antd";
import dayjs from "dayjs";
import api from "../../../api/axios";

import PayrollResultModal from "./PayrollResultModal";

const { Content } = Layout;

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

const Payroll: React.FC = () => {
  const [rows, setRows] = useState<EmployeePayrollRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<EmployeePayrollRow | null>(null);

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

  const fetchMyPayrolls = async () => {
    setLoading(true);
    try {
      const res = await api.get<EmployeePayrollRow[]>("/payroll/my-payrolls/");
      setRows(res.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load payslips.";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPayrolls();
  }, []);

 const columns = useMemo(() => {
  return [
    {
      title: "Payroll Period",
      key: "period",
      render: (_: any, row: EmployeePayrollRow) => (
        <span>
          {dayjs(row.period_start_date).format("MMM D")} -{" "}
          {dayjs(row.period_end_date).format("MMM D, YYYY")}
        </span>
      ),
    },
    {
      title: "Pay Date",
      dataIndex: "pay_date",
      render: (v: string | null) =>
        v ? dayjs(v).format("MM/DD/YYYY") : "-",
    },
    {
      title: "Employee Status",
      dataIndex: "ppe_status",
      render: (v: EmployeePayrollRow["ppe_status"]) => (
        <Tag color={ppeStatusColor(v)}>{v}</Tag>
      ),
    },
    {
      title: "Payroll Status",
      dataIndex: "payroll_status",
      render: (v: string | null) =>
        v ? <Tag color={payrollStatusColor(v)}>{v}</Tag> : "-",
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      align: "right" as const,
      render: (v: string | null) => (v ? v : "-"),
    },
  ];
}, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Payslips" />

        <Content style={{ margin: 16 }}>
          <Card>
            <Table
              columns={columns as any}
              dataSource={rows}
              rowKey={(row) => String(row.period_id)}
              loading={loading}
              scroll={{ x: "max-content" }}
              size="large"
              pagination={{ pageSize: 8 }}
              onRow={(row) => ({
                onClick: () => {
                  setSelectedRow(row);
                  setModalOpen(true);
                },
                style: { cursor: "pointer" },
              })}
              locale={{ emptyText: "No payslips found." }}
            />

            <PayrollResultModal
              open={modalOpen}
              onClose={() => {
                setModalOpen(false);
                setSelectedRow(null);
              }}
              employee={
                selectedRow
                  ? {
                      id: selectedRow.employee_id,
                      full_name: selectedRow.employee_full_name,
                      department_name: selectedRow.department_name || "-",
                      status: selectedRow.ppe_status,
                    }
                  : null
              }
              period={
                selectedRow
                  ? {
                      id: selectedRow.period_id,
                      code: selectedRow.period_code,
                      start_date: selectedRow.period_start_date,
                      end_date: selectedRow.period_end_date,
                      pay_date: selectedRow.pay_date,
                      status: selectedRow.period_status,
                    }
                  : null
              }
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Payroll;