// Tabs/TaxTab.tsx
import React from "react";
import { Table } from "antd";

interface Props {
  deductions: any[];
  loading: boolean;
}

const TaxTab: React.FC<Props> = ({ deductions, loading }) => {
  const columns = [
    { title: "Deduction", dataIndex: "name", key: "name" },
    { title: "Frequency", dataIndex: "frequency", key: "frequency" },
    { title: "Effective From", dataIndex: "effective_from", key: "effective_from" },
    { title: "Amount", dataIndex: "amount", key: "amount" },
  ];

  return (
    <Table
      columns={columns}
      dataSource={deductions}
      loading={loading}
      pagination={false}
      scroll={{ x: "max-content" }}
    />
  );
};

export default TaxTab;