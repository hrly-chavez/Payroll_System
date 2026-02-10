//src/pages/SuperAdmin/System Configuration/SystemConfiguration.tsx
import React, { useState } from "react";
import { Layout } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import "./SystemConfiguration.css";

import PayRulesTab from "./Pay Rules/PayRulesTab";
import ContributionTab from "./Contribution/ContributionTab";
import LeaveTab from "./Leave/LeaveTab";
import CommissionTypeTab from "./CommissionType/CommissionTypeTab";


const { Content } = Layout;



const SystemConfiguration: React.FC = () => {
   const [activeTab, setActiveTab] = useState<"contribution" | "payroll" | "leave" | "commission">("contribution");

  return (
    <Layout className="system-layout">
      <Sidebar />
      <Layout>
        <Topbar title="System Configuration" />
        <Content className="system-content">
          <div className="config-container">
            {/* Tabs */}
            <div className="config-tabs">
              <button className={activeTab === "contribution" ? "active" : ""} onClick={() => setActiveTab("contribution")}>
                Contribution Table
              </button>
              <button className={activeTab === "payroll" ? "active" : ""} onClick={() => setActiveTab("payroll")}>
                Payroll Rules
              </button>
              <button className={activeTab === "leave" ? "active" : ""} onClick={() => setActiveTab("leave")}>
                Leave Types
              </button>
              <button className={activeTab === "commission" ? "active" : ""} onClick={() => setActiveTab("commission")}>
                Commission Types
              </button>

            </div>

            {/* Section Header */}
            <div className="section-header">
              <h3>
                {activeTab === "contribution"
                  ? "Contribution Table"
                  : activeTab === "payroll"
                  ? "Payroll Rules"
                  : activeTab === "leave"
                  ? "Leave Types"
                  : "Commission Types"}
              </h3>
            </div>

            {/* Tabs Content */}
            {activeTab === "contribution" && <ContributionTab active />}
            {activeTab === "payroll" && <PayRulesTab active />}
            {activeTab === "leave" && <LeaveTab active />}
            {activeTab === "commission" && <CommissionTypeTab active />}

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;