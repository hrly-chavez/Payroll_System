import React, { useState } from "react";
import { Layout, Tabs } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Requests.module.css";

import AllRequests from "./AllRequests/AllRequests";
import LeaveRequests from "./LeaveRequest/LeaveRequest"; 
import AttendanceCorrectionRequest from "./AttendanceCorrectionRequest/AttendanceCorrectionRequest";
import HolidayRequests from "./HolidayRequest/HolidayRequest";

const { Content } = Layout;
const { TabPane } = Tabs;

const Requests: React.FC = () => {
  const [activeTab, setActiveTab] = useState("leave");

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

              <TabPane tab="Leave Request" key="leave">
                <LeaveRequests /> 
              </TabPane>

              <TabPane
                tab="Attendance Correction Request"key="attendance">
                <AttendanceCorrectionRequest />
              </TabPane>

              <TabPane
                tab="Holiday Request"key="holiday">
                <HolidayRequests />
              </TabPane>
            </Tabs>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Requests;
