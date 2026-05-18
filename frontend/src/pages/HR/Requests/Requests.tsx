import React, { useState } from "react";
import { Layout, Tabs, Badge } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Requests.module.css";

import LeaveRequests from "./LeaveRequest/LeaveRequest";
import AttendanceCorrectionRequest from "./AttendanceCorrectionRequest/AttendanceCorrectionRequest";
import HolidayRequests from "./HolidayRequest/HolidayRequest";

const { Content } = Layout;

const Requests: React.FC = () => {
  const [activeTab, setActiveTab] = useState("leave");

  // 👉 replace this with API data later
  const unread = {
    leave: 3,
    attendance: 0,
    holiday: 1,
  };

  const items = [
    {
      key: "leave",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Leave Request
          {unread.leave > 0 && (
            <Badge count={unread.leave} size="small" />
          )}
        </span>
      ),
      children: <LeaveRequests />,
    },
    {
      key: "attendance",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Attendance Correction Request
          {unread.attendance > 0 && (
            <Badge count={unread.attendance} size="small" />
          )}
        </span>
      ),
      children: <AttendanceCorrectionRequest />,
    },
    {
      key: "holiday",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Holiday Request
          {unread.holiday > 0 && (
            <Badge count={unread.holiday} size="small" />
          )}
        </span>
      ),
      children: <HolidayRequests />,
    },
  ];

  return (
    <Layout className={styles.layout}>
      <Sidebar />

      <Layout className={styles.mainLayout}>
        <Topbar title="Requests" />

        <Content className={styles.content}>
          <div className={styles.card}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={items}
              className={styles.tabs}
              tabPosition="top"
            />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Requests;