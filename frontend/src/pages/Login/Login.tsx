"use client";

import React from "react";
import { Form, Input, Button, Typography } from "antd";
import styles from "./login_styles.module.css";

const { Title } = Typography;

export default function Login() {
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
          className={styles.logo}
        />

        <Form
          layout="vertical"
          className={styles.form}
          onFinish={onFinish}
        >
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password />
          </Form.Item>

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
