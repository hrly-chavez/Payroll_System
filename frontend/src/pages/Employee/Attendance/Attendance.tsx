// src/pages/Employee/Attendance/Attendance.tsx
"use client";

import React, { useState, useEffect, useMemo} from "react";
import {Layout,Card,Calendar,Tooltip,Button,Row,Select,Tabs,Spin,Table,Tag,} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {CalendarOutlined,LeftOutlined,RightOutlined,} from "@ant-design/icons";

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
      const res = await api.get("/attendance/logs/", {
        params: {
          year: calendarValue.year(),
          month: calendarValue.month() + 1,
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
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());

  /* =========================
     Leave Requests state
  ========================== */
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchLeaveRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get("/approvals/leaves/");
      setLeaveRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch leave requests", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  useEffect(() => {
  fetchLeaveRequests();
  loadHolidays();
  loadPayrollPeriods();
  loadAttendance();   
}, []);

  useEffect(() => {
    console.log("Calendar Attendance:", attendanceRecords);
  }, [attendanceRecords]);

  useEffect(() => {
    loadAttendance();
  }, [calendarValue]);


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



  /* =========================
     Calendar controls
  ========================== */
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: dayjs().month(i).format("MMMM"),
    value: i,
  }));

  const year = calendarValue.year();
  const month = calendarValue.month();
  const years = Array.from({ length: 10 }, (_, i) => year - 5 + i);

  const goPrevMonth = () => setCalendarValue((v) => v.subtract(1, "month"));
  const goNextMonth = () => setCalendarValue((v) => v.add(1, "month"));
  const setMonth = (m: number) => setCalendarValue((v) => v.month(m));
  const setYear = (y: number) => setCalendarValue((v) => v.year(y));

  /* =========================
     Calendar cell render
  ========================== */
  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const record = attendanceData[dateStr];
    if (!record) return null;

    return (
      <Tooltip title={`In: ${record.in} | Out: ${record.out}`}>
        <div className={styles.attendanceDot} />
      </Tooltip>
    );
  };

  /* =========================
     Leave Requests table columns
  ========================== */
  const leaveColumns = [
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      key: "leave_type",
    },
    {
      title: "Half Day",
      dataIndex: "is_halfday",
      key: "is_halfday",
      render: (val: boolean) => (val ? "Yes" : "No"),
    },
    {
      title: "Half Day Part",
      dataIndex: "halfday_part",
      key: "halfday_part",
      render: (val: string | null) => val ?? "-",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
    },
    {
      title: "Date From",
      dataIndex: "date_from",
      key: "date_from",
      render: (val: string) => dayjs(val).format("DD MMM YYYY"),
    },
    {
      title: "Date To",
      dataIndex: "date_to",
      key: "date_to",
      render: (val: string) => dayjs(val).format("DD MMM YYYY"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const color =
          status === "approved"
            ? "green"
            : status === "rejected"
            ? "red"
            : "orange";
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
  ];

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

          {/* ===== Logs & Requests ===== */}
          <Card className={styles.historyCard}>
              <Tabs defaultActiveKey="logs" className={styles.pillTabs}>
              <Tabs.TabPane tab="Attendance Logs" key="logs">
                <AttendaceLogs year={year} month={month + 1} />
              </Tabs.TabPane>

              <Tabs.TabPane tab="Requests" key="requests">
                <Spin spinning={loadingRequests}>
                  <Table
                    rowKey="id"
                    columns={leaveColumns}
                    dataSource={leaveRequests}
                    pagination={{ pageSize: 5 }}
                  />
                </Spin>
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
            centered
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
