// Tabs/PayslipsTab.tsx
import React from "react";
import { Table } from "antd";

const PayslipsTab: React.FC = () => {
  const columns = [
    { title: "Earnings", dataIndex: "earningName", key: "earningName" },
    { title: "Amount", dataIndex: "earningAmount", key: "earningAmount" },
    { title: "Deductions", dataIndex: "deductionName", key: "deductionName" },
    { title: "Amount", dataIndex: "deductionAmount", key: "deductionAmount" },
  ];

  const data = [
    {
      key: "1",
      earningName: "Basic Salary",
      earningAmount: "₱600.00",
      deductionName: "Absences",
      deductionAmount: "₱600.00 (1 day)",
    },
  ];

  return <Table bordered pagination={false} columns={columns} dataSource={data} />;
};

export default PayslipsTab;