"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, message } from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import PayrollApprovalEmployeesModal from "./PayrollApprovalEmployeesModal";
import "./PayrollPeriod.module.css";

export type PayrollPeriodTab = {
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
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodTab[]>([]);
  const [loading, setLoading] = useState(false);

  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [openApprovalModal, setOpenApprovalModal] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  const loadPayrollPeriods = async () => {
    setLoading(true);
    try {
      const res = await api.get("/payroll/periods/");
      setPayrollPeriods(res.data);
      onLoaded?.(Array.isArray(res.data) ? res.data.length : 0);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load payroll periods";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) {
      loadPayrollPeriods();
      setCurrentPage(1);
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

    let data = [...payrollPeriods];

    // CEO/SUPERADMIN view: show only Processing periods
    data = data.filter((p) => p.status === "Processing");

    // SORT NEWEST FIRST
    data.sort((a, b) => {
      const dateA = a.created_at || a.start_date;
      const dateB = b.created_at || b.start_date;
      return dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
    });

    if (!q) return data;

    return data.filter((p) =>
      [p.code, p.status, p.start_date, p.end_date, p.pay_date]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [payrollPeriods, searchText]);

  return (
    <>
      <Table
        className="superadmin-table"
        columns={payrollColumns as any}
        dataSource={filtered}
        rowKey="id"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20", "50"],
          showTotal: (total) => `Total ${total} items`,
        }}
        onChange={(pagination) => {
          setCurrentPage(pagination.current || 1);
          setPageSize(pagination.pageSize || 10);
        }}
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
            if (!record?.id) return;
            setSelectedPeriodId(record.id);
            setOpenApprovalModal(true);
          },
        })}
        rowClassName={() => "clickable-row"}
      />

      <PayrollApprovalEmployeesModal
        open={openApprovalModal}
        periodId={selectedPeriodId}
        onClose={() => {
          setOpenApprovalModal(false);
          setSelectedPeriodId(null);
        }}
      />
    </>
  );
}