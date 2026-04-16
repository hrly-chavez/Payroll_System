import React, { useEffect, useState } from "react";
import { Table, Tag, Button, Space, message, Modal, Input } from "antd";
import api from "../../../../api/axios";
import styles from "./AllRequests.module.css";

const { TextArea } = Input;

const AllRequests: React.FC = () => {
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");

  // FETCH all requests including attendance corrections
  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      // Existing requests
      const resRequests = await api.get("/approvals/all-requests/");
      const requestsData = resRequests.data;

      // Attendance corrections
      const resAttendance = await api.get("/attendance/admin/corrections/pending/");
      const attendanceData = resAttendance.data.results.map((r: any) => ({
        ...r,
        model: "attendance", // mark as attendance request
        employee: r.employee_name || r.requested_by?.user?.user_name,
        type: "Attendance Correction",
        details: r.issue_type,
        reason: r.reason || r.decline_reason || "",
        status: r.status,
      }));

      setDataSource([...requestsData, ...attendanceData]);
    } catch (err) {
      message.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  // APPROVE
  const handleApprove = async (record: any) => {
    Modal.confirm({
      title: "Approve Request",
      content: "Are you sure you want to approve this request?",
      onOk: async () => {
        try {
          if (record.model === "leave") {
            await api.post(`/approvals/admin/leaves/${record.id}/status/`, {
              status: "Approved",
            });
          }

          if (record.model === "attendance") {
            await api.post(`/attendance/admin/corrections/${record.id}/review/`, {
              status: "Verified",
            });
          }

          if (record.model === "holiday") {
            await api.patch(
              `/approvals/superadmin/holidays/${record.id}/status/`,
              { status: "Approved" }
            );
          }

          message.success("Approved successfully");
          fetchAllRequests();
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
      if (selectedRecord.model === "leave") {
        await api.post(`/approvals/admin/leaves/${selectedRecord.id}/status/`, {
          status: "Declined",
          reason: declineReason,
        });
      }

      if (selectedRecord.model === "attendance") {
        await api.post(`/attendance/admin/corrections/${selectedRecord.id}/review/`, {
          status: "Declined",
          decline_reason: declineReason,
        });
      }

      if (selectedRecord.model === "holiday") {
        await api.patch(
          `/approvals/superadmin/holidays/${selectedRecord.id}/status/`,
          { status: "Declined", remarks: declineReason }
        );
      }

      message.success("Declined successfully");
      setDeclineModalOpen(false);
      setDeclineReason("");
      fetchAllRequests();
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
      render: (type: string) => {
        let color = "blue";
        if (type.includes("Holiday")) color = "purple";
        if (type.includes("Attendance")) color = "orange";
        return <Tag color={color}>{type}</Tag>;
      },
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
            : status === "Approved" || status === "Verified"
            ? "green"
            : "red";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Action",
      render: (_: any, record: any) => {
        // Only allow action if still Pending
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
    (a, b) => new Date(b.created_at || b.requested_at).getTime() - new Date(a.created_at || a.requested_at).getTime()
  );

  return (
    <div className={styles.wrapper}>
      <Table
        columns={columns}
        rowKey={(record) => `${record.model}-${record.id}`}
        loading={loading}
        dataSource={sortedData}
        scroll={{ x: "max-content" }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20", "50"],
          showTotal: (total) => `Total ${total} requests`,
        }}
      />

      {/* DECLINE MODAL */}
      <Modal
        title="Decline Request"
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

export default AllRequests;