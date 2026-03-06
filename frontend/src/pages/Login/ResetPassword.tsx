"use client";

import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Typography } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import styles from "./login_styles.module.css";

const { Text } = Typography;

interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [password, setPassword] = useState("");

  const getHint = () => {
    if (!password) return "";
    if (!/[A-Z]/.test(password)) return "Password must have at least one uppercase letter";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[!@#$%^&*(),.?\":{}|<>_-]/.test(password))
      return "Password must have at least one special character (e.g., !@#$%_-)";
    if (!/\d/.test(password)) return "Password must have at least one number";
    return "";
  };

  // Check token on page load
  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        navigate("/unauthorized", { replace: true });
        return;
      }

      try {
        await api.get(`/employees/check-reset-token/${token}/`);
        // token valid → do nothing
      } catch (err: any) {
        // Friendly message before redirect
        if (err.response?.status === 401) {
          message.error("This reset link has expired or has already been used. Please request a new password reset.");
        } else {
          message.error("Invalid reset link. Please request a new password reset.");
        }
        navigate("/unauthorized", { replace: true });
      }
    };

    checkToken();
  }, [token, navigate]);

  const onFinish = async (values: ResetPasswordValues) => {
    if (values.password !== values.confirmPassword) {
      message.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/employees/reset-password-confirm/", {
        token,
        password: values.password,
      });

      message.success("Password reset successful! You can now login.");
      navigate("/", { replace: true });
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 400) {
        if (Array.isArray(detail)) {
          form.setFields([{ name: "password", errors: detail }]);
        } else {
          message.error(detail || "Something went wrong.");
        }
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
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>Reset Password</h2>

        <Form layout="vertical" onFinish={onFinish} form={form}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[{ required: true, message: "Enter new password" }]}
          >
            <Input.Password
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Item>

          {getHint() && (
            <Text type="warning" style={{ display: "block", marginBottom: 16 }}>
              {getHint()}
            </Text>
          )}

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Reset Password
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPassword;