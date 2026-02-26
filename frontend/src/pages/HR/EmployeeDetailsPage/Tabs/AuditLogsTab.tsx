// Tabs/AuditLogsTab.tsx
import React from "react";
import { Table } from "antd";

interface Props {
  logs: any[];
  loading: boolean;
}

const AuditLogsTab: React.FC<Props> = ({ logs, loading }) => {
  const columns = [
    { title: "Action", dataIndex: "action", key: "action" },
    { title: "User", dataIndex: "user", key: "user" },
    { title: "Model", dataIndex: "model_name", key: "model_name" },
    { title: "Old Data", dataIndex: "old_data", key: "old_data" },
    { title: "New Data", dataIndex: "new_data", key: "new_data" },
    { title: "Timestamp", dataIndex: "timestamp", key: "timestamp" },
  ];

  return (
    <Table
      columns={columns}
      dataSource={logs}
      loading={loading}
      scroll={{ x: "max-content" }}
      rowKey="id"
    />
  );
};

export default AuditLogsTab;