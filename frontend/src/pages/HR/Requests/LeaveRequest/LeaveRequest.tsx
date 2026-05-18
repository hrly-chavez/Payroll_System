"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  Tag,
  message,
  Spin,
  Modal,
  Input,
  Button,
} from "antd";
import api from "../../../../api/axios";
import styles from "./LeaveRequest.module.css";
import type { ColumnsType } from "antd/es/table";

const { TextArea } = Input;

interface LeaveRequest {
  id: number;
  employee_name: string;
  leave_type: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: string;
  requested_at: string;
  attachment_proof: string | null;
  decline_reason: string | null;
}

const LeaveRequests = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LeaveRequest | null>(null);

  const fetchLeaveRequests = async () => {
    setLoading(true);

    try {
      const response = await api.get("/approvals/admin/leaves/");
      setRequests(response.data);
    } catch {
      message.error("Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const handleApprove = (id: number) => {
    Modal.confirm({
      title: "Approve Leave Request",
      content: "Are you sure you want to approve this leave request?",
      okText: "Approve",
      okType: "primary",

      onOk: async () => {
        try {
          await api.post(`/approvals/admin/leaves/${id}/status/`, {
            status: "Approved",
          });

          message.success("Leave request approved");
          fetchLeaveRequests();
        } catch (error: any) {
          console.error(error);

          const data = error?.response?.data;

          const errorMessage =
            typeof data?.detail === "string"
              ? data.detail
              : Array.isArray(data?.detail)
              ? data.detail[0]
              : data?.non_field_errors?.[0] ||
                "Failed to approve request";

          message.error(errorMessage);
        }
      },
    });
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      message.error("Please provide a reason for declining.");
      return;
    }

    try {
      await api.post(
        `/approvals/admin/leaves/${selectedRequestId}/status/`,
        {
          status: "Declined",
          reason: declineReason,
        }
      );

      message.success("Leave request declined");

      setDeclineModalOpen(false);
      setDeclineReason("");

      fetchLeaveRequests();
    } catch {
      message.error("Failed to decline request");
    }
  };

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: "Employee",
      dataIndex: "employee_name",
      key: "employee_name",
      width: 180,
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      key: "leave_type",
      width: 160,
      responsive: ["sm", "md", "lg"],
    },
    {
      title: "Start Date",
      dataIndex: "date_from",
      key: "date_from",
      width: 130,
      responsive: ["md", "lg"],
    },
    {
      title: "End Date",
      dataIndex: "date_to",
      key: "date_to",
      width: 130,
      responsive: ["md", "lg"],
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 220,
      ellipsis: true,
      responsive: ["md", "lg"],

      render: (text: string, record: LeaveRequest) => {
        return (
          <div
            className={styles.clampText}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRecord(record);
              setViewModalOpen(true);
            }}
          >
            {text || "-"}
          </div>
        );
      },
    },
    {
      title: "Attachment",
      dataIndex: "attachment_proof",
      key: "attachment_proof",
      width: 150,
      responsive: ["md", "lg"],

      render: (fileUrl: string | null) => {
        if (!fileUrl) return "-";

        const fullUrl = fileUrl.startsWith("http")
          ? fileUrl
          : `http://localhost:8000${fileUrl}`;

        return (
          <Button
            type="link"
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            View Proof
          </Button>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,

      render: (status: string) => {
        let color = "orange";

        if (status === "Approved") color = "green";
        else if (status === "Declined") color = "red";
        else if (status === "Cancelled") color = "gray";

        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Decline Reason",
      dataIndex: "decline_reason",
      key: "decline_reason",
      width: 220,
      responsive: ["lg"],

      render: (value: string | null, record: LeaveRequest) => {
        if (record.status !== "Declined") return "-";

        return (
          <div className={styles.clampText}>
            {value || "No decline reason provided."}
          </div>
        );
      },
    },
    {
      title: "Requested At",
      dataIndex: "requested_at",
      key: "requested_at",
      width: 180,
      responsive: ["lg"],

      render: (value: string) => {
        if (!value) return "-";

        const date = new Date(value);

        return date.toLocaleString("en-PH", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      title: "Action",
      key: "action",
      width: 180,

      render: (_: any, record: LeaveRequest) => {
        if (record.status !== "Pending") return "-";

        return (
          <div
            className={styles.actions}
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            }
          >
            <Button
              type="primary"
              size="small"
              onClick={() => handleApprove(record.id)}
            >
              Approve
            </Button>

            <Button
              danger
              size="small"
              onClick={() => {
                setSelectedRequestId(record.id);
                setDeclineModalOpen(true);
              }}
            >
              Decline
            </Button>
          </div>
        );
      },
    },
  ];

  const sortedRequests = [...requests].sort((a, b) => {
    return (
      new Date(b.requested_at).getTime() -
      new Date(a.requested_at).getTime()
    );
  });

  return (
    <div className={styles.wrapper}>
      <Spin spinning={loading}>
        <div className={styles.tableContainer}>
          <Table
            columns={columns}
            rowKey="id"
            dataSource={sortedRequests}
            tableLayout="auto"
            size="middle"
            onRow={(record) => ({
              onClick: () => {
                setSelectedRecord(record);
                setViewModalOpen(true);
              },
              style: { cursor: "pointer" },
            })}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10"],
              showTotal: (total) => `Total ${total} leave requests`,
            }}
          />
        </div>
      </Spin>

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

      <Modal
        title="Leave Request Details"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
        width={700}
      >
        {selectedRecord && (
          <div
            className={styles.modalGrid}
            style={{
              fontSize: "clamp(13px, 2vw, 16px)",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            <div>
              <strong>Employee:</strong> {selectedRecord.employee_name}
            </div>

            <div>
              <strong>Leave Type:</strong> {selectedRecord.leave_type}
            </div>

            <div>
              <strong>Start Date:</strong> {selectedRecord.date_from}
            </div>

            <div>
              <strong>End Date:</strong> {selectedRecord.date_to}
            </div>

            <div>
              <strong>Attachment:</strong>{" "}
              {selectedRecord.attachment_proof ? (
                <a
                  href={
                    selectedRecord.attachment_proof.startsWith("http")
                      ? selectedRecord.attachment_proof
                      : `http://localhost:8000${selectedRecord.attachment_proof}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Proof
                </a>
              ) : (
                "-"
              )}
            </div>

            <div>
              <strong>Reason:</strong>

              <p className={styles.reasonText}>
                {selectedRecord.reason}
              </p>
            </div>

            {selectedRecord.status === "Declined" && (
              <div>
                <strong>Decline Reason:</strong>

                <p className={styles.reasonText}>
                  {selectedRecord.decline_reason ||
                    "No decline reason provided."}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LeaveRequests;