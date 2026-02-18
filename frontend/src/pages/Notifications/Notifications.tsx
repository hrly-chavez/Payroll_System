import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  List,
  Button,
  message,
  Checkbox,
  Tag,
  Popconfirm,
} from "antd";
import {
  DeleteOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar/Sidebar";
import Topbar from "../../components/Topbar/Topbar";
import styles from "./Notification_styles.module.css";

const { Content } = Layout;

interface Notification {
  id: number;
  title: string;
  description: string;
  is_read: boolean;
  created_at: string;
  category: "leave" | "attendance" | "holiday" | "payroll";
  redirect_url?: string;
}

const NotificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("http://127.0.0.1:8000/api/notifications/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
      } else if (data.results) {
        setNotifications(data.results);
      } else {
        setNotifications([]);
      }
      setLoading(false);
    } catch {
      message.error("Failed to load notifications");
    }
  };

  const markAsRead = async (id: number) => {
    const token = localStorage.getItem("authToken");

    await fetch(
      `http://127.0.0.1:8000/api/notifications/${id}/mark-read/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );
  };

  const deleteSelected = async () => {
    const token = localStorage.getItem("authToken");

    await Promise.all(
      selectedIds.map(id =>
        fetch(`http://127.0.0.1:8000/api/notifications/${id}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );

    setNotifications(prev =>
      prev.filter(n => !selectedIds.includes(n.id))
    );
    setSelectedIds([]);
  };

  const getIcon = (category: string) => {
    switch (category) {
      case "leave":
        return <CalendarOutlined />;
      case "attendance":
        return <FileDoneOutlined />;
      case "payroll":
        return <DollarOutlined />;
      default:
        return <CalendarOutlined />;
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Notifications" />
        <Content className={styles.content}>
          <Card className={styles.notificationCard}>

            {selectedIds.length > 0 && (
              <Button danger onClick={deleteSelected}>
                Delete Selected
              </Button>
            )}

            <List
              loading={loading}
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  className={`${styles.notificationItem} ${
                    !item.is_read ? styles.unread : ""
                  }`}
                >
                  <div className={styles.leftSection}>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onChange={() =>
                        setSelectedIds(prev =>
                          prev.includes(item.id)
                            ? prev.filter(i => i !== item.id)
                            : [...prev, item.id]
                        )
                      }
                    />

                    <div
                      className={styles.textBlock}
                      onClick={() => {
                        markAsRead(item.id);
                        if (item.redirect_url) {
                          navigate(item.redirect_url);
                        }
                      }}
                    >
                      <div className={styles.titleRow}>
                        {getIcon(item.category)}
                        <h4>{item.title}</h4>
                      </div>
                      <p>{item.description}</p>
                      <small>
                        {new Date(item.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>

                  <DeleteOutlined
                    onClick={() =>
                      setSelectedIds(prev => [...prev, item.id])
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default NotificationPage;