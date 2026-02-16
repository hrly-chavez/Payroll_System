"use client";

import React, { useState, useEffect } from "react";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./login_styles.module.css";
import api from "../../api/axios";
import SuperAdminSetupModal from "../HR/AdminDepartmentEmployee/AddEmployee/AddEmployeeFlow";

interface LoginFormValues {
  username: string;
  password: string;
}

export default function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const res = await api.get("/accounts/first-superadmin-check/");
        if (res.data.total_users === 0 || !res.data.super_admin_exists) {
          setShowSuperAdminModal(true);
        }
      } catch (err) {
        console.error("Failed to check superadmin:", err);
      }
    };

    checkSuperAdmin();
  }, []);


  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      // 1️⃣ Get JWT tokens
      const tokenRes = await api.post("/auth/token/", {
        user_name: values.username,
        password: values.password,
      });

      const { access, refresh } = tokenRes.data;

      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);

      // 2️⃣ Get logged-in user info
      const meRes = await api.get("/accounts/me/");

      localStorage.setItem("user_name", meRes.data.user_name);
      localStorage.setItem("role", meRes.data.role);

      // 3️⃣ Role-based redirect
      const role = meRes.data.role;

      if (role === "EMPLOYEE") navigate("/employee_dashboard");
      else if (role === "ADMIN") navigate("/admin/dashboard");
      else if (role === "SUPER_ADMIN") navigate("/super-admin/dashboard");
      else navigate("/");

      message.success("Login successful");
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandSide}>
          <img
            src="/images/attitechHD.png"
            alt="ATI Tech"
            className={styles.brandLogo}
          />
        </div>

        <div className={styles.formSide}>
          <h2 className={styles.loginTitle}>LOGIN</h2>

          <Form layout="vertical" onFinish={onFinish} className={styles.form}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: "Enter username" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Username" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "Enter password" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Password"
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
      {showSuperAdminModal && (
        <SuperAdminSetupModal
          open={showSuperAdminModal}
          onClose={() => setShowSuperAdminModal(false)}
          mode="SUPERADMIN_SETUP"
        />
      )}
    </div>
  );
}
