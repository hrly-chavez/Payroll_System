"use client";

import React, { useState } from "react";
import { Form, Input, Button, Card, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import styles from "./login_styles.module.css";

interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: ResetPasswordValues) => {
    if (values.password !== values.confirmPassword) {
      message.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/employees/reset-password-confirm/", {
        uid,
        token,
        password: values.password,
      });

      message.success("Password reset successful! You can now login.");
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.response?.status === 400) {
        message.error("Invalid or expired reset link.");
      } else {
        message.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Card style={{ width: 400 }}>
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>
          Reset Password
        </h2>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Enter new password" },
              { min: 8, message: "Password must be at least 8 characters" },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            rules={[{ required: true, message: "Confirm your password" }]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
          >
            Reset Password
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;