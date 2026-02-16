"use client";

import React, { useEffect, useState } from "react";
import { Table, Tag, Select, message, Spin, Modal, Input } from "antd";
import api from "../../../../api/axios";

const { Option } = Select;
const { TextArea } = Input;

const LeaveRequests = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get("/approvals/approvals/leaves/");
      setRequests(response.data);
    } catch (error) {
      message.error("Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  // 🔹 APPROVE
  const handleApprove = (id: number) => {
    Modal.confirm({
      title: "Approve Leave Request",
      content: "Are you sure you want to approve this leave request?",
      okText: "Approve",
      okType: "primary",
      onOk: async () => {
        try {
          await api.patch(`/approvals/approvals/leaves/${id}/`, {
            status: "Approved",
          });

          message.success("Leave request approved");
          fetchLeaveRequests();
        } catch (error) {
          message.error("Failed to approve request");
        }
      },
    });
  };

  // 🔹 DECLINE
  const handleDecline = async () => {
    if (!declineReason.trim()) {
      message.error("Please provide a reason for declining.");
      return;
    }

    try {
      await api.patch(`/approvals/approvals/leaves/${selectedRequestId}/`, {
        status: "Declined",
        reason: declineReason,
      });

      message.success("Leave request declined");
      setDeclineModalOpen(false);
      setDeclineReason("");
      fetchLeaveRequests();
    } catch (error) {
      message.error("Failed to decline request");
    }
  };

  const handleStatusChange = (id: number, value: string) => {
    if (value === "Approved") {
      handleApprove(id);
    } else if (value === "Declined") {
      setSelectedRequestId(id);
      setDeclineModalOpen(true);
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
            <Tag color="gray">Cancelled</Tag>
          </Option>
        </Select>
      ),
    },
  ];

  return (
    <>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Spin>

      {/* 🔹 DECLINE MODAL */}
      <Modal
        title="Decline Leave Request"
        open={declineModalOpen}
        onCancel={() => setDeclineModalOpen(false)}
        onOk={handleDecline}
        okText="Decline"
        okButtonProps={{ danger: true }}
      >
        <p>Please provide a reason for declining:</p>
        <TextArea
          rows={4}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Enter decline reason..."
        />
      </Modal>
    </>
  );
};

export default LeaveRequests;