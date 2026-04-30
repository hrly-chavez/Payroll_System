// src/pages/Employee/Attendance/Attendance.tsx
//employee
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {Layout,Card,Calendar,Tooltip,Button,Row,Select,Tabs,Spin,Table,Tag, DatePicker, Segmented} from "antd";
import type { Dayjs } from "dayjs";
import { CalendarOutlined, FileSearchOutlined } from "@ant-design/icons";
import AttendanceCorrectionLogs from "./AttendanceCorrection/AttendanceCorrectionLogs";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AttendanceCorrection from "./AttendanceCorrection/AttendanceCorrection";
import LeaveRequest from "./LeaveRequests/LeaveRequest";
import AttendaceLogs from "./AttendanceLogs";
import api from "../../../api/axios";
import styles from "./Attendance.module.css";
import SharedCalendar, {
  EventItem,
} from "../../../components/SharedCalendar/SharedCalendar";
import {
  HOLIDAY_LEGEND,
  PAYROLL_COLOR,
} from "../../../components/SharedCalendar/CalendarLegend";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";
import LeaveRequestLogs from "./LeaveRequests/LeaveRequestLogs";
import RequestLoan from "./LoanRequest/RequestLoan";
import RequestLoanLogs from "./LoanRequest/RequestLoanLogs";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const { Content } = Layout;

/* =========================
   Mock attendance data
========================= */
const attendanceData: Record<string, { in: string; out: string }> = {
  "2023-03-07": { in: "8:03 AM", out: "5:12 PM" },
  "2023-03-15": { in: "9:10 AM", out: "6:05 PM" },
  "2023-03-19": { in: "8:00 AM", out: "4:55 PM" },
};

