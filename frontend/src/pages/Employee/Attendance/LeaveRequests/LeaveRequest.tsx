import React, { useEffect, useState } from "react";
import { Modal, Form, Select, DatePicker, Input, Button, message } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";
import styles from "./LeaveRequest.module.css";

const { RangePicker } = DatePicker;

const LeaveRequest = ({ open, onClose }: any) => {
  const [form] = Form.useForm();
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  /*Fetch leave types from backend */
  useEffect(() => {
    if (open) {
      api.get("/approvals/superadmin/leave-types/")
        .then((res) => setLeaveTypes(res.data))
        .catch(() => message.error("Failed to load leave types"));
    }
  }, [open]);

  const onFinish = async (values: any) => {
    if (!values.date_range) return;

    setLoading(true);

    try {
    const payload = {
      leave_type_id: values.leave_type,
      date_range: [
        values.date_range[0].format("YYYY-MM-DD"),
        values.date_range[1].format("YYYY-MM-DD"),
      ],
      reason: values.reason || "",
    };



      await api.post("/approvals/leaves/", payload);

      message.success("Leave request submitted successfully");
      form.resetFields();
      onClose();
    } catch (error: any) {
      message.error(
        error.response?.data?.detail ||
        error.response?.data?.non_field_errors?.[0] ||
        "Failed to submit leave request"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Request Leave"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        
        {/* Leave Type */}
        <Form.Item
          label="Leave Type"
          name="leave_type"
          rules={[{ required: true, message: "Please select leave type" }]}
        >
          <Select placeholder="Select leave type" loading={!leaveTypes.length}>
            {leaveTypes.map((type) => (
              <Select.Option key={type.id} value={type.id}>
                {type.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* Date Range */}
        <Form.Item
          label="Date Range"
          name="date_range"
          rules={[{ required: true, message: "Please select date range" }]}
        >
          <RangePicker
            style={{ width: "100%" }}
            disabledDate={(current) => {
              return current && current.startOf("day") < dayjs().startOf("day");
            }}
          />

        </Form.Item>

        {/* Reason */}
        <Form.Item label="Reason" name="reason">
          <Input.TextArea rows={4} />
        </Form.Item>

        <Button
          type="primary"
          block
          htmlType="submit"
          loading={loading}
          className={styles.submitBtn}
        >
          Submit Request  
        </Button>
      </Form>
    </Modal>
  );
};

export default LeaveRequest;
