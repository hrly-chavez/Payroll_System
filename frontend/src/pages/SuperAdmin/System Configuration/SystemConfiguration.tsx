// src/pages/SuperAdmin/System Configuration/SystemConfiguration.tsx

import React, { useState, useEffect } from "react";
import { Layout, Tabs } from "antd";
import type { TabsProps } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import "./SystemConfiguration.css";

import PayRulesTab from "./Pay Rules/PayRulesTab";
import ContributionTab from "./Contribution/ContributionTab";
import LeaveTab from "./Leave/LeaveTab";
import CommissionTypeTab from "./CommissionType/CommissionTypeTab";
import ShiftTab from "./Workshifts/ShiftTab";
import AllowanceTypeTab from "./AllowanceType/AllowanceType";
import HolidayPolicy from "./HolidayPolicy/HolidayPolicy";
import TaxRulesTab from "./TaxRules/TaxRulesTab";
import LoanRulesTab from "./LoanRules/LoanRulesTab";
import LeaveCreditMaxTab from "./LeaveCredit/LeaveCreditTab";

import CommissionRuleTab from "./Commission Rules/CommissionRuleTab";

const { Content } = Layout;

type TabType =
  | "contribution"
  | "payroll"
  | "leave"
  | "leave_credit_max"
  | "commission"          
  | "commission_rules" 
  | "tax_rules"
  | "loan_rules"
  | "workshifts"
  | "allowance"
  | "holiday";

const SystemConfiguration: React.FC = () => {
  const [activeKey, setActiveKey] = useState<TabType>(() => {
    return (localStorage.getItem("systemConfigTab") as TabType) || "contribution";
  });

  useEffect(() => {
    localStorage.setItem("systemConfigTab", activeKey);
  }, [activeKey]);


  const items: TabsProps["items"] = [
    {
      label: "Workshifts",
      key: "workshifts",
      children: <ShiftTab active />,
    },
    {
      label: "Contribution Table",
      key: "contribution",
      children: <ContributionTab active />,
    },
    {
      label: "Payroll Rules",
      key: "payroll",
      children: <PayRulesTab active />,
    },
    {
      label: "Tax Brackets Rules",
      key: "tax_rules",
      children: <TaxRulesTab active />,
    },
    {
      label: "Loan Rules",
      key: "loan_rules",
      children: <LoanRulesTab active />,
    },
    {
      label: "Leave Credit Max",
      key: "leave_credit_max",
      children: <LeaveCreditMaxTab active />,
    },
    {
      label: "Leave Types",
      key: "leave",
      children: <LeaveTab active />,
    },
    {
      label: "Commission Types",
      key: "commission",
      children: <CommissionTypeTab active />,
    },
    // Optional
    // {
    //   label: "Commission Rules",
    //   key: "commission_rules",
    //   children: <CommissionRuleTab active />,
    // },
    {
      label: "Allowance Types",
      key: "allowance",
      children: <AllowanceTypeTab active />,
    },
    {
      label: "Holiday Policy",
      key: "holiday",
      children: <HolidayPolicy active />,
    },
  ];

  return (
    <Layout className="system-layout">
      <Sidebar />
      <Layout>
        <Topbar title="System Configuration" />
        <Content className="system-content">
          <div className="config-container">

            <Tabs
              type="card"
              activeKey={activeKey}
              onChange={(key) => setActiveKey(key as TabType)}
              items={items}
            />

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;