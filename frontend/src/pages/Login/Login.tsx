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
      const response = await fetch(
        "http://127.0.0.1:8000/api/accounts/login/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_name: values.username,
            user_password: values.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Login failed");
        return;
      }

      // Store role for sidebar usage
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user_name", data.user.user_name);

      message.success("Login successful");

      // Redirect based on backend response
      navigate(data.redirect_to);
    } catch (error) {
      message.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* LEFT PANEL */}
      <div className={styles.leftPanel}>
        <img
          src="/images/attitech_full_logo.png"
          alt="ATI Tech"
          className={styles.logo}
        />
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.rightPanel}>
        <img
          src="/images/attitech_logo.png"
          alt="ATITech"
          className={styles.rightLogo}
        />

        <Form
          layout="vertical"
          className={styles.form}
          onFinish={onFinish}
        >
          {/* USERNAME */}
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input
              placeholder="Enter your username"
              prefix={<UserOutlined style={{ color: "rgba(0,0,0,0.35)" }} />}
            />
          </Form.Item>

          {/* PASSWORD */}
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              placeholder="Enter your password"
              prefix={<LockOutlined style={{ color: "rgba(0,0,0,0.35)" }} />}
              visibilityToggle={{
                visible: passwordVisible,
                onVisibleChange: setPasswordVisible,
              }}
            />
          </Form.Item>

          {/* LOGIN BUTTON */}
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className={styles.loginBtn}
            >
              Log in
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
