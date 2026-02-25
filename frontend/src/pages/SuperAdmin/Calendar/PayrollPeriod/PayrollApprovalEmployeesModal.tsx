"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Table, Tag, message, Select, Input, Button, Space } from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import PayrollApprovalResultModal from "./PayrollApprovalResultModal";

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: string;
};

type ApprovalEmployeeRow = {
  employee_id: number;
  full_name: string;
  department_name?: string | null;

  ppe_status: string;

  payroll_id?: number | null;
  payroll_status?: string | null;
  run_no?: number | null;
  net_pay?: string | null;
};

type Props = {
  open: boolean;
  periodId: number | null;
  onClose: () => void;
};

const ppeTag = (s?: string) => {
  const x = (s || "").toLowerCase();
  if (x === "approved") return <Tag color="green">Approved</Tag>;
  if (x === "declined") return <Tag color="red">Declined</Tag>;
  if (x === "processing") return <Tag color="gold">Processing</Tag>;
  if (x === "verified") return <Tag color="blue">Verified</Tag>;
  if (x === "pending") return <Tag color="default">Pending</Tag>;
  return <Tag>{s || "-"}</Tag>;
};

const payrollTag = (s?: string | null) => {
  const x = (s || "").toLowerCase();
  if (x === "approved") return <Tag color="green">Approved</Tag>;
  if (x === "disapproved") return <Tag color="red">Disapproved</Tag>;
  if (x === "paid") return <Tag color="blue">Paid</Tag>;
  if (x === "generated") return <Tag color="gold">Generated</Tag>;
  if (x === "void") return <Tag color="default">Void</Tag>;
  return <Tag>{s || "-"}</Tag>;
};

export default function PayrollApprovalEmployeesModal({ open, periodId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [rows, setRows] = useState<ApprovalEmployeeRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<"Processing" | "Approved" | "Declined" | "All">("Processing");
  const [searchText, setSearchText] = useState("");

  const [openResult, setOpenResult] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const loadQueue = async () => {
    if (!open || !periodId) return;

    setLoading(true);
    try {
      const res = await api.get(`/payroll/periods/${periodId}/approval-queue/`, {
        params: { status: statusFilter },
      });

      setPeriod(res.data?.period || null);
      setRows(res.data?.employees || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load approval queue";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && periodId) {
      loadQueue();
    } else if (!open) {
      setPeriod(null);
      setRows([]);
      setSelectedEmployeeId(null);
      setOpenResult(false);
      setStatusFilter("Processing");
      setSearchText("");
    }
  }, [open, periodId]);

  useEffect(() => {
    if (open && periodId) {
      loadQueue();
    }
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) =>
      [r.full_name, r.department_name, r.ppe_status, r.payroll_status, String(r.run_no ?? "")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchText]);

  const columns = [
    { title: "Employee", dataIndex: "full_name" },
    {
      title: "Department",
      dataIndex: "department_name",
      render: (v: string) => v || "-",
    },
    {
      title: "PPE Status",
      dataIndex: "ppe_status",
      width: 130,
      render: (v: string) => ppeTag(v),
    },
    {
      title: "Payroll Status",
      dataIndex: "payroll_status",
      width: 140,
      render: (v: string) => payrollTag(v),
    },
    {
      title: "Run",
      dataIndex: "run_no",
      width: 80,
      align: "right" as const,
      render: (v: number | null) => (v ?? "-"),
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      width: 120,
      align: "right" as const,
      render: (v: string | null) => (v ? v : "-"),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: any, row: ApprovalEmployeeRow) => (
        <Button
          size="small"
          disabled={!row.employee_id}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEmployeeId(row.employee_id);
            setOpenResult(true);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const title = period
    ? `Approval Queue: ${dayjs(period.start_date).format("MM/DD/YYYY")} - ${dayjs(period.end_date).format("MM/DD/YYYY")}`
    : "Approval Queue";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={980}
      title={title}
      style={{ top: 50 }}
      destroyOnClose
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <Space wrap>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Period Status: <b>{period?.status || "-"}</b>
          </div>

          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 160 }}
            options={[
              { value: "Processing", label: "Processing" },
              { value: "Approved", label: "Approved" },
              { value: "Declined", label: "Declined" },
              { value: "All", label: "All" },
            ]}
          />

          <Input
            placeholder="Search employee / department / status..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
        </Space>

        <Button onClick={loadQueue} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        columns={columns as any}
        dataSource={filtered}
        rowKey="employee_id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20", "50"],
          showTotal: (total) => `Total ${total} items`,
        }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedEmployeeId(record.employee_id);
            setOpenResult(true);
          },
        })}
        rowClassName={() => "clickable-row"}
      />

      <PayrollApprovalResultModal
        open={openResult}
        periodId={periodId}
        employeeId={selectedEmployeeId}
        onClose={() => {
          setOpenResult(false);
          setSelectedEmployeeId(null);
          loadQueue(); // refresh list after approve/decline
        }}
      />
    </Modal>
  );
}