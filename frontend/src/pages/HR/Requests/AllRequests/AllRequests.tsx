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

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/all-requests/");
      setDataSource(res.data);
    } catch (err) {
      message.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  //APPROVE
  const handleApprove = async (record: any) => {
    Modal.confirm({
      title: "Approve Request",
      content: "Are you sure you want to approve this request?",
      onOk: async () => {
        try {
          if (record.model === "leave") {
            await api.patch(`/approvals/approvals/leaves/${record.id}/`, {
              status: "Approved",
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

  //DECLINE
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
        await api.patch(`/approvals/approvals/leaves/${selectedRecord.id}/`, {
          status: "Declined",
          reason: declineReason,
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
        if (type === "Holiday") color = "purple";
        if (type === "Attendance") color = "orange";
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
            : status === "Approved"
            ? "green"
            : "red";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Action",
      render: (_: any, record: any) => {
        // No actions for Holiday (superadmin handles it)
        if (record.model === "holiday") {
          return null;
        }

        // Only allow action if still Pending
        if (record.status !== "Pending") {
          return null;
        }

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
    }
  ];

  const sortedData = [...dataSource].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className={styles.wrapper}>
      <Table
        columns={columns}
        rowKey={(record) => `${record.model}-${record.id}`}
        loading={loading}
        dataSource={sortedData}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20", "50"],
          showTotal: (total) => `Total ${total} requests`,
        }}
      />

      {/*DECLINE MODAL */}
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