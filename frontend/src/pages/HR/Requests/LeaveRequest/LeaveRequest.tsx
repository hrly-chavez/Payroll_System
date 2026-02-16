// src/pages/Employee/Requests/LeaveRequests.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Table, Tag, Select, message, Spin } from "antd";
import api from "../../../../api/axios";

const { Option } = Select;

const LeaveRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get("/approvals/approvals/leaves/"); // make sure baseURL in axios is correct
      console.log("Fetched leave requests:", response.data);
      setRequests(response.data);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const handleStatusChange = async (id: number, value: string) => {
    try {
      await api.patch(`/approvals/approvals/leaves/${id}/`, { status: value });
      message.success("Status updated successfully");
      fetchLeaveRequests();
    } catch (error) {
      console.error(error);
      message.error("Failed to update status");
    }
  };

  const columns = [
    {
      title: "Employee",
      dataIndex: "employee_name",
      key: "employee_name",
    },
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      key: "leave_type",
    },
    {
      title: "Start Date",
      dataIndex: "date_from",
      key: "date_from",
    },
    {
      title: "End Date",
      dataIndex: "date_to",
      key: "date_to",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
    },
    {
      title: "Status",
      key: "status",
      render: (_: any, record: any) => (
        <Select
          value={record.status}
          style={{ width: 130 }}
          onChange={(value) => handleStatusChange(record.id, value)}
        >
          <Option value="Pending">
            <Tag color="orange">Pending</Tag>
          </Option>
          <Option value="Approved">
            <Tag color="green">Approved</Tag>
          </Option>
          <Option value="Declined">
            <Tag color="red">Declined</Tag>
          </Option>
          <Option value="Cancelled">
            <Tag color="grey">Cancelled</Tag>
          </Option>
        </Select>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </Spin>
  );
};

export default LeaveRequests;
