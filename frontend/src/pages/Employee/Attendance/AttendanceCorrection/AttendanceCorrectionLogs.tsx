//src/pages/Employee/Attendance/AttendaceCorrection/AttendanceCorrection

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, Tag, Button, Space, Modal, Descriptions, Alert, Spin} from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";

type CorrectionRow = {
  id: number;
  attendance_id: number;
  employee_name?: string;
  department_name?: string | null;

  date: string | null;
  issue_type: string;
  reason: string;

  file_attached: string | null;
  requested_at: string;

  status: "Pending" | "Verified" | "Declined";
  reviewed_at: string | null;
  decline_reason: string | null;
};

type ListResponse = {
  count: number;
  results: CorrectionRow[];
};

type Props = {
  title?: string;
  pageSize?: number;
};

const AttendanceCorrectionLogs: React.FC<Props> = ({ title = "Attendance Correction Logs", pageSize = 8 }) => {
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<CorrectionRow | null>(null);

  const fetchMyCorrections = async () => {
    try {
      setErrorMsg(null);
      setLoading(true);

      const res = await api.get<ListResponse>("/attendance/corrections/my/");
      setRows(res.data?.results || []);
    } catch (err: any) {
      setRows([]);
      setErrorMsg(err?.response?.data?.detail || "Failed to load attendance correction logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCorrections();
  }, []);

  const statusTag = (status: CorrectionRow["status"]) => {
    const color = status === "Pending" ? "gold" : status === "Verified" ? "green" : "red";
    return <Tag color={color}>{status}</Tag>;
  };

  const columns = useMemo(
    () => [
      {
        title: "Date",
        dataIndex: "date",
        render: (v: string | null) => (v ? dayjs(v).format("MMM DD, YYYY") : "—"),
      },
      {
        title: "Issue Type",
        dataIndex: "issue_type",
        ellipsis: true,
      },
      {
        title: "Reason",
        dataIndex: "reason",
        ellipsis: true,
        render: (v: string) => (v ? v : "—"),
      },
      {
        title: "Attachment",
        dataIndex: "file_attached",
        render: (v: string | null) =>
          v ? (
            <a href={v} target="_blank" rel="noreferrer">
              View
            </a>
          ) : (
            "—"
          ),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (v: CorrectionRow["status"]) => statusTag(v),
      },
      {
        title: "Reviewed At",
        dataIndex: "reviewed_at",
        render: (v: string | null) => (v ? dayjs(v).format("MMM DD, YYYY hh:mm A") : "—"),
      },
      {
        title: "Action",
        render: (_: any, record: CorrectionRow) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setSelected(record);
                setViewOpen(true);
              }}
            >
              View
            </Button>
          </Space>
        ),
      },
    ],
    []
  );

return (
  <>
    {errorMsg && (
      <Alert
        type="error"
        showIcon
        message={errorMsg}
        style={{ marginBottom: 12 }}
      />
    )}

    <Spin spinning={loading}>
      <Table
        rowKey="id"
        columns={columns as any}
        dataSource={rows}
        pagination={{ pageSize }}
        scroll={{ x: "max-content" }}
      />
    </Spin>

    <Modal
      open={viewOpen}
      title="Correction Details"
      onCancel={() => {
        setViewOpen(false);
        setSelected(null);
      }}
      footer={[
        <Button
          key="close"
          onClick={() => {
            setViewOpen(false);
            setSelected(null);
          }}
        >
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      {!selected ? (
        <Alert type="info" showIcon message="No item selected." />
      ) : (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Date">
            {selected.date
              ? dayjs(selected.date).format("MMM DD, YYYY")
              : "—"}
          </Descriptions.Item>

          <Descriptions.Item label="Issue Type">
            {selected.issue_type || "—"}
          </Descriptions.Item>

          <Descriptions.Item label="Reason">
            <div style={{ whiteSpace: "pre-wrap" }}>
              {selected.reason || "—"}
            </div>
          </Descriptions.Item>

          <Descriptions.Item label="Status">
            {statusTag(selected.status)}
          </Descriptions.Item>

          <Descriptions.Item label="Requested At">
            {selected.requested_at
              ? dayjs(selected.requested_at).format(
                  "MMM DD, YYYY hh:mm A"
                )
              : "—"}
          </Descriptions.Item>

          <Descriptions.Item label="Reviewed At">
            {selected.reviewed_at
              ? dayjs(selected.reviewed_at).format(
                  "MMM DD, YYYY hh:mm A"
                )
              : "—"}
          </Descriptions.Item>

          <Descriptions.Item label="Decline Reason">
            {selected.decline_reason ? (
              <div style={{ whiteSpace: "pre-wrap" }}>
                {selected.decline_reason}
              </div>
            ) : (
              "—"
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Attachment">
            {selected.file_attached ? (
              <a
                href={selected.file_attached}
                target="_blank"
                rel="noreferrer"
              >
                View attachment
              </a>
            ) : (
              "—"
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  </>
);
};

export default AttendanceCorrectionLogs;