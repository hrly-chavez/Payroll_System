// src/pages/Reports/Attendance Logs/attendance_logs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, message, Button, Tooltip } from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import "./attendance_logs.css";

type AttendanceCorrectionLog = {
  id: number;
  requested_at: string;
  date: string | null;
  issue_type: string;
  status: "Pending" | "Verified" | "Declined" | string;
  reason: string;
  decline_reason: string | null;
  reviewed_at: string | null;
  employee_name: string;
  reviewed_by_name: string;
  file_url: string | null;
};

const AttendanceLogs: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AttendanceCorrectionLog[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("employees/reports/attendance-corrections/");
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to load attendance correction logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Requested At",
        dataIndex: "requested_at",
        key: "requested_at",
        render: (v: string) => (v ? dayjs(v).format("MMM D, YYYY • h:mm A") : ""),
      },
      {
        title: "Attendance Date",
        dataIndex: "date",
        key: "date",
        render: (v: string | null) => (v ? dayjs(v).format("MMM D, YYYY") : "—"),
      },
      {
        title: "Employee",
        dataIndex: "employee_name",
        key: "employee_name",
        render: (v: string) => <span className="emp">{v}</span>,
      },
      {
        title: "Issue Type",
        dataIndex: "issue_type",
        key: "issue_type",
        render: (v: string) => <span className="issue">{v}</span>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (s: string) => {
          const color =
            s === "Verified" ? "green" : s === "Pending" ? "orange" : s === "Declined" ? "red" : "default";
          return <Tag color={color}>{s}</Tag>;
        },
      },
      {
        title: "Reviewed By",
        dataIndex: "reviewed_by_name",
        key: "reviewed_by_name",
        render: (v: string) => v || "—",
      },
      {
        title: "Reviewed At",
        dataIndex: "reviewed_at",
        key: "reviewed_at",
        render: (v: string | null) => (v ? dayjs(v).format("MMM D, YYYY • h:mm A") : "—"),
      },
      {
        title: "Reason",
        dataIndex: "reason",
        key: "reason",
        ellipsis: true,
        render: (v: string) => (
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: "Decline Reason",
        dataIndex: "decline_reason",
        key: "decline_reason",
        ellipsis: true,
        render: (v: string | null) =>
          v ? (
            <Tooltip title={v}>
              <span>{v}</span>
            </Tooltip>
          ) : (
            "—"
          ),
      },
      {
        title: "Attachment",
        dataIndex: "file_url",
        key: "file_url",
        render: (url: string | null) =>
          url ? (
            <Button size="small" type="link" href={url} target="_blank" rel="noreferrer">
              View File
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    []
  );

  return (
    <Table
      rowKey="id"
      columns={columns as any}
      dataSource={logs}
      loading={loading}
      pagination={{ pageSize: 5 }}
    />
  );
};

export default AttendanceLogs;