// src/pages/Employee/Attendance/AttendanceCorrection/AttendanceCorrection.tsx
import React, { useEffect, useState } from "react";
import { Modal, Input, Select, Button, DatePicker, message, Alert } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import styles from "./AttendanceCorrection.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void; // optional: refresh list after submit
}

const { Option } = Select;
const { TextArea } = Input;

const AttendanceCorrection: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [date, setDate] = useState<Dayjs | null>(null);
  const [issueType, setIssueType] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [issueTypeOptions, setIssueTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const resetForm = () => {
    setDate(null);
    setIssueType(undefined);
    setReason("");
    setFile(null);
    setErrorMsg(null);
  };

  const handleClose = () => {
      resetForm();
      onClose();
    };
    useEffect(() => {
    const fetchMeta = async () => {
      try {
        setMetaLoading(true);
        const res = await api.get("/attendance/corrections/meta/");
        setIssueTypeOptions(res.data?.issue_types || []);
      } catch (err) {
        // don't hard-fail the modal, just show a message
        message.error("Failed to load issue types.");
        setIssueTypeOptions([]);
      } finally {
        setMetaLoading(false);
      }
    };

    if (open) {
      fetchMeta();
    }
  }, [open]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!date) {
      setErrorMsg("Please select a date.");
      return;
    }
    if (!issueType) {
      setErrorMsg("Please select an issue type.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Please enter a reason.");
      return;
    }

    const formData = new FormData();
    formData.append("date", dayjs(date).format("YYYY-MM-DD"));
    formData.append("issue_type", issueType);
    formData.append("reason", reason.trim());
    if (file) formData.append("file_attached", file);

    try {
      setLoading(true);

      // IMPORTANT: do not set Content-Type manually for FormData
      await api.post("/attendance/corrections/", formData);

      message.success("Attendance correction request submitted.");
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      const data = err?.response?.data;

      // show DRF ValidationError cleanly
      const detail =
        data?.detail ||
        data?.message ||
        (typeof data === "string" ? data : null);

      // if field errors, show the first one
      const firstFieldError =
        data && typeof data === "object"
          ? Object.values(data)?.flat()?.[0]
          : null;

      setErrorMsg(detail || firstFieldError || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onCancel={handleClose} footer={null} centered width={600}>
      <div className={styles.modalContent}>
        <h2>Request Attendance Correction</h2>

        {errorMsg && (
          <Alert
            type="error"
            showIcon
            message={errorMsg}
            style={{ marginBottom: 12 }}
          />
        )}

        <label>Date</label>
        <DatePicker
          className={styles.input}
          value={date}
          onChange={(val) => setDate(val)}
        />

        <label>Issue Type</label>
        <Select
            className={styles.input}
            value={issueType}
            onChange={(val) => setIssueType(val)}
            placeholder="Select issue type"
            loading={metaLoading}
            disabled={metaLoading}
          >
            {issueTypeOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>

        <label>Reason</label>
        <TextArea
          rows={3}
          className={styles.input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what happened..."
        />

        <label>Attachment (Optional)</label>
        <input
          type="file"
          className={styles.input as any}
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
          }}
        />

        <div className={styles.buttonRow}>
          <Button
            type="primary"
            className={styles.requestModalBtn}
            loading={loading}
            onClick={handleSubmit}
          >
            Request
          </Button>
          <Button
            className={styles.cancelModalBtn}
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AttendanceCorrection;