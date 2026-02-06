// src/pages/Employee/Attendance/Requests/Requests.tsx
"use client";

import React from "react";
import { Card, Table, Tag } from "antd";
import styles from "./Requests.module.css";

const Requests: React.FC = () => {
  const columns = [
    {
      title: "Request Type",
      dataIndex: "type",
      render: (type: string) => (
        <Tag color={type === "Leave" ? "blue" : "purple"}>{type}</Tag>
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
      title: "Submitted On",
      dataIndex: "submittedAt",
    },
  ];

  // TEMP: static data (replace with API later)
  const dataSource = [
    {
      key: 1,
      type: "Leave",
      details: "Mar 10 – Mar 12, 2024",
      reason: "Family trip",
      status: "Pending",
      submittedAt: "Mar 01, 2024",
    },
    {
      key: 2,
      type: "Attendance Correction",
      details: "Mar 05, 2024 | 8:00 AM – 5:00 PM",
      reason: "Missed punch",
      status: "Approved",
      submittedAt: "Mar 06, 2024",
    },
    {
      key: 3,
      type: "Leave",
      details: "Feb 20, 2024",
      reason: "Sick leave",
      status: "Declined",
      submittedAt: "Feb 19, 2024",
    },
  ];

  return (
    <Card className={styles.card} title="My Requests">
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        className={styles.table}
      />
    </Card>
  );
};

export default Requests;
