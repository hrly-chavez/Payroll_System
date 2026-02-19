import React from "react";
import { Table, Tag, Button, Space } from "antd";
import styles from "./AttendanceCorrectionRequest.module.css";

const AttendanceCorrectionRequest: React.FC = () => {
  const columns = [
    {
      title: "Employee",
      dataIndex: "employee",
    },
    {
      title: "Date",
      dataIndex: "date",
    },
    {
      title: "Requested Time",
      dataIndex: "time",
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
      employee: "Theresa Webb",
      date: "Mar 08, 2023",
      time: "8:00 AM - 5:00 PM",
      reason: "Missed punch",
      status: "Pending",
    },
    {
      key: 2,
      employee: "Kathryn Murphy",
      date: "Mar 05, 2023",
      time: "9:00 AM - 6:00 PM",
      reason: "System issue",
      status: "Declined",
    },
  ];

  return (
    <div className={styles.wrapper}>
      <Table
        columns={columns}
        dataSource={[...dataSource].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })}        
        pagination={{
          pageSize: 5,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20"],
        }}
      />
    </div>
  );
};

export default AttendanceCorrectionRequest;
