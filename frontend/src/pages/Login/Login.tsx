"use client";

import React, { useState } from "react";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./login_styles.module.css";

interface LoginFormValues {
  username: string;
  password: string;
}

export default function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: values.username,
          user_password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Login failed");
        return;
      }

      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user_name", data.user.user_name);

      message.success("Login successful");
      navigate(data.redirect_to);
    } catch {
      message.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* LEFT BRAND PANEL */}
        <div className={styles.brandSide}>
          <img
            src="/images/attitechHD.png"
            alt="ATI Tech"
            className={styles.brandLogo}
          />
        </div>

        {/* RIGHT FORM PANEL */}
        <div className={styles.formSide}>
          <h2 className={styles.loginTitle}>LOGIN</h2>

          <Form layout="vertical" onFinish={onFinish} className={styles.form}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: "Enter username" }]}
            >
              <Input
                placeholder="Username"
                prefix={<UserOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "Enter password" }]}
            >
              <Input.Password
                placeholder="Password"
                prefix={<LockOutlined />}
                visibilityToggle={{
                  visible: passwordVisible,
                  onVisibleChange: setPasswordVisible,
                }}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className={styles.loginBtn}
            >
              Login
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
