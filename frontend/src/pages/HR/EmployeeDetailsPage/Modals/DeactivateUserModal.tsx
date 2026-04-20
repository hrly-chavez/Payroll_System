import React, { useState } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import api from "../../../../api/axios";

interface Props {
  open: boolean;
  userId: number;
  username: string;
  isActive: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DeactivateUserModal: React.FC<Props> = ({
  open,
  userId,
  username,
  isActive,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post(`/employees/users/${userId}/deactivate/`, {
        reason: values.reason,
      });

      message.success(
        `User ${isActive ? "deactivated" : "reactivated"} successfully`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.detail || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`${isActive ? "Deactivate" : "Reactivate"} User: ${username}`}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          {isActive ? "Deactivate" : "Reactivate"}
        </Button>,
      ]}
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          label="Reason for Change"
          name="reason"
          rules={[
            {
              required: true,
              message: "Please provide a reason for this action",
            },
          ]}
        >
          <Input.TextArea rows={3} placeholder="Provide a reason..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DeactivateUserModal;