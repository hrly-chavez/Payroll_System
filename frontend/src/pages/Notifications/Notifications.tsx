import React, { useEffect, useState } from "react";
import { Layout, Card, List, message, Checkbox, Popconfirm, Modal } from "antd";
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
import api from "../../api/axios";

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications/");
      const data = res.data;
      setNotifications(Array.isArray(data) ? data : data.results || []);
    } catch {
      message.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/mark-read/`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      message.error("Failed to mark notification as read");
    }
  };

  const deleteSelected = async () => {
    try {
      await Promise.all(
        selectedIds.map(id =>
          api.delete(`/notifications/${id}/`)
        )
      );

      setNotifications(prev =>
        prev.filter(n => !selectedIds.includes(n.id))
      );

      setSelectedIds([]);
      setSelectionMode(false);
      message.success("Deleted successfully");
    } catch {
      message.error("Failed to delete selected notifications");
    }
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

            {/* ===== TOP BAR ===== */}
            <div className={styles.actionBar}>
              {!selectionMode ? (
                <DeleteOutlined
                  className={styles.topTrash}
                  onClick={() => setSelectionMode(true)}
                />
              ) : (
                <>
                  <Checkbox
                    checked={
                      notifications.length > 0 &&
                      selectedIds.length === notifications.length
                    }
                    indeterminate={
                      selectedIds.length > 0 &&
                      selectedIds.length < notifications.length
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? notifications.map(n => n.id)
                          : []
                      )
                    }
                  >
                    Select All
                  </Checkbox>

                  <DeleteOutlined
                    className={styles.topTrashActive}
                    onClick={() => setDeleteModalOpen(true)}
                  />
                </>
              )}
            </div>

            <List
              loading={loading}
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  className={`${styles.notificationItem} ${
                    !item.is_read ? styles.unread : ""
                  }`}
                >
                  <div className={styles.itemRow}>

                    {/* Checkbox only in selection mode */}
                    {selectionMode && (
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
                    )}

                    <Modal
                      title="Delete Selected Notifications"
                      open={deleteModalOpen}
                      onOk={() => {
                        deleteSelected();
                        setDeleteModalOpen(false);
                      }}
                      onCancel={() => setDeleteModalOpen(false)}
                      centered
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      Are you sure you want to delete the selected notifications?
                    </Modal>

                    <div
                      className={styles.textBlock}
                      onClick={() => {
                        if (!selectionMode) {
                          markAsRead(item.id);
                          if (item.redirect_url) {
                            navigate(item.redirect_url);
                          }
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