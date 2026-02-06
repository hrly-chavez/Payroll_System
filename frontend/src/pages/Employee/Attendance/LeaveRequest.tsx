import React from "react";
import { Modal, Form, Select, DatePicker, Input, Button, message } from "antd";
import styles from "./LeaveRequest.module.css";

interface LeaveRequestProps {
  open: boolean;
  onClose: () => void;
}

const { RangePicker } = DatePicker;

const LeaveRequest: React.FC<LeaveRequestProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Leave Request:", values);

    // TEMP: simulate success
    message.success("Leave request submitted successfully");
    form.resetFields();
    onClose();

    // LATER:
    // api.post("/leaves/", values)
  };

  return (
    <Modal
      title="Request Leave"
      open={open}
      onCancel={onClose}
      footer={null}
      className={styles.modal}
      destroyOnClose
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <Form.Item
          label="Leave Type"
          name="type"
          rules={[{ required: true, message: "Please select leave type" }]}
        >
          <Select placeholder="Select leave type">
            <Select.Option value="SICK">Sick Leave</Select.Option>
            <Select.Option value="VACATION">Vacation Leave</Select.Option>
            <Select.Option value="EMERGENCY">Emergency Leave</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Date Range"
          name="date_range"
          rules={[{ required: true, message: "Please select date range" }]}
        >
          <RangePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Reason" name="reason">
          <Input.TextArea rows={4} placeholder="Optional reason" />
        </Form.Item>

        <Button type="primary" block htmlType="submit">
          Submit Request
        </Button>
      </Form>
    </Modal>
  );
};

export default LeaveRequest;
