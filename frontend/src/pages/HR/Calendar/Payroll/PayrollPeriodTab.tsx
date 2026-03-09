// src/pages/HR/Calendar/Payroll/PayrollPeriodTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, message, Select, Tag } from "antd";
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
  const markPeriodAsPaid = async (periodId: number) => {
    try {
      await api.patch(`/payroll/periods/${periodId}/mark-paid/`);
      message.success("Payroll period marked as Paid.");
      loadPayrollPeriods();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to update payroll period status.";
      message.error(msg);
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
      render: (_: string, record: PayrollPeriod) => {
        // Show dropdown only when Closed (allow only -> Paid)
        if (record.status === "Closed") {
          return (
            <Select
              value="Closed"
              style={{ width: 150 }}
              options={[
                { value: "Closed", label: "Closed", disabled: true },
                { value: "Paid", label: "Mark as Paid" },
              ]}
              onChange={(val) => {
                if (val === "Paid") markPeriodAsPaid(record.id);
              }}
              onClick={(e) => e.stopPropagation()} // prevents opening the row modal
            />
          );
        }

        // Otherwise show a tag
        const color =
          record.status === "Open"
            ? "blue"
            : record.status === "Processing"
            ? "orange"
            : record.status === "Paid"
            ? "green"
            : "default";

        return <Tag color={color}>{record.status}</Tag>;
      },
    },
  ];

  const filtered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();

    let data = [...payrollPeriods];

      //SORT NEWEST FIRST
      data.sort((a, b) => {
        const dateA = a.created_at || a.start_date;
        const dateB = b.created_at || b.start_date;
        return dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
      });

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
        scroll={{ x: "max-content" }}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20", "50"],
          showTotal: (total) => `Total ${total} items`,
        }}
        loading={loading}
        onRow={(record) => ({
          onClick: () => {
            if (!record?.id) return;
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
          loadPayrollPeriods(); // refresh table immediately
        }}
        onChanged={loadPayrollPeriods}
      />
    </>
  );
}
