"use client";

import React, { useState, useEffect } from "react";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./login_styles.module.css";
import api from "../../api/axios";
import ForgotPasswordModal from "./ForgotPasswordModal";

// NEW import for first-time super admin creation
import AddFirstSuperadmin from "./AddFirstSuperadmin";

interface LoginFormValues {
  username: string;
  password: string;
}

export default function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  //for modal
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const res = await api.get("/accounts/first-superadmin-check/");
        // Show modal only if there are no users or no super admin
        if (res.data.total_users === 0 || !res.data.super_admin_exists) {
          setShowSuperAdminModal(true);
        }
      } catch (err) {
        console.error("Failed to check superadmin:", err);
      }
    };

    checkSuperAdmin();
  }, []);

  const sanitizeInput = (value: string) => {
    if (!value) return "";

    // Remove leading/trailing spaces
    let sanitized = value.trim();

    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Escape special characters
    sanitized = sanitized
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/`/g, "&#x60;");

    // Normalize spaces
    sanitized = sanitized.replace(/\s+/g, " ");

    return sanitized;
  };

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);

    try {
      const sanitizedUsername = sanitizeInput(values.username);
      const sanitizedPassword = sanitizeInput(values.password);

      if (!sanitizedUsername || !sanitizedPassword) {
        message.error("Username or password cannot be empty or contain HTML.");
        setLoading(false);
        return;
      }

      const tokenRes = await api.post("/accounts/login/", {
        user_name: sanitizedUsername,
        password: sanitizedPassword,
      });

      const { access, refresh } = tokenRes.data;

      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);

      const meRes = await api.get("/accounts/me/");

      const userName = meRes.data.user_name;
      const role = meRes.data.role;

      localStorage.setItem("user_name", userName);
      localStorage.setItem("role", role);

      // 🎉 Welcome message
      message.success(`Welcome back, ${userName}!`);

      // Navigate based on role
      if (role === "EMPLOYEE") {
        navigate("/employee_dashboard", { replace: true });
      } else if (role === "ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else if (role === "SUPER_ADMIN") {
        navigate("/super-admin/dashboard", { replace: true });
      } else {
        message.error("Invalid user role. Please contact administrator.");
      }

    } catch (err: any) {
      // 🔥 Proper error trapping
      if (err.response) {
        const status = err.response.status;

        if (status === 401) {
          message.error("User does not exist or invalid credentials.");
        } else if (status === 400) {
          message.error("Invalid login request.");
        } else if (status >= 500) {
          message.error("Server error. Please try again later.");
        } else {
          message.error("Login failed. Please try again.");
        }
      } else {
        message.error("Network error. Please check your connection.");
      }
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
            <div style={{ textAlign: "right", marginBottom: "10px" }}>
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => setForgotPasswordOpen(true)}
              >
                Forgot Password?
              </Button>
            </div>

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
        <AddFirstSuperadmin
          open={showSuperAdminModal}
          onClose={() => setShowSuperAdminModal(false)}
          onNext={(employeeId, credentials) => {
            console.log("SUPER_ADMIN created!", employeeId, credentials);
            setShowSuperAdminModal(false);
          }}
          mode="SUPERADMIN_SETUP"
        />
      )}

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />

    </div>
  );
}
