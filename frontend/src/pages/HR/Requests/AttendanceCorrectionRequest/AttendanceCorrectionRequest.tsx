// src/pages/HR/Requests/AttendanceCorrectionRequest/AttendanceCorrectionRequest.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Table, Tag, Button, Space, message, Modal, Input, Alert } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";
import styles from "./AttendanceCorrectionRequest.module.css";
import EditAttendance from "./EditAttendance";

type CorrectionRow = {
  id: number;
  attendance_id: number;
  date: string;
  issue_type: string;
  reason: string;
  file_attached: string | null;
  requested_at: string;
  status: "Pending" | "Verified" | "Declined";
  decline_reason?: string | null;

  // if your serializer doesn't include these yet, we can add them later
  employee_name?: string;
  department_name?: string;
};

const { TextArea } = Input;

const AttendanceCorrectionRequest: React.FC = () => {
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineId, setDeclineId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<CorrectionRow | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get("/attendance/admin/corrections/pending/");
      setRows(res.data?.results || []);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const statusTag = (status: CorrectionRow["status"]) => {
    const color = status === "Pending" ? "gold" : status === "Verified" ? "green" : "red";
    return <Tag color={color}>{status}</Tag>;
  };

    const openEdit = (id: number) => {
      setEditId(id);
      setEditOpen(true);
    };

  const openDecline = (id: number) => {
    setErrorMsg(null);
    setDeclineReason("");
    setDeclineId(id);
    setDeclineOpen(true);
  };

  const submitDecline = async () => {
    setErrorMsg(null);

    if (!declineId) return;

    if (!declineReason.trim()) {
      setErrorMsg("Decline reason is required.");
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/attendance/admin/corrections/${declineId}/review/`, {
        status: "Declined",
        decline_reason: declineReason.trim(),
      });
      message.success("Request declined.");
      setDeclineOpen(false);
      fetchPending();
    } catch (err: any) {
      const data = err?.response?.data;
      setErrorMsg(data?.detail || data?.decline_reason?.[0] || "Failed to decline request.");
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Employee",
        dataIndex: "employee_name",
        responsive: ["xs", "sm", "md", "lg"],
        render: (_: any, record: CorrectionRow) => record.employee_name || "—",
      },
      {
        title: "Date",
        dataIndex: "date",
        responsive: ["xs", "sm", "md", "lg"],
        render: (v: string | null) => (v ? dayjs(v).format("MMM DD, YYYY") : "—"),
      },
      {
        title: "Issue Type",
        dataIndex: "issue_type",
        responsive: ["xs", "sm", "md", "lg"],
      },
      {
        title: "Reason",
        dataIndex: "reason",
        responsive: ["xs", "sm", "md", "lg"],
        ellipsis: true,
      },
      {
        title: "Attachment",
        dataIndex: "file_attached",
        responsive: ["xs", "sm", "md", "lg"],
        render: (v: string | null) => (v ? <a href={v} target="_blank" rel="noreferrer">View</a> : "—"),
      },
      {
        title: "Status",
        dataIndex: "status",
        responsive: ["xs", "sm", "md", "lg"],
        render: (status: CorrectionRow["status"]) => statusTag(status),
      },
      {
        title: "Action",
        render: (_: any, record: CorrectionRow) => (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              minWidth: 140, 
              width: 160,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="primary"
              size="small"
              loading={actionLoading}
              disabled={record.status !== "Pending" || editOpen}
              onClick={() => openEdit(record.id)}
            >
              Edit / Apply
            </Button>

            <Button
              danger
              size="small"
              loading={actionLoading}
              disabled={record.status !== "Pending"}
              onClick={() => openDecline(record.id)}
            >
              Decline
            </Button>
          </div>
        ),
      },
    ],
    [actionLoading, editOpen]
  );

  const sortedRows = [...rows].sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={styles.wrapper}>
      <Table
        rowKey="id"
        columns={columns as any}
        dataSource={rows}
        loading={loading}
        scroll={{ x: "max-content" }}
        onRow={(record) => ({
            onClick: () => {
            setSelectedRecord(record);
            setViewOpen(true);
            },
          style: { cursor: "pointer" },
        })} 
        pagination={{
          pageSize: 5,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "20"],
        }}
      />

      <Modal
        title="Decline Request"
        open={declineOpen}
        onCancel={() => {
          setDeclineOpen(false);
          setDeclineId(null);
          setDeclineReason("");
          setErrorMsg(null);
        }}
        onOk={submitDecline}
        okText="Decline"
        okButtonProps={{ danger: true, loading: actionLoading }}
        cancelButtonProps={{ disabled: actionLoading }}
      >
        {errorMsg && (
          <Alert type="error" showIcon message={errorMsg} style={{ marginBottom: 12 }} />
        )}
        <label>Reason</label>
        <TextArea
          rows={4}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Enter decline reason..."
        />
      </Modal>
       {editId !== null && (
        <EditAttendance
            key={editId}
            open={editOpen}
            correctionId={editId}
            onClose={() => {
              setEditOpen(false);
              setEditId(null);
            }}
            onApplied={() => {
              setEditOpen(false);
              setEditId(null);
              fetchPending();
            }}
          />
      )}
    <Modal
        title="Attendance Correction Details"
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={null}
        centered   
      >
        {selectedRecord && (
          <div className={styles.modalGrid}>
            <div>
              <strong>Employee:</strong>{" "}
              {selectedRecord.employee_name || "—"}
            </div>
            <div>
              <strong>Date:</strong>{" "}
              {selectedRecord.date
                ? dayjs(selectedRecord.date).format("MMM DD, YYYY")
                : "—"}
            </div>
            <div>
              <strong>Issue Type:</strong>{" "}
              {selectedRecord.issue_type}
            </div>
            <div>
              <strong>Reason:</strong>
              <p className={styles.reasonText}>
                {selectedRecord.reason}
              </p>
            </div>
            <div>
              <strong>Status:</strong>{" "}
              {statusTag(selectedRecord.status)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceCorrectionRequest;