// src/pages/HR/Calendar/Payroll/PayrollPeriodTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, message } from "antd";
import PayrollPeriodEmployeesModal from "./PayrollPeriodEmployeesModal";
import dayjs from "dayjs";
import api from "../../../../api/axios";

export type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: "Open" | "Processing" | "Closed" | "Paid";
  color?: string;
  created_at?: string;
};

type Props = {
  active: boolean;
  searchText: string;
  onLoaded?: (count: number) => void;
  refreshKey?: number;
};

export default function PayrollPeriodTab({
  active,
  searchText,
  onLoaded,
  refreshKey,
}: Props) {
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  const [openEmployeesModal, setOpenEmployeesModal] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  const loadPayrollPeriods = async () => {
    setLoading(true);
    try {
      const res = await api.get("/payroll/periods/");
      setPayrollPeriods(res.data);
      onLoaded?.(Array.isArray(res.data) ? res.data.length : 0);
    } catch (err) {
      message.error("Failed to load payroll periods");
    } finally {
      setLoading(false);
    }
  };

  // Load when tab becomes active or refreshKey changes
  useEffect(() => {
    if (active) {
      loadPayrollPeriods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refreshKey]);

  const payrollColumns = [
    {
      title: "Start Date",
      dataIndex: "start_date",
      render: (d: string) => dayjs(d).format("MM/DD/YYYY"),
    },
    {
      title: "End Date",
      dataIndex: "end_date",
      render: (d: string) => dayjs(d).format("MM/DD/YYYY"),
    },
    {
      title: "Pay Date",
      dataIndex: "pay_date",
      render: (d: string) => (d ? dayjs(d).format("MM/DD/YYYY") : "-"),
    },
    {
      title: "Status",
      dataIndex: "status",
    },
  ];

  const filtered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return payrollPeriods;

    return payrollPeriods.filter((p) =>
      [
        p.code,
        p.status,
        p.start_date,
        p.end_date,
        p.pay_date,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [payrollPeriods, searchText]);

  return (
    <>
      <Table
        columns={payrollColumns}
        dataSource={filtered}
        rowKey="id"
        pagination={false}
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
            setSelectedPeriodId(record.id);
            setOpenEmployeesModal(true);
          },
        })}
        rowClassName={() => "clickable-row"}
      />

      <PayrollPeriodEmployeesModal
        open={openEmployeesModal}
        periodId={selectedPeriodId}
        onClose={() => {
          setOpenEmployeesModal(false);
          setSelectedPeriodId(null);
        }}
      />
    </>
  );
}