const Attendance: React.FC = () => {
  const navigate = useNavigate();
  type PayrollPeriod = {
  id: number;
  start_date: string;
  end_date: string;
  };

  type Holiday = {
    id: number;
    date: string;
    name: string;
    type: "Regular" | "Special Non-Working" | "Special Working" | "Company Holiday";
    base: "PH" | "US" | "COMPANY";
  };

  type AttendanceRecord = {
    id: number;
    date: string;
    time_in: string | null;
    time_out: string | null;
  };
  type RangeMode = "Month" | "Week" | "Day";
  const [rangeMode, setRangeMode] = useState<RangeMode>("Month");

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);

  const loadHolidays = async () => {
    try {
      const res = await api.get("/approvals/holidays/");
      setHolidays(res.data);
    } catch {
      console.error("Failed to load holidays");
    }
  };

  const loadAttendance = async () => {
    try {
      let start: Dayjs;
      let end: Dayjs;

      if (rangeMode === "Month") {
        start = selectedMonth.startOf("month");
        end = selectedMonth.endOf("month");
     } else if (rangeMode === "Week") {
        start = selectedMonth.startOf("isoWeek");
        end = selectedMonth.endOf("isoWeek");
      } else {
        start = selectedMonth.startOf("day");
        end = selectedMonth.endOf("day");
      }

      const res = await api.get("/attendance/logs/", {
        params: {
          start_date: start.format("YYYY-MM-DD"),
          end_date: end.format("YYYY-MM-DD"),
        },
      });

      setAttendanceRecords(res.data.results || []);
    } catch (err) {
      console.error("Failed to load attendance", err);
    }
  };

  const loadPayrollPeriods = async () => {
    try {
      const res = await api.get("/payroll/periods/");
      setPayrollPeriods(res.data);
    } catch {
      console.error("Failed to load payroll periods");
    }
  };


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [leaveRefreshKey, setLeaveRefreshKey] = useState(0);
  const [loanRefreshKey, setLoanRefreshKey] = useState(0);


  useEffect(() => {
    loadHolidays();
    loadPayrollPeriods();
    loadAttendance();   
  }, []);

  useEffect(() => {
    setSelectedMonth(calendarValue);
  }, [calendarValue]);

  useEffect(() => {
    console.log("Calendar Attendance:", attendanceRecords);
  }, [attendanceRecords]);

  useEffect(() => {
    loadAttendance();
  }, [selectedMonth, rangeMode]);


    /* =========================
     Shared Calendar
  ========================== */

  const events = useMemo<EventItem[]>(() => {
    return [
      // ATTENDANCE EVENTS
      ...attendanceRecords.map<EventItem>((a) => ({
        type: "attendance",
        start_date: a.date,
        time_in: a.time_in ?? undefined,
        time_out: a.time_out ?? undefined,
      })),
      // HOLIDAYS
      ...holidays.map<EventItem>((h) => ({
        type: "holiday",
        start_date: h.date,
        title: `${h.base} Holiday – ${h.name}`,
        color: HOLIDAY_LEGEND[h.base][h.type].bgColor,
      })),
      // PAYROLL PERIODS
      ...payrollPeriods.map<EventItem>((p) => ({
        type: "payroll",
        start_date: p.start_date,
        end_date: p.end_date,
        title: "Payroll Period",
        color: PAYROLL_COLOR.bgColor,
      })),
    ];
  }, [holidays, payrollPeriods, attendanceRecords]);




  const year = selectedMonth.year();
  const month = selectedMonth.month();


  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className={styles.content}>
          {/* ===== Header actions ===== */}
          <Card>
            <Row
              justify="space-between"
              align="middle"
              className={styles.headerRow}
            >
              <div className={styles.actions}>
                <Button
                  className={styles.requestBtn}
                  icon={<CalendarOutlined />}
                  onClick={() => setIsModalOpen(true)}
                >
                  Request Attendance Correction
                </Button>

                <Button
                  className={styles.requestBtn}
                  icon={<CalendarOutlined />}
                  onClick={() => setIsLeaveOpen(true)}
                >
                  Request Leave
                </Button>

                  {/* <Button
                  className={styles.requestBtn}
                  icon={<CalendarOutlined />}
                  onClick={() => setIsLoanOpen(true)}
                >
                  Request Loan
                </Button> */}

              </div>
            </Row>

            {/* ===== Calendar ===== */}
            <div className={styles.calendarSection}>
              <SharedCalendar
                events={events}
                value={calendarValue}
                onPanelChange={(val) => setCalendarValue(val)}
              />
            </div>

            {/* Legend BELOW calendar */}
            <div style={{ marginTop: 16 }}>
              <CalendarLegendDisplay />
            </div>
            
          </Card>
                  
        
            
          {/* ===== Logs & Requests & Filter by Date ===== */}
          <Card className={styles.historyCard}>
            <Tabs
              defaultActiveKey="logs"
              className={styles.pillTabs}
              tabBarExtraContent={
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  
                  <Segmented
                    value={rangeMode}
                    onChange={(val) => setRangeMode(val as RangeMode)}
                    options={["Month", "Week", "Day"]}
                  />

                  {rangeMode === "Month" ? (
                    <DatePicker
                      picker="month"
                      value={selectedMonth}
                      onChange={(d) => d && setSelectedMonth(d)}
                    />
                  ) : (
                    <DatePicker
                      value={selectedMonth}
                      onChange={(d) => d && setSelectedMonth(d)}
                    />
                  )}
                </div>
              }
            >
              <Tabs.TabPane tab="Attendance Logs" key="logs">
                <AttendaceLogs year={year} month={month + 1} />
              </Tabs.TabPane>

              <Tabs.TabPane tab="Leave Request(s)" key="requests">
                <LeaveRequestLogs refreshKey={leaveRefreshKey} />
              </Tabs.TabPane>

              <Tabs.TabPane tab="Attendance Correction Request(s)" key="corrections">
                <AttendanceCorrectionLogs />
              </Tabs.TabPane>
            </Tabs>
          </Card>
          

          {/* ===== Modals ===== */}
          <AttendanceCorrection
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)} 
          />
          <LeaveRequest
            open={isLeaveOpen}
            onClose={() => setIsLeaveOpen(false)}
            onSuccess={() => {
              setLeaveRefreshKey((prev) => prev + 1);
            }}
          />

          <RequestLoan
            open={isLoanOpen}
            onClose={() => setIsLoanOpen(false)}
            onSuccess={() => {
              setLoanRefreshKey((prev) => prev + 1);
            }}
          />

        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
