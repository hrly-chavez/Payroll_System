//src/pages/Employee/Attendance/LeaveRequests/LeaveRequestLogs.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Spin, Table, Tag, Alert, Button, Space } from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";

type LeaveRow = {
  id: number;
  leave_type: string;
  is_halfday: boolean;
  halfday_part: string | null;
  reason: string;
  date_from: string;
  date_to: string;
  status: string; // approved | rejected | pending (based on your backend)
};
type LeaveRequestLogsProps = {
  refreshKey?: number;
};

const LeaveRequestLogs: React.FC<LeaveRequestLogsProps> = ({ refreshKey }) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLeaveRequests = async () => {
    try {
      setErrorMsg(null);
      setLoading(true);
      const res = await api.get("/approvals/leaves/");
      setLeaveRequests(res.data || []);
    } catch (err: any) {
      setLeaveRequests([]);
      setErrorMsg(err?.response?.data?.detail || "Failed to fetch leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [refreshKey]);

  const columns = useMemo(
    () => [
      {
        title: "Leave Type",
        dataIndex: "leave_type",
        key: "leave_type",
      },
      {
        title: "Half Day",
        dataIndex: "is_halfday",
        key: "is_halfday",
        render: (val: boolean) => (val ? "Yes" : "No"),
      },
      {
        title: "Half Day Part",
        dataIndex: "halfday_part",
        key: "halfday_part",
        render: (val: string | null) => val ?? "-",
      },
      {
        title: "Reason",
        dataIndex: "reason",
        key: "reason",
        ellipsis: true,
      },
      {
        title: "Date From",
        dataIndex: "date_from",
        key: "date_from",
        render: (val: string) => dayjs(val).format("DD MMM YYYY"),
      },
      {
        title: "Date To",
        dataIndex: "date_to",
        key: "date_to",
        render: (val: string) => dayjs(val).format("DD MMM YYYY"),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: string) => {
          const normalized = (status || "").toLowerCase();
          const color =
            normalized === "approved"
              ? "green"
              : normalized === "rejected" || normalized === "declined"
              ? "red"
              : "orange";

          return <Tag color={color}>{String(status).toUpperCase()}</Tag>;
        },
      },
    ],
    []
  );

  return (
    <div>
      
      {errorMsg && <Alert type="error" showIcon message={errorMsg} style={{ marginBottom: 12 }} />}

      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns as any}
          dataSource={leaveRequests}
          pagination={{ pageSize: 5 }}
          scroll={{ x: "max-content" }}
        />
      </Spin>
    </div>
  );
};

export default LeaveRequestLogs;