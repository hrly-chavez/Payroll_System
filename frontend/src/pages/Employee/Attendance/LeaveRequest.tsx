import React from "react";
import { Modal, Form, Select, DatePicker, Input, Button } from "antd";
import styles from "./LeaveRequest.module.css";

interface LeaveRequestProps {
  open: boolean;
  onClose: () => void;
}

const { RangePicker } = DatePicker;

const LeaveRequest: React.FC<LeaveRequestProps> = ({ open, onClose }) => {
  return (
    <Modal
      title="Request Leave"
      open={open}
      onCancel={onClose}
      footer={null}
      className={styles.modal}
    >
      <Form layout="vertical">
        <Form.Item label="Leave Type" name="type" required>
          <Select placeholder="Select leave type">
            <Select.Option value="sick">Sick Leave</Select.Option>
            <Select.Option value="vacation">Vacation Leave</Select.Option>
            <Select.Option value="emergency">Emergency Leave</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Date Range" name="date" required>
          <RangePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Reason" name="reason">
          <Input.TextArea rows={4} />
        </Form.Item>

        <Button type="primary" block>
          Submit Request
        </Button>
      </Form>
    </Modal>
  );
};

export default LeaveRequest;
