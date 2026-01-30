"use client";

import React, { useState } from "react";
import { Form, Input, Button } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import styles from "./login_styles.module.css";

export default function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const onFinish = (values: { username: string; password: string }) => {
    console.log("Login values:", values);
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

        <Form layout="vertical" className={styles.form} onFinish={onFinish}>
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
