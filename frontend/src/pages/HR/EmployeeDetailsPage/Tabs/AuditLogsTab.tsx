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
    { title: "Performed by", dataIndex: "user", key: "user" },
    { title: "Reason", dataIndex: "reason", key: "reason" },
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