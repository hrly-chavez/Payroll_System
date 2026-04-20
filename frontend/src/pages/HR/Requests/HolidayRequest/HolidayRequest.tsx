"use client";

import React, { useEffect, useState } from "react";
import { Table, Tag, Button, Space, message, Modal, Input } from "antd";
import api from "../../../../api/axios";
import styles from "./HolidayRequest.css";

const { TextArea } = Input;

const HolidayRequests: React.FC = () => {
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");

  // FETCH ONLY HOLIDAY REQUESTS
  const fetchHolidayRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/all-requests/");
      
      // ✅ filter only holiday
      const holidayRequests = res.data.filter(
        (r: any) => r.model === "holiday"
      );

      setDataSource(holidayRequests);
    } catch (err) {
      message.error("Failed to fetch holiday requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidayRequests();
  }, []);

  // APPROVE
  const handleApprove = async (record: any) => {
    Modal.confirm({
      title: "Approve Holiday Request",
      content: "Are you sure you want to approve this holiday request?",
      onOk: async () => {
        try {
          await api.patch(
            `/approvals/superadmin/holidays/${record.id}/status/`,
            { status: "Approved" }
          );

          message.success("Approved successfully");
          fetchHolidayRequests();
        } catch {
          message.error("Approval failed");
        }
      },
    });
  };

  // DECLINE
  const handleDeclineClick = (record: any) => {
    setSelectedRecord(record);
    setDeclineModalOpen(true);
  };

  const handleDeclineSubmit = async () => {
    if (!declineReason.trim()) {
      message.error("Please provide a reason for declining.");
      return;
    }

    try {
      await api.patch(
        `/approvals/superadmin/holidays/${selectedRecord.id}/status/`,
        { status: "Declined", remarks: declineReason }
      );

      message.success("Declined successfully");
      setDeclineModalOpen(false);
      setDeclineReason("");
      fetchHolidayRequests();
    } catch {
      message.error("Decline failed");
    }
  };

  const columns = [
    {
      title: "Employee",
      dataIndex: "employee",
    },
    {
      title: "Request Type",
      dataIndex: "type",
      render: () => <Tag color="purple">Holiday</Tag>,
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
      render: (_: any, record: any) => {
        if (record.status !== "Pending") return null;

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => handleApprove(record)}
            >
              Approve
            </Button>
            <Button
              danger
              size="small"
              onClick={() => handleDeclineClick(record)}
            >
              Decline
            </Button>
          </Space>
        );
      },
    },
  ];

  const sortedData = [...dataSource].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  return (
    <div className={styles.wrapper}>
      <Table
        columns={columns}
        rowKey={(record) => `holiday-${record.id}`}
        loading={loading}
        dataSource={sortedData}
        scroll={{ x: "max-content" }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
      />

      {/* DECLINE MODAL */}
      <Modal
        title="Decline Holiday Request"
        open={declineModalOpen}
        onCancel={() => setDeclineModalOpen(false)}
        onOk={handleDeclineSubmit}
        okText="Decline"
        okButtonProps={{ danger: true }}
      >
        <p>Please provide a reason for declining:</p>
        <TextArea
          rows={4}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default HolidayRequests;