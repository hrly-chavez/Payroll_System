//src/pages/HR/Calendar/Payroll/PayrollPeriodEmployeesModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Modal, Table, Button, message, Tag} from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";

import VerifyEmployeeModal from "./VerifyEmployeeModal";
import PayrollResultModal from "./PayrollResultModal";


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

  const loadEligibleEmployees = async () => {
    if (!periodId) return;

    setLoading(true);
    try {
      const res = await api.get(`/payroll/periods/${periodId}/eligible-employees/`);
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
  // const handleGeneratePayroll = async () => {
  //   if (!periodId) return;
  //   if (!canGenerate) {
  //     message.error("Payroll period must be Open to generate payroll.");
  //     return;
  //   }
  //   if (verifiedCount === 0) {
  //     message.error("No Verified employees to generate payroll for.");
  //     return;
  //   }

  //   setGenerating(true);
  //   try {
  //     const res = await api.post(`/payroll/payroll/periods/${periodId}/generate/`);
  //     message.success(res?.data?.detail || "Payroll generated.");

  //     // refresh list & statuses
  //     await loadEligibleEmployees();
  //   } catch (err: any) {
  //     const msg =
  //       err?.response?.data?.detail ||
  //       err?.response?.data?.message ||
  //       "Payroll generation failed";
  //     message.error(msg);

  //     // refresh anyway (in case something partially changed, though your backend rolls back)
  //     await loadEligibleEmployees();
  //   } finally {
  //     setGenerating(false);
  //   }
  // };

  useEffect(() => {
    if (open && periodId) {
      loadEligibleEmployees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodId]);

  const columns = [
    { title: "Employee", dataIndex: "full_name" },
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
      title={period
    ? `Payroll Period: ${dayjs(period.start_date).format("MM/DD/YYYY")} - ${dayjs(period.end_date).format("MM/DD/YYYY")}`: "Payroll Period"}
      style={{ top: 50 }}
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
              const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                "Payroll generation failed";
              message.error(msg);
            } finally {
              setGenerating(false);
            }
          }}
        >
          Generate Payroll
        </Button>

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
