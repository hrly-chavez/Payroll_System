// src/pages/HR/Calendar/Payroll/AddEarnings.tsx

import React, { useState } from "react";
import { Modal, Form, Input, InputNumber, message } from "antd";
import api from "../../../../api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
  periodId: number;
  employeeId: number;
  onSuccess: () => void;
}

const AddEarnings: React.FC<Props> = ({
  open,
  onClose,
  periodId,
  employeeId,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post(
        `/payroll/payroll-period/${periodId}/employee/${employeeId}/additional-earnings/`,
        {
          name: values.name.trim(),
          amount: values.amount,
          remarks: values.remarks?.trim() || "",
        }
      );

      message.success("Additional earning added successfully");

      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) return;

      const backendMsg =
        error?.response?.data?.detail ||
        "Failed to add earning.";

      message.error(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Add Additional Earning"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Add"
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          label="Earning Name"
          name="name"
          rules={[
            { required: true, message: "Earning name is required" },
            { max: 100, message: "Max 100 characters only" },
          ]}
        >
          <Input placeholder="e.g. Incentive / Bonus / Dispute(?)" />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            { required: true, message: "Amount is required" },
            {
              validator: (_, value) => {
                if (value === undefined || value === null) {
                  return Promise.reject("Amount is required");
                }
                if (value <= 0) {
                  return Promise.reject("Amount must be greater than 0");
                }
                if (value > 1000000) {
                  return Promise.reject("Amount too large");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            precision={2}
            placeholder="Enter amount"
          />
        </Form.Item>

        <Form.Item
          label="Remarks (Optional)"
          name="remarks"
          rules={[
            { max: 255, message: "Max 255 characters only" },
          ]}
        >
          <Input.TextArea rows={3} placeholder="Optional notes..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddEarnings;