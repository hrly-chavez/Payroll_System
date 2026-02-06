import React, { useState } from "react";
import { Layout, Tabs } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Requests.module.css";

import AllRequests from "./AllRequests/AllRequests";
import LeaveRequest from "./LeaveRequest/LeaveRequest";
import AttendanceCorrectionRequest from "./AttendanceCorrectionRequest/AttendanceCorrectionRequest";

const { Content } = Layout;

const Requests: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Requests" />

        <Content className={styles.content}>
          <div className={styles.card}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              className={styles.tabs}
            >
              <Tabs.TabPane tab="All Requests" key="all">
                <AllRequests />
              </Tabs.TabPane>

              <Tabs.TabPane tab="Leave Request" key="leave">
                <LeaveRequest />
              </Tabs.TabPane>

              <Tabs.TabPane
                tab="Attendance Correction Request"
                key="attendance"
              >
                <AttendanceCorrectionRequest />
              </Tabs.TabPane>
            </Tabs>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Requests;
