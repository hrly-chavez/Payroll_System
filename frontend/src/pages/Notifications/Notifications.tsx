import React, { useEffect, useState } from "react";
import { Layout, Card, List, Button, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import Sidebar from "../../components/Sidebar/Sidebar";
import Topbar from "../../components/Topbar/Topbar";
import styles from "./Notification_styles.module.css";

const { Content } = Layout;

interface Notification {
  id: number;
  title: string;
  description: string;
  is_read: boolean;
}

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/notifications/");
      const data = await res.json();
      setNotifications(data);
    } catch {
      message.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/notifications/${id}/`, {
        method: "DELETE",
      });

      setNotifications(prev => prev.filter(n => n.id !== id));
      message.success("Notification removed");
    } catch {
      message.error("Delete failed");
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Notification" />

        <Content className={styles.content}>
          <Card className={styles.notificationCard}>
            <List
              loading={loading}
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item className={styles.notificationItem}>
                  <div className={styles.textBlock}>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>

                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    className={styles.deleteBtn}
                    onClick={() => deleteNotification(item.id)}
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
