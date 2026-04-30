//src/pages/Employee/Attendance/AttendanceLogs.tsx
//Employee
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, message, Spin } from "antd";
import dayjs from "dayjs";
import styles from "./Attendance.module.css";
import API from "../../../api/axios";

type Props = {
  year: number;
  month: number; // 1-12
};

type AttendanceLogRow = {
  id: number;
  date: string; // YYYY-MM-DD
  status: string;
  time_in: string | null;  // HH:mm:ss
  time_out: string | null; // HH:mm:ss
  shift_name: string | null;
  event_types: string; // "Late, UnderTime" or ""
};

export default function AttendaceLogs({ year, month }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AttendanceLogRow[]>([]);

  const columns = useMemo(
    () => [
      {
        title: "Date",
        dataIndex: "date",
        render: (val: string) => dayjs(val).format("MM/DD/YYYY"),
      },
      {
        title: "Punched In",
        dataIndex: "time_in",
        render: (_val: string | null, row: AttendanceLogRow) => {
          if (!_val) return "-";

          // if backend sends a full datetime (contains T or space), parse directly
          const isDateTime = _val.includes("T") || _val.includes(" ");
          if (isDateTime) return dayjs(_val).format("h:mm A");

          // if backend sends time-only, attach the row date so dayjs parses consistently
          return dayjs(`${row.date} ${_val}`, "YYYY-MM-DD HH:mm:ss").format("h:mm A");
        },
      },
      {
        title: "Punched Out",
        dataIndex: "time_out",
        render: (_val: string | null, row: AttendanceLogRow) => {
          if (!_val) return "-";

          const isDateTime = _val.includes("T") || _val.includes(" ");
          if (isDateTime) return dayjs(_val).format("h:mm A");

          return dayjs(`${row.date} ${_val}`, "YYYY-MM-DD HH:mm:ss").format("h:mm A");
        },
      },
      {
        title: "WorkShift",
        dataIndex: "shift_name",
        render: (val: string | null) => val || "-",
      },
      {
        title: "Status",
        dataIndex: "status",
      },
      {
        title: "Event",
        dataIndex: "event_types",
        render: (val: string) => (val ? val : "-"),
      },
    ],
    []
  );

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await API.get("/attendance/logs/", {
          params: { year, month },
        });
        setRows(res.data.results || []);
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.detail || "Failed to load attendance logs.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [year, month]);

  const sortedRows = [...rows].sort((a, b) => {
    return dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
  });

  return (
    <Card className={styles.historyCard}>
      {loading ? (
        <div style={{ padding: 16 }}>
          <Spin />
        </div>
      ) : (
        <Table
          rowKey="id"
          columns={columns as any}
          dataSource={sortedRows}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20"],
            showTotal: (total) => `Total ${total} records`,
          }}
        />
      )}
    </Card>
  );
}
