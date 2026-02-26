"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, message, Tag } from "antd";
import dayjs from "dayjs";
import api from "../../../api/axios";

export type Holiday = {
  id: number;
  name: string;
  date: string;
  type: string;
  base: string;
  status?: string;
};

type Props = {
  active: boolean;
  searchText: string;
  refreshKey?: number;
};

export default function HolidayTab({ active, searchText, refreshKey }: Props) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/holidays/");
      setHolidays(res.data);
    } catch (err) {
      message.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) {
      loadHolidays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refreshKey]);

  const getStatusTag = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "approved":
        return <Tag color="green">Approved</Tag>;
      case "declined":
      case "rejected":
        return <Tag color="red">Declined</Tag>;
      default:
        return <Tag color="gold">Pending</Tag>;
    }
  };

  const holidayColumns = [
    { title: "Holiday Name", dataIndex: "name" },
    {
      title: "Holiday Date",
      dataIndex: "date",
      render: (date: string) => dayjs(date).format("MM/DD/YYYY"),
    },
    { title: "Holiday Type", dataIndex: "type" },
    { title: "Holiday Base", dataIndex: "base" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) => getStatusTag(status),
    },
  ];

  const sortedHolidays = useMemo(() => {
  return [...holidays].sort((a, b) => {
    return dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
  });
}, [holidays]);

  const filtered = useMemo(() => {
  const q = (searchText || "").trim().toLowerCase();
  if (!q) return sortedHolidays;

  return sortedHolidays.filter((h) => {
    return (
      h.name?.toLowerCase().includes(q) ||
      h.type?.toLowerCase().includes(q) ||
      h.base?.toLowerCase().includes(q) ||
      h.date?.toLowerCase().includes(q) ||
      (h.status || "").toLowerCase().includes(q)
    );
  });
}, [sortedHolidays, searchText]);


  return (
    <Table
      columns={holidayColumns}
      dataSource={filtered}
      scroll={{ x: "max-content" }}
      rowKey="id"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["5", "10", "20", "50"],
        showTotal: (total) => `Total ${total} holidays`,
      }}
      loading={loading}
    />
  );
}
