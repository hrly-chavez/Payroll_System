import React, { useEffect, useState } from "react";
import { Layout, Typography, Avatar, Button, Dropdown, message } from "antd";
import { ArrowLeftOutlined, LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./Topbar.css";
import NotificationBell from "../Notification/NotificationBell";
import api from "../../api/axios";

const { Header } = Layout;
const { Text } = Typography;

interface TopbarProps {
  title?: string;
  showBack?: boolean;
  onLogout?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({
  title = "Dashboard",
  showBack,
  onLogout,
}) => {
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState<number>(0);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout/"); // call backend

      message.success("You have been logged out successfully");

      if (onLogout) onLogout();

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      message.error("Failed to logout properly.");
    }
  };

  const fetchNotifCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count/");
      setNotifCount(res.data.count || 0); // assuming your API returns { count: number }
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      setNotifCount(0); // fallback
    }
  };

  useEffect(() => {
    fetchNotifCount();

    const interval = setInterval(fetchNotifCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      onClick: handleLogout,
    },
  ];

  return (
    <Header className="app-topbar">
      <div className="topbar-left">
        {showBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="topbar-back"
            onClick={() => navigate(-1)}
          />
        )}
        <Text className="topbar-title">{title}</Text>
      </div>

      <div className="topbar-right">
        <div>
          <NotificationBell count={notifCount} />
        </div>
        <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
          <Avatar className="topbar-avatar" style={{ cursor: "pointer" }}>
            U
          </Avatar>
        </Dropdown>
      </div>
    </Header>
  );
};

export default Topbar;