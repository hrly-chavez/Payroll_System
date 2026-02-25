//src/pages/HR/Requests/AttendanceCorrectionRequest/EditAttendance.tsx
import React, { useEffect, useState } from "react";
import { Modal, Form, DatePicker, Select, Alert, message, Divider, Checkbox } from "antd";

import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import CreateAttendance, { type EventRow } from "./CreateAttendance";
type AttendanceMini = {
  id: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "REST_DAY" | "HOLIDAY";
  time_in: string | null;
  time_out: string | null;
};

type CorrectionDetail = {
  id: number;
  date: string;
  issue_type: string;
  reason: string;
  file_attached: string | null;
  requested_at: string;
  status: "Pending" | "Verified" | "Declined";
  decline_reason: string | null;
  employee_name: string;
  department_name: string | null;
  attendance: AttendanceMini;
};

interface Props {
  open: boolean;
  correctionId: number;
  onClose: () => void;
  onApplied: () => void;
}

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "REST_DAY", label: "Rest Day" },
  { value: "HOLIDAY", label: "Holiday" },
];

const EditAttendance: React.FC<Props> = ({ open, correctionId, onClose, onApplied }) => {
  const [detail, setDetail] = useState<CorrectionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [status, setStatus] = useState<AttendanceMini["status"]>("PRESENT");
  const [timeIn, setTimeIn] = useState<Dayjs | null>(null);
  const [timeOut, setTimeOut] = useState<Dayjs | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [replaceEvents, setReplaceEvents] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setErrorMsg(null);
        setLoading(true);

        const res = await api.get(`/attendance/admin/corrections/${correctionId}/`);
        const data: CorrectionDetail = res.data;

        setDetail(data);
        setStatus(data.attendance.status);
        setTimeIn(data.attendance.time_in ? dayjs(data.attendance.time_in) : null);
        setTimeOut(data.attendance.time_out ? dayjs(data.attendance.time_out) : null);
      } catch (err: any) {
        setDetail(null);
        setErrorMsg(err?.response?.data?.detail || "Failed to load correction detail.");
      } finally {
        setLoading(false);
      }
    };

    if (open) fetchDetail();
  }, [open, correctionId]);

  const handleApply = async () => {
    setErrorMsg(null);

    if (timeIn && timeOut && timeOut.isBefore(timeIn)) {
      setErrorMsg("Time out must be later than or equal to time in.");
      return;
    }

    try {
      setApplyLoading(true);

      await api.post(`/attendance/admin/corrections/${correctionId}/apply/`, {
        status,
        time_in: timeIn ? timeIn.toISOString() : null,
        time_out: timeOut ? timeOut.toISOString() : null,
        replace_events: replaceEvents,
        events: (events || []).map((e) => ({
            type: e.type,
            minutes: e.minutes ?? 0,
            start_time: e.start_time ? dayjs(e.start_time).format("HH:mm:ss") : null,
            end_time: e.end_time ? dayjs(e.end_time).format("HH:mm:ss") : null,
            approval_status: e.approval_status || "Approved",
            event_remarks: (e.event_remarks || "").trim(),
            // holiday_id: optional, add later when you build holiday picker
        })),
        });

      message.success("Attendance updated and request verified.");
      onApplied();
    } catch (err: any) {
      const data = err?.response?.data;
      setErrorMsg(data?.detail || "Failed to apply correction.");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <Modal
        open={open}
        title="Apply Attendance Correction"
        onCancel={onClose}
        onOk={handleApply}
        okText="Apply & Verify"
        confirmLoading={applyLoading}
        destroyOnClose
        width={800}
        bodyStyle={{
            maxHeight: "70vh",
            overflowY: "auto",
            paddingRight: 8,
        }}
        >
      {errorMsg && <Alert type="error" showIcon message={errorMsg} style={{ marginBottom: 12 }} />}

      {detail && (
        <div style={{ marginBottom: 12 }}>
          <div><b>Employee:</b> {detail.employee_name}</div>
          <div><b>Date:</b> {detail.date ? dayjs(detail.date).format("MMM DD, YYYY") : "—"}</div>
          <div><b>Issue:</b> {detail.issue_type}</div>
          <div><b>Reason:</b> {detail.reason}</div>
          {detail.file_attached ? (
            <div>
              <b>Attachment:</b>{" "}
              <a href={detail.file_attached} target="_blank" rel="noreferrer">
                View
              </a>
            </div>
          ) : null}
        </div>
      )}

      <Form layout="vertical">
        <Form.Item label="Attendance Date">
          <DatePicker
            value={detail ? dayjs(detail.attendance.date) : null}
            disabled
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item label="Status">
          <Select
            value={status}
            onChange={(v) => setStatus(v)}
            options={STATUS_OPTIONS}
            loading={loading}
            disabled={loading}
          />
        </Form.Item>

        <Form.Item label="Time In">
          <DatePicker
            showTime
            style={{ width: "100%" }}
            value={timeIn}
            onChange={(v) => setTimeIn(v)}
            placeholder="Set time in"
            disabled={loading}
          />
        </Form.Item>

        <Form.Item label="Time Out">
          <DatePicker
            showTime
            style={{ width: "100%" }}
            value={timeOut}
            onChange={(v) => setTimeOut(v)}
            placeholder="Set time out"
            disabled={loading}
          />
        </Form.Item>
        <Divider />

            <Form.Item label="Attendance Events">
            <Checkbox
                checked={replaceEvents}
                onChange={(e) => setReplaceEvents(e.target.checked)}
                disabled={loading}
            >
                Replace existing events
            </Checkbox>

            <div style={{ marginTop: 12 }}>
                <CreateAttendance
                disabled={loading}
                onChange={setEvents}
                />
            </div>
            </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAttendance;