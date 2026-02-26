import React, { useEffect, useMemo, useState } from "react";
import { Layout, Tabs, Button, Input, DatePicker, message } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import "./Reports.css";

import api from "api/axios";
import UserActivity from "./User activity/UserActivity";
import AttendaceLogs from "./AttendanceLogs/attendance_logs";
import PayrollReleaseLogs from "./Payroll_Logs/payroll_release_logs";

// ✅ NEW
import AttendanceReportModal from "./AttendanceLogs/attendance_report_modal";

const { Content } = Layout;
const { TabPane } = Tabs;

const TAB_STORAGE_KEY = "reports_active_tab";

const downloadFile = async (url: string, filename: string) => {
  const res = await api.get(url, { responseType: "blob" });

  const blob = new Blob([res.data], { type: "application/pdf" });
  const objectUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem(TAB_STORAGE_KEY) || "1";
  });

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string | null>(null);

  //  Tab 3 selected period
  const [selectedPayrollPeriodId, setSelectedPayrollPeriodId] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);

  //  Tab 2 modal
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  //  dropdown data
  const [employeeOptions, setEmployeeOptions] = useState<{ value: number; label: string }[]>([]);

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  //  load employees for dropdown 
  const loadEmployees = async () => {
    try {
      const res = await api.get("/employees/dropdown/");
      const data = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);

      const opts = data.map((e: any) => ({
        value: Number(e.value ?? e.id),
        label: String(e.label ?? `Employee #${e.value ?? e.id}`),
      }));

      setEmployeeOptions(opts);
    } catch (err) {
      console.error(err);
      message.error("Failed to load employees for dropdown.");
      setEmployeeOptions([]);
    }
  };

  useEffect(() => {
    loadEmployees(); 
  }, []);

  const filenameToday = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const handleGenerateReport = async () => {
    //  TAB 2: open modal (choose all/specific + date/month/year)
    if (activeTab === "2") {
      setAttendanceModalOpen(true);
      return;
    }

    //  TAB 1
    if (activeTab === "1") {
      try {
        setGenerating(true);

        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (month) params.append("month", month);

        await downloadFile(
          `/reports/user-activity/pdf/?${params.toString()}`,
          `User_Activity_Logs_${filenameToday}.pdf`
        );
      } catch (err) {
        console.error(err);
        message.error("Failed to generate user activity report.");
      } finally {
        setGenerating(false);
      }
      return;
    }

    //  TAB 3 (needs selected period)
    if (activeTab === "3") {
      if (!selectedPayrollPeriodId) {
        message.warning("Please select a payroll period first.");
        return;
      }

      try {
        setGenerating(true);

        await downloadFile(
          `/payroll/reports/payroll-periods/${selectedPayrollPeriodId}/release-logs/pdf/`,
          `Payroll_Release_Logs_${selectedPayrollPeriodId}_${filenameToday}.pdf`
        );
      } catch (err) {
        console.error(err);
        message.error("Failed to generate payroll release report.");
      } finally {
        setGenerating(false);
      }
    }
  };

  //  called by the attendance modal
  const handleGenerateAttendancePDF = async (payload: {
    scope: "all" | "user";
    employeeId?: number;
    filterType: "date" | "month" | "year";
    date?: string;
    month?: string;
    year?: string;
  }) => {
    try {
      setGenerating(true);

      const params = new URLSearchParams();
      params.append("scope", payload.scope);

      if (payload.scope === "user") {
        if (!payload.employeeId) {
          message.warning("Please select an employee.");
          return;
        }
        params.append("employee_id", String(payload.employeeId));
      }

      if (payload.filterType === "date" && payload.date) params.append("date", payload.date);
      if (payload.filterType === "month" && payload.month) params.append("month", payload.month);
      if (payload.filterType === "year" && payload.year) params.append("year", payload.year);

      // optional (only if your backend supports it)
      // if (search) params.append("search", search);

      await downloadFile(
        `/employees/reports/attendance-corrections/pdf/?${params.toString()}`, //  FIXED URL
        `Attendance_Correction_Logs_${filenameToday}.pdf`
      );
    } catch (err) {
      console.error(err);
      message.error("Failed to generate attendance correction report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout className="reports-layout">
      <Sidebar />

      <Layout>
        <Topbar title="Reports" />

        <Content className="reports-content">
          <div className="reports-card">
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                if (key !== "3") setSelectedPayrollPeriodId(null);
              }}
            >
              <TabPane tab="User Activity Logs" key="1" />
              <TabPane tab="Attendance Correction Logs" key="2" />
              <TabPane tab="Payroll Release Logs" key="3" />
            </Tabs>

            <div className="reports-filters">
              <Input.Search
                placeholder="Search"
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="filters-right">
                <DatePicker picker="month" onChange={(d) => setMonth(d ? d.format("YYYY-MM") : null)} />

                <Button type="primary" onClick={handleGenerateReport} loading={generating}>
                  Generate Report
                </Button>
              </div>
            </div>

            {activeTab === "1" && <UserActivity />}
            {activeTab === "2" && <AttendaceLogs />}
            {activeTab === "3" && (
              <PayrollReleaseLogs
                selectedPeriodId={selectedPayrollPeriodId}
                onSelectPeriodId={setSelectedPayrollPeriodId}
              />
            )}

            {/*  Attendance report modal */}
            <AttendanceReportModal
              open={attendanceModalOpen}
              onClose={() => setAttendanceModalOpen(false)}
              onGenerate={handleGenerateAttendancePDF}
              employeeOptions={employeeOptions}
            />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Reports;