// src/pages/Reports/UserActivity.tsx
import React, { useEffect, useState } from "react";
import { Table, message, Spin } from "antd";
import api from "api/axios"; // your axios instance

interface AuditLog {
  id: number;
  username: string;
  role: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  model_name: string;
  timestamp: string;
}

const UserActivity: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/employees/user-activity-logs/");
      setLogs(res.data.results);
    } catch (err: any) {
      console.error(err);
      message.error("Failed to fetch user activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    { title: "Date / Time", dataIndex: "timestamp", key: "timestamp" },
    { title: "Name", dataIndex: "username", key: "username" },
    { title: "Role", dataIndex: "role", key: "role" },
    { title: "Action", dataIndex: "action", key: "action" },
    { title: "Table", dataIndex: "model_name", key: "model_name" },
    { title: "Reason", dataIndex: "reason", key: "reason" },
  ];

  if (loading) return <Spin tip="Loading..." style={{ marginTop: 50 }} />;

  return <Table 
    columns={columns} 
    dataSource={logs} 
    rowKey="id" 
    pagination={{ pageSize: 10 }} 
    scroll={{ x: "max-content" }}
    />;
};

export default UserActivity;
