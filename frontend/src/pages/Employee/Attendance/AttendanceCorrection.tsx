import React from "react";
import { Modal, Input, Select, Button, DatePicker } from "antd";
import styles from "./AttendanceCorrection.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const { Option } = Select;
const { TextArea } = Input;

const AttendanceCorrection: React.FC<Props> = ({ open, onClose }) => {
  return (
    <Modal open={open} onCancel={onClose} footer={null} centered width={600}>
      <div className={styles.modalContent}>
        <h2>Request Attendance Correction</h2>

        <label>Date</label>
        <DatePicker className={styles.input} />

        <label>Issue Type</label>
        <Select className={styles.input}>
          <Option value="missed_in">Missed Punch In</Option>
          <Option value="missed_out">Missed Punch Out</Option>
          <Option value="wrong_time">Wrong Time</Option>
        </Select>

        <label>Reason</label>
        <TextArea rows={3} className={styles.input} />

        <label>Attachment (Optional)</label>
        <Input type="file" className={styles.input} />

        <div className={styles.buttonRow}>
          <Button
            type="primary"
            className={styles.requestModalBtn}
            >
            Request
            </Button>
            <Button
            type="primary"
            className={styles.cancelModalBtn}
            >
            Cancel
            </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AttendanceCorrection;
