import React, { useEffect, useMemo, useState } from "react";
import { Modal, Table, Tag, message, Input, Select } from "antd";
import dayjs from "dayjs";
import api from "api/axios";
import "./payroll_period_employees_modal.css";

const { Option } = Select;

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
};

type PeriodEmployee = {
  id: number;
  employee_name: string;
  status: "Pending" | "Verified" | "Processing" | "Approved" | "Declined" | string;
  verified_by_name: string;
  verified_at: string | null;
  approved_by_name: string;
  approved_at: string | null;
  declined_reason: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  period: PayrollPeriod | null;
  onClose: () => void;
};

const PayrollPeriodEmployeesModal: React.FC<Props> = ({ open, period, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PeriodEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  const fetchEmployees = async () => {
    if (!period?.id) return;
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (status) params.status = status;

      const res = await api.get(`/payroll/reports/payroll-periods/${period.id}/employees/`, { params });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      setRows(data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load period employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && period?.id) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period?.id]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchEmployees(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const columns = useMemo(
    () => [
      {
        title: "Employee",
        dataIndex: "employee_name",
        key: "employee_name",
        render: (v: string) => <span className="emp-name">{v}</span>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (s: string) => {
          const color =
            s === "Approved"
              ? "green"
              : s === "Processing"
              ? "blue"
              : s === "Verified"
              ? "cyan"
              : s === "Pending"
              ? "orange"
              : s === "Declined"
              ? "red"
              : "default";
          return <Tag color={color}>{s}</Tag>;
        },
      },
      {
        title: "Verified By",
        dataIndex: "verified_by_name",
        key: "verified_by_name",
        render: (v: string) => v || "—",
      },
      {
        title: "Verified At",
        dataIndex: "verified_at",
        key: "verified_at",
        render: (v: string | null) => (v ? dayjs(v).format("MMM D, YYYY • h:mm A") : "—"),
      },
      {
        title: "Approved By",
        dataIndex: "approved_by_name",
        key: "approved_by_name",
        render: (v: string) => v || "—",
      },
      {
        title: "Approved At",
        dataIndex: "approved_at",
        key: "approved_at",
        render: (v: string | null) => (v ? dayjs(v).format("MMM D, YYYY • h:mm A") : "—"),
      },
      {
        title: "Declined Reason",
        dataIndex: "declined_reason",
        key: "declined_reason",
        ellipsis: true,
        render: (v: string | null) => v || "—",
      },
    ],
    []
  );

  const title = period
    ? `Employees — ${period.code} (${dayjs(period.start_date).format("MMM D")} - ${dayjs(period.end_date).format(
        "MMM D, YYYY"
      )})`
    : "Employees";

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      width={1000}
      destroyOnClose
    >
      <div className="ppe-filters">
        <Input.Search
          placeholder="Search employee"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />

        <Select
          allowClear
          placeholder="Status"
          value={status}
          onChange={(v) => setStatus(v)}
          style={{ width: 200 }}
        >
          <Option value="Pending">Pending</Option>
          <Option value="Verified">Verified</Option>
          <Option value="Processing">Processing</Option>
          <Option value="Approved">Approved</Option>
          <Option value="Declined">Declined</Option>
        </Select>
      </div>

      <Table
        rowKey="id"
        columns={columns as any}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 8 }}
        // ✅ no scroll={{y}} so the modal won’t create that inner vertical scrollbar
      />
    </Modal>
  );
};

export default PayrollPeriodEmployeesModal;