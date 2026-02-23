//src/pages/SuperAdmin/Dashboard/OverTimeDetailModal.tsx
import React from "react";
import { Modal, Button, Spin, Tag } from "antd";
import dayjs from "dayjs";
import type { OverTimeRequest } from "./types";

interface Props {
  visible: boolean;
  overtime: OverTimeRequest | null;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
}

const OverTimeDetailModal: React.FC<Props> = ({
  visible,
  overtime,
  onClose,
  onApprove,
  onDecline,
}) => {
  const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "-");

  const statusTag = (status: OverTimeRequest["status"]) => {
    if (status === "Approved") return <Tag color="green">Approved</Tag>;
    if (status === "Declined") return <Tag color="red">Declined</Tag>;
    return <Tag color="gold">Pending</Tag>;
  };

  return (
    <Modal
      title="OverTime Detail"
      open={visible}
      onCancel={onClose}
      footer={
          overtime?.status === "Pending"
            ? [
                <Button key="decline" onClick={onDecline}>
                  Decline
                </Button>,
                <Button key="approve" type="primary" onClick={onApprove}>
                  Approve
                </Button>,
              ]
            : [
                <Button key="close" onClick={onClose}>
                  Close
                </Button>,
              ]
        }
      width={600}
      getContainer={false}
    >
      {overtime ? (
        <div className="detail-form">
          <div className="detail-field">
            <label>Employee</label>
            <input value={overtime.name} disabled />
          </div>

          <div className="detail-field">
            <label>Date</label>
            <input value={dayjs(overtime.attendance_date).format("MMM DD, YYYY")} disabled />
          </div>

          <div className="detail-field">
            <label>Type</label>
            <input value={overtime.type} disabled />
          </div>

          <div className="detail-field">
            <label>Minutes</label>
            <input value={`${overtime.minutes} min`} disabled />
          </div>

          <div className="detail-field">
            <label>Start - End</label>
            <input value={`${fmtTime(overtime.start_time)} - ${fmtTime(overtime.end_time)}`} disabled />
          </div>

          <div className="detail-field">
            <label>Department</label>
            <input value={overtime.department_name ?? "-"} disabled />
          </div>

          <div className="detail-field">
            <label>Shift</label>
            <input value={overtime.shift_name ?? "-"} disabled />
          </div>

          {overtime.status === "Declined" ? (
            <div className="detail-field">
              <label>Decline Reason</label>
              <textarea
                value={overtime.event_remarks ?? ""}
                disabled
                rows={3}
                style={{ width: "100%" }}
              />
            </div>
          ) : (
            <div className="detail-field">
              <label>Remarks</label>
              <textarea
                value={overtime.event_remarks ?? ""}
                disabled
                rows={3}
                style={{ width: "100%" }}
              />
            </div>
          )}

          <div className="detail-field">
            <label>Status</label>
            <div>{statusTag(overtime.status)}</div>
          </div>
        </div>
      ) : (
        <Spin tip="Loading..." />
      )}
    </Modal>
  );
};

export default OverTimeDetailModal;