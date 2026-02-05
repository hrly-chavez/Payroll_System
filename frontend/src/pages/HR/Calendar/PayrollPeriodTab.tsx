"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, message } from "antd";
import dayjs from "dayjs";
import api from "../../../api/axios";

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
  active: boolean;          // parent tells if this tab is currently selected
  searchText: string;       // value from Input.Search
  onLoaded?: (count: number) => void; // optional callback
  refreshKey?: number;      // parent can bump this to force reload
};

export default function PayrollPeriodTab({
  active,
  searchText,
  onLoaded,
  refreshKey,
}: Props) {
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(false);

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

  // load when tab becomes active, and also when parent requests refresh
  useEffect(() => {
    if (active) {
      loadPayrollPeriods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refreshKey]);

  const payrollColumns = [
    { title: "Code", dataIndex: "code" },
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
    { title: "Status", dataIndex: "status" },
  ];

  const filtered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return payrollPeriods;

    return payrollPeriods.filter((p) => {
      return (
        p.code?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.start_date?.toLowerCase().includes(q) ||
        p.end_date?.toLowerCase().includes(q) ||
        (p.pay_date || "").toLowerCase().includes(q)
      );
    });
  }, [payrollPeriods, searchText]);

  return (
    <Table
      columns={payrollColumns}
      dataSource={filtered}
      rowKey="id"
      pagination={false}
      loading={loading}
    />
  );
}
