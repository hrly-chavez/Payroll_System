"use client";

import React, { useEffect, useState } from "react";
import { Table, Tag, Button, Space, message, Modal, Input } from "antd";
import api from "../../../../api/axios";
import styles from "./HolidayRequest.module.css";
import type { ColumnsType } from "antd/es/table";

const { TextArea } = Input;

interface HolidayRequest {
  id: number;
  employee: string;
  details: string;
  reason: string;
  status: string;
  created_at: string;
}

const HolidayRequests: React.FC = () => {
  const [dataSource, setDataSource] = useState<HolidayRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HolidayRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // FETCH ONLY HOLIDAY REQUESTS
  const fetchHolidayRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/all-requests/");
      
      
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
        `/approvals/superadmin/holidays/${selectedRecord?.id}/status/`,
        { status: "Declined", remarks: declineReason }
      );

      message.success("Declined successfully");

      setDeclineModalOpen(false);
      setDeclineReason("");
      setSelectedRecord(null);
      fetchHolidayRequests();
    } catch {
      message.error("Decline failed");
    }
  };

  const columns: ColumnsType<HolidayRequest> = [    {
      title: "Employee",
      dataIndex: "employee",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Request Type",
      dataIndex: "type",
      responsive: ["xs", "sm", "md", "lg"],
      render: () => <Tag color="purple">Holiday</Tag>,
    },
    {
      title: "Details",
      dataIndex: "details",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Reason",
      dataIndex: "reason",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Status",
      dataIndex: "status",
      responsive: ["xs", "sm", "md", "lg"],
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
      width: 160,
      render: (_: any, record: any) => {
        if (record.status !== "Pending") return null;

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 6, 
            }}
          >
            <Button
              type="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleApprove(record)
              }}
            >
              Approve
            </Button>

            <Button
              danger
              size="small"
              onClick={(e) => {
                 e.stopPropagation();
                handleDeclineClick(record);
              }}
            >
              Decline
            </Button>
          </div>
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
        onRow={(record) => ({
          onClick: () => {
            setSelectedRecord(record);
            setViewModalOpen(true); // open modal
          },
          style: { cursor: "pointer" },
        })}
        scroll={{ x: "max-content" }}

        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
      />

      <Modal
        title="Holiday Request Details"
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setSelectedRecord(null);
        }}
        footer={null}
        centered
        destroyOnClose
      >
        {selectedRecord && (
          <div className={styles.modalGrid}>
            <div>
              <strong>Employee:</strong> {selectedRecord.employee}
            </div>
            <div>
              <strong>Details:</strong> {selectedRecord.details}
            </div>
            <div>
              <strong>Reason:</strong> {selectedRecord.reason}
            </div>
            <div>
              <strong>Status:</strong> {selectedRecord.status}
            </div>
          </div>
        )}
      </Modal>

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