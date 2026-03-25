// src/pages/Notifications/NotificationPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Layout,
  Card,
  List,
  message,
  Checkbox,
  Modal,
  Button,
  Tooltip,
  Empty,
  Tag,
} from "antd";
import {
  DeleteOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  DollarOutlined,
  BellOutlined,
  CheckCircleOutlined,
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
  category: "leave" | "attendance" | "holiday" | "payroll" | "loan";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const allSelected =
    notifications.length > 0 && selectedIds.length === notifications.length;

  const indeterminate =
    selectedIds.length > 0 && selectedIds.length < notifications.length;

  // ✅ Group notifications by Today / Yesterday / Earlier
  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    notifications.forEach((n) => {
      const d = new Date(n.created_at);
      let key = "Earlier";

      if (isSameDay(d, today)) key = "Today";
      else if (isSameDay(d, yesterday)) key = "Yesterday";

      (groups[key] ||= []).push(n);
    });

    // ✅ keep sections ordered
    const ordered: [string, Notification[]][] = [];
    if (groups["Today"]) ordered.push(["Today", groups["Today"]]);
    if (groups["Yesterday"]) ordered.push(["Yesterday", groups["Yesterday"]]);
    if (groups["Earlier"]) ordered.push(["Earlier", groups["Earlier"]]);

    return ordered;
  }, [notifications]);

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
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      message.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(
        unread.map((n) => api.post(`/notifications/${n.id}/mark-read/`))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      message.success("All notifications marked as read");
    } catch {
      message.error("Failed to mark all as read");
    }
  };

  const deleteSelected = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) => api.delete(`/notifications/${id}/`))
      );

      setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)));

      setSelectedIds([]);
      setSelectionMode(false);
      message.success("Deleted successfully");
    } catch {
      message.error("Failed to delete selected notifications");
    }
  };

  const getIcon = (category: Notification["category"]) => {
    switch (category) {
      case "leave":
      case "holiday":
        return <CalendarOutlined />;
      case "attendance":
        return <FileDoneOutlined />;
      case "payroll":
        return <DollarOutlined />;
      case "loan":
        return <DollarOutlined />;

      default:
        return <BellOutlined />;
    }
  };

  const getCategoryTag = (category: Notification["category"]) => {
    const map: Record<string, { label: string; cls: string }> = {
      leave: { label: "Leave", cls: styles.tagLeave },
      holiday: { label: "Holiday", cls: styles.tagHoliday },
      attendance: { label: "Attendance", cls: styles.tagAttendance },
      payroll: { label: "Payroll", cls: styles.tagPayroll },
      loan: { label: "Loan", cls: styles.tagLoan },
    };

    const v = map[category] || {
      label: "Unknown",
      cls: styles.tagDefault,
    };

    return <Tag className={`${styles.tag} ${v.cls}`}>{v.label}</Tag>;
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Notifications" />

<Content className={styles.content} style={{ width: "100%" }}>
          <Card className={styles.notificationCard} bordered={false}>
            {/* ===== HEADER / ACTION BAR ===== */}
            <div className={styles.headerRow}>
              <div className={styles.headerLeft}>
                <div className={styles.headerTitle}>
                  <BellOutlined className={styles.headerIcon} />
                  <div>
                    {/* ✅ Better header hierarchy */}
                   <div className={styles.headerMeta}>
                  <div className={styles.metaTitle}>
                    {unreadCount > 0 ? (
                      <>
                        You have <span className={styles.metaCount}>{unreadCount}</span> unread
                      </>
                    ) : (
                      "You're all caught up"
                    )}
                  </div>

                  <div className={styles.metaSub}>
                    {unreadCount > 0
                      ? "New updates from payroll, attendance, leave, and holidays."
                      : "No new updates right now."}
                  </div>
                </div>
                  </div>
                </div>
              </div>

              <div className={styles.headerRight}>
                {!selectionMode ? (
                  <>
                    <Tooltip title="Mark all as read">
                      <Button
                        icon={<CheckCircleOutlined />}
                        className={styles.ghostBtn}
                        onClick={markAllAsRead}
                        disabled={notifications.length === 0 || unreadCount === 0}
                      >
                        Mark all read
                      </Button>
                    </Tooltip>

                    <Tooltip title="Select to delete">
                      <Button
                        icon={<DeleteOutlined />}
                        className={styles.dangerGhostBtn}
                        onClick={() => setSelectionMode(true)}
                        disabled={notifications.length === 0}
                      >
                        Delete
                      </Button>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={indeterminate}
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? notifications.map((n) => n.id) : []
                        )
                      }
                      className={styles.selectAll}
                    >
                      Select all
                    </Checkbox>

                    <Button
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedIds([]);
                      }}
                    >
                      Cancel
                    </Button>

                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setDeleteModalOpen(true)}
                      disabled={selectedIds.length === 0}
                    >
                      Delete ({selectedIds.length})
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className={styles.divider} />

            {/* ===== GROUPED LIST (Today / Yesterday / Earlier) ===== */}
            {notifications.length === 0 && !loading ? (
              <div className={styles.emptyWrap}>
                <Empty description="No notifications yet" />
              </div>
            ) : (
              grouped.map(([label, items]) => (
                <div key={label} className={styles.groupBlock}>
                  <div className={styles.groupLabel}>{label}</div>

                  <List
                    loading={loading}
                    dataSource={items}
                    renderItem={(item) => (
                      <List.Item
                        className={`${styles.notificationItem} ${
                          !item.is_read ? styles.unread : ""
                        }`}
                      >
                        <div className={styles.itemRow}>
                          {selectionMode && (
                            <Checkbox
                              className={styles.itemCheckbox}
                              checked={selectedIds.includes(item.id)}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((i) => i !== item.id)
                                    : [...prev, item.id]
                                )
                              }
                            />
                          )}

                          <div
                            className={styles.itemContent}
                            onClick={() => {
                              if (!selectionMode) {
                                markAsRead(item.id);
                                if (item.redirect_url) navigate(item.redirect_url);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            {/* ✅ Category-colored icon bubble */}
                            <div
                              className={`${styles.iconBubble} ${
                               styles[`icon_${item.category}`] || styles.icon_default
                              }`}
                            >
                              {getIcon(item.category)}
                            </div>

                            <div className={styles.textBlock}>
                              <div className={styles.titleRow}>
                                <div className={styles.titleLeft}>
                                  <div className={styles.title}>{item.title}</div>
                                  {!item.is_read && (
                                    <span className={styles.unreadDot} />
                                  )}
                                </div>

                                {getCategoryTag(item.category)}
                              </div>

                              <div className={styles.desc}>{item.description}</div>

                              <div className={styles.time}>
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              ))
            )}

            {/* ===== DELETE MODAL (single instance) ===== */}
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
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default NotificationPage;