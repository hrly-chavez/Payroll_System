import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, message, Button } from "antd";
import dayjs from "dayjs";
import api from "api/axios";
import PayrollPeriodEmployeesModal from "./payroll_period_employees_modal";
import "./payroll_release_logs.css";

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date: string | null;
  status: string;
  created_at: string;
};

type Props = {
  selectedPeriodId: number | null;
  onSelectPeriodId: (id: number | null) => void;
};

const PayrollReleaseLogs: React.FC<Props> = ({ selectedPeriodId, onSelectPeriodId }) => {
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);

  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const res = await api.get("/payroll/reports/payroll-periods/");
      const data = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      setPeriods(data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load payroll periods");
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Code",
        dataIndex: "code",
        key: "code",
        render: (v: string) => <span className="pp-code">{v}</span>,
      },
      {
        title: "Period",
        key: "period",
        render: (_: any, r: PayrollPeriod) =>
          `${dayjs(r.start_date).format("MMM D, YYYY")} – ${dayjs(r.end_date).format("MMM D, YYYY")}`,
      },
      {
        title: "Pay Date",
        dataIndex: "pay_date",
        key: "pay_date",
        render: (v: string | null) => (v ? dayjs(v).format("MMM D, YYYY") : "—"),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (s: string) => {
          const color =
            s === "Paid" ? "green" : s === "Closed" ? "blue" : s === "Processing" ? "orange" : "default";
          return <Tag color={color}>{s}</Tag>;
        },
      },
      {
        title: "Employees",
        key: "employees",
        render: (_: any, r: PayrollPeriod) => (
          <Button
            type="link"
            onClick={() => {
              setSelectedPeriod(r);
              setOpenModal(true);
            }}
          >
            View Employees
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <>
      <Table
        rowKey="id"
        columns={columns as any}
        dataSource={periods}
        loading={loading}
        pagination={{ pageSize: 5 }}
        scroll={{ x: "max-content" }}
        rowSelection={{
          type: "radio",
          selectedRowKeys: selectedPeriodId ? [selectedPeriodId] : [],
          onChange: (keys) => {
            const id = (keys?.[0] as number) ?? null;
            onSelectPeriodId(id);
          },
        }}
      />

      <PayrollPeriodEmployeesModal
        open={openModal}
        period={selectedPeriod}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default PayrollReleaseLogs;