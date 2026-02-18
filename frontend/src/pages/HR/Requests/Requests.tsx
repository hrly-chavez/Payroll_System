import React, { useState } from "react";
import { Layout, Tabs } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Requests.module.css";

import AllRequests from "./AllRequests/AllRequests";
import LeaveRequests from "./LeaveRequest/LeaveRequest"; 
import AttendanceCorrectionRequest from "./AttendanceCorrectionRequest/AttendanceCorrectionRequest";

const { Content } = Layout;
const { TabPane } = Tabs;

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
              <TabPane tab="All Requests" key="all">
                <AllRequests />
              </TabPane>

              <TabPane tab="Leave Request" key="leave">
                <LeaveRequests /> 
              </TabPane>

              <TabPane
                tab="Attendance Correction Request"
                key="attendance"
              >
                <AttendanceCorrectionRequest />
              </TabPane>
            </Tabs>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Requests;
