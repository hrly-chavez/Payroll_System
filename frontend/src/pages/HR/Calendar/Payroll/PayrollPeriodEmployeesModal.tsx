//src/pages/HR/Calendar/Payroll/PayrollPeriodEmployeesModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Modal, Table, Button, message, Tag} from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";

import VerifyEmployeeModal from "./VerifyEmployeeModal";
import PayrollResultModal from "./PayrollResultModal";
import { Select } from "antd";

type Props = {
  open: boolean;
  periodId: number | null;
  onClose: () => void;
  onChanged?: () => void;
};

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: string;
};

type EligibleEmployee = {
  id: number;
  full_name: string;
  department_name?: string;
  status: "Pending" | "Verified" | "Processing" | "Approved" | "Declined";

  has_attendance?: boolean;
};


export default function PayrollPeriodEmployeesModal({ open, periodId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);

  
  const [openEmployeeModal, setOpenEmployeeModal] = useState(false);
  const [openPayrollResultModal, setOpenPayrollResultModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EligibleEmployee | null>(null);
  const [generating, setGenerating] = useState(false);

  const canGenerate = !!periodId && (period?.status === "Open");
  const verifiedCount = employees.filter((e) => e.status === "Verified").length;

  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);

  const loadEligibleEmployees = async () => {
    if (!periodId) return;

    setLoading(true);
    try {
      const res = await api.get(
        `/payroll/periods/${periodId}/eligible-employees/`,
        {
          params: departmentId ? { department_id: departmentId } : {},
        }
      );
      setPeriod(res.data.period);
      setEmployees(res.data.eligible_employees || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load eligible employees";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get("/payroll/departments/");
      setDepartments(res.data || []);
    } catch {
      message.error("Failed to load departments");
    }
  };

  useEffect(() => {
    if (open && periodId) {
      loadEligibleEmployees();
      loadDepartments();
    }
  }, [open, periodId, departmentId]);

  const columns = [
      {
        title: "Employee",
        dataIndex: "full_name",
        render: (_: any, row: EligibleEmployee) => {
          return (
            <div>
              <div>{row.full_name}</div>

              {row.has_attendance === false && (
                <Tag color="red">No Attendance</Tag>
              )}
            </div>
          );
        },
      },
    {
      title: "Department",
      dataIndex: "department_name",
      render: (v: string) => v || "-",
    },
    {
    title: "Status",
    dataIndex: "status",
    render: (v: EligibleEmployee["status"]) => {
      const status = v || "Pending";

      const map: Record<EligibleEmployee["status"], { text: string; color: string }> = {
        Pending: { text: "Pending", color: "default" },
        Verified: { text: "Verified", color: "blue" },
        Processing: { text: "Processing", color: "gold" },
        Approved: { text: "Approved", color: "green" },
        Declined: { text: "Declined", color: "red" },
      };

      const meta = map[status];
      return <Tag color={meta.color}>{meta.text}</Tag>;
    },
  },
  ];

  return (
    <Modal
  open={open}
  onCancel={onClose}
  footer={null}
  width={700}
  title={
    period
      ? `Payroll Period: ${dayjs(period.start_date).format("MM/DD/YYYY")} - ${dayjs(period.end_date).format("MM/DD/YYYY")}`
      : "Payroll Period"
  }
  style={{ top: 30 }}
  destroyOnClose
  styles={{
    body: {
      maxHeight: "calc(100vh - 180px)",
      overflowY: "auto",
      overflowX: "hidden",
    },
  }}
>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          {period ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Status: {period.status}
            </div>
          ) : null}
        </div>

        <Button
          type="primary"
          disabled={employees.length === 0 || period?.status !== "Open"}
          loading={generating}
          onClick={async () => {
            if (!periodId) return;

            if (verifiedCount === 0) {
              message.error("No Verified employees to generate payroll for.");
              return;
            }

            setGenerating(true);
            try {
              const res = await api.post(`/payroll/periods/${periodId}/generate/`);
              message.success(res?.data?.detail || "Payroll generated.");
              await loadEligibleEmployees();
            } catch (err: any) {
              let msg = "Payroll generation failed";

              const data = err?.response?.data;

              if (typeof data === "string") {
                if (data.includes("<html") || data.includes("Django")) {
                  msg = "Server error occurred. Please contact admin.";
                } else {
                  msg = data;
                }
              } else if (data?.detail) {
                msg = data.detail;
              } else if (data?.message) {
                msg = data.message;
              }

              message.error(msg);
              message.error(msg);
            } finally {
              setGenerating(false);
            }
          }}
        >
          Generate Payroll
        </Button>

      </div>
          <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <Select
              placeholder="Filter by Department"
              allowClear
              style={{ width: 220 }}
              value={departmentId ?? undefined}
              onChange={(value) => setDepartmentId(value || null)}
              options={departments.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
            />
          </div>
        <Table
        columns={columns}
        dataSource={employees}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ y: 360 }}
        onRow={(record) => ({
          onClick: () => {
            if (loading) return;

            if (record.has_attendance === false) {
              message.warning("This employee has no attendance for this payroll period.");
            }

            setSelectedEmployee(record);

            if (
              record.status === "Processing" ||
              record.status === "Approved" ||
              record.status === "Declined"
            ) {
              setOpenPayrollResultModal(true);
            } else {
              setOpenEmployeeModal(true);
            }
          },
        })}

        rowClassName={() => "clickable-row"}
      />
      <VerifyEmployeeModal
        open={openEmployeeModal}
        employee={selectedEmployee}
        period={period}
        onClose={() => {
          setOpenEmployeeModal(false);
          setSelectedEmployee(null);
        }}
        onVerified={() => {
          loadEligibleEmployees(); // refresh table status after verify
        }}
      />
      <PayrollResultModal
          open={openPayrollResultModal}
          employee={selectedEmployee}
          period={period}
          onClose={() => {
            setOpenPayrollResultModal(false);
            setSelectedEmployee(null);
            loadEligibleEmployees(); // refresh in case approvals changed
          }}
        />


    </Modal>
  );
}
