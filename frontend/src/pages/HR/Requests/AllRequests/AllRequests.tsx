import React from "react";
import { Table, Tag, Button, Space } from "antd";
import styles from "./AllRequests.module.css";

const AllRequests: React.FC = () => {
  const columns = [
    {
      title: "Employee",
      dataIndex: "employee",
    },
    {
      title: "Request Type",
      dataIndex: "requestType",
      render: (type: string) => (
        <Tag color={type === "Leave" ? "blue" : "purple"}>
          {type}
        </Tag>
      ),
    },
    {
      title: "Details",
      dataIndex: "details",
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
      requestType: "Leave",
      details: "Mar 10 – Mar 12, 2023",
      reason: "Family trip",
      status: "Pending",
    },
    {
      key: 2,
      employee: "Theresa Webb",
      requestType: "Attendance Correction",
      details: "Mar 08, 2023 | 8:00 AM – 5:00 PM",
      reason: "Missed punch",
      status: "Pending",
    },
    {
      key: 3,
      employee: "Annette Black",
      requestType: "Leave",
      details: "Mar 15, 2023",
      reason: "Sick leave",
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

export default AllRequests;
