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
        } catch {
          message.error("Failed to approve request");
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
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      key: "leave_type",
      responsive: ["xs", "sm", "md", "lg"],    
    },
    {
      title: "Start Date",
      dataIndex: "date_from",
      key: "date_from",
      responsive: ["xs", "sm", "md", "lg"],    
    },
    {
      title: "End Date",
      dataIndex: "date_to",
      key: "date_to",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      responsive: ["xs", "sm", "md", "lg"],
       render: (text: string, record: any) => {
        const isLong =
          (text?.split(" ").length > 10) || (text?.length > 20);

        return (
           <div
            className={`${styles.clampText} ${
              isLong ? styles.clickable : ""
            }`} 
            onClick={() => {
              if (isLong) {
                setSelectedRecord(record);
                setViewModalOpen(true);
              }
            }}
          >
            {text}
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let color = "orange";
        if (status === "Approved") color = "green";
        else if (status === "Declined") color = "red";
        else if (status === "Cancelled") color = "gray";

        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
  title: "Requested At",
  dataIndex: "requested_at",
  key: "requested_at",
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
      render: (_: any, record: any) => {
        if (record.status !== "Pending") return null;

        return (
          <div
            className={styles.actions}
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              e.stopPropagation()
            } // prevents row click from triggering modal
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
      new Date(b.date_from).getTime() -
      new Date(a.date_from).getTime()
    );
  });

  return (
   <div className={styles.wrapper}>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          rowKey="id"
          dataSource={sortedRequests}

          onRow={(record) => {
            return {
              onClick: () => {
                setSelectedRecord(record);   
                setViewModalOpen(true);      
              },
              style: { cursor: "pointer" },   
            };
          }}

          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10"],
            showTotal: (total) => `Total ${total} leave requests`,
          }}
        />
      </Spin>

      {/* Decline Modal */}
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

      {/* View Modal */}
      <Modal
        title="Leave Request Details"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
      >
        {selectedRecord && (
          <div className={styles.modalGrid}> 
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
              <strong>Reason:</strong>
              <p className={styles.reasonText}>
                {selectedRecord.reason}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LeaveRequests;

