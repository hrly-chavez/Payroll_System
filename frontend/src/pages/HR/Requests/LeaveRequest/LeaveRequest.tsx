import React from "react";
import { Table, Tag, Button, Space } from "antd";
import styles from "./LeaveRequest.module.css";

const LeaveRequest: React.FC = () => {
  const columns = [
    {
      title: "Employee",
      dataIndex: "employee",
    },
    {
      title: "Leave Type",
      dataIndex: "type",
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: "Date Range",
      dataIndex: "date",
    },
    {
      title: "Reason",
      dataIndex: "reason",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) => {
        const color =
          status === "Pending"
            ? "gold"
            : status === "Approved"
            ? "green"
            : "red";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Action",
      render: () => (
        <Space>
          <Button type="primary" size="small">
            Approve
          </Button>
          <Button danger size="small">
            Decline
          </Button>
        </Space>
      ),
    },
  ];

  const dataSource = [
    {
      key: 1,
      employee: "Jeremy Neigh",
      type: "Vacation",
      date: "Mar 10 - Mar 12, 2023",
      reason: "Family trip",
      status: "Pending",
    },
    {
      key: 2,
      employee: "Annette Black",
      type: "Sick",
      date: "Mar 15, 2023",
      reason: "Flu",
      status: "Approved",
    },
  ];

  return (
    <div className={styles.wrapper}>
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
      />
    </div>
  );
};

export default LeaveRequest;
