// src/pages/HR/EmployeeDetailPage/Modals/ForgotPasswordModal.tsx
import React, { useState } from "react";
import { Modal, Button, message, Form, Input } from "antd";
import api from "api/axios";

interface Props {
  open: boolean;
  username: string;
  userId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const ForgotPasswordModal: React.FC<Props> = ({ open, username, userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleResetPassword = async () => {
    if (!userId) return;

    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post(`/employees/users/${userId}/reset-password/`, {
        reason: values.reason, // 🔹 send reason to backend
      });

      message.success(`Password reset successfully for ${username}.`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Reset Password for ${username}`}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          onClick={handleResetPassword}
        >
          Yes, Proceed
        </Button>,
      ]}
      destroyOnClose
    >
      <p>
        Are you sure you want to reset the password for <strong>{username}</strong>? 
        The new password will be generated automatically and emailed to the user.
      </p>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Reason for Reset"
          name="reason"
          rules={[{ required: true, message: "Please provide a reason for this reset" }]}
        >
          <Input.TextArea rows={3} placeholder="Provide a reason..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ForgotPasswordModal;