import React, { useEffect, useState } from "react";
import { Layout, Typography, Avatar, Button, Dropdown } from "antd";
import { ArrowLeftOutlined, LogoutOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./Topbar.css";
import NotificationBell from "../Notification/NotificationBell";

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

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    navigate("/", { replace: true });
  };

  const fetchNotifCount = async () => {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/notifications/unread-count/",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();
      setNotifCount(data.count ?? 0);
    } catch {
      console.log("Failed to load notification count");
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
        <NotificationBell count={notifCount} />

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