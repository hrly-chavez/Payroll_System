"use client";

import React, { useState } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import api from "../../api/axios";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface ForgotPasswordValues {
  username: string;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: ForgotPasswordValues) => {
    setLoading(true);

    try {
      await api.post("/employees/forgot-password/", {
        username: values.username.trim(),
      });

      // 🔐 Always show same message (security)
      message.success(
        "If the username exists, a password reset link has been sent."
      );

      onClose();
    } catch (err) {
      message.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Forgot Password"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: "Please enter your username" }]}
        >
          <Input placeholder="Enter your username" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={loading}>
          Send Reset Link
        </Button>
      </Form>
    </Modal>
  );
};

export default ForgotPasswordModal;