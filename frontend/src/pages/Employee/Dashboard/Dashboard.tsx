//frontend/src/pages/Employee/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from "react";
import { Layout, Card, Row, Col, Button, Tag, Calendar, Statistic, Divider, message,Select } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Dashboard.module.css";
import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import axios from "axios";
import api from "../../../api/axios";
import dayjs, { Dayjs } from "dayjs";
import { formatBackendTime,formatTime, getAttendanceStatusLabel } from "../../helpers";
import SharedCalendar from "./../../../components/SharedCalendar/SharedCalendar";
import { Pie } from "@ant-design/plots";
import { Tabs } from "antd";
import CompanyNote from "../../../components/CompanyNote/companyNote";
import {
  HOLIDAY_LEGEND,
  HolidayBase,
  HolidayType,
} from "../../../components/SharedCalendar/CalendarLegend";
import { PAYROLL_COLOR } from "../../../components/SharedCalendar/CalendarLegend";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";

const { Content } = Layout;
const { Option } = Select;

type TodayAttendanceResponse = {
  has_attendance: boolean;
  attendance: null | {
    id: number;
    date: string;
    status: string;
    time_in: string | null;
    time_out: string | null;
    employee: number;
    created_at: string;
  };
};
  type AttendanceLogRow = {
    id: number;
    date: string;
    status: string;
    time_in: string | null;
    time_out: string | null;
    shift_name: string | null;
    event_types: string; // e.g. "Late, UnderTime" or ""
  };

  type AttendanceLogsResponse = {
    year: number;
    month: number;
    count: number;
    results: AttendanceLogRow[];
  };

  type CalendarEvent = {
    type: "holiday" | "payroll";
    start_date: string;
    end_date?: string;
    title: string;
    color: string;
  };

const Dashboard: React.FC = () => {
  const [nowTick, setNowTick] = useState(0);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [stats, setStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1); // 1–12
  const [selectedFilter, setSelectedFilter] = useState<
    "ALL" | "PRESENT" | "LATE" | "LEAVE" | "ABSENT"
  >("ALL");
  // pie for the attendance stats
  const baseChartData = [
  { type: "none", value: 1 },
  { type: "Present", value: stats.present },
  { type: "Late", value: stats.lates },
  { type: "Leave", value: 0 },
  { type: "Absent", value: stats.absent },
  { type: "Undertime", value: 0 },
];

const attendanceChartData =
  selectedFilter === "ALL"
    ? baseChartData
    : baseChartData.filter(
        (item) =>
          item.type.toUpperCase() === selectedFilter ||
          item.type === "none"
      );

  const attendanceConfig = {
  data: attendanceChartData,
  angleField: "value",
  colorField: "type",
  radius: 1,
  innerRadius: 0.7,
  legend: false,
  label: false,
  padding: 0,
  color: ({ type }: { type: string }) => {
    switch (type) {
      case "Present": return "#2e7d32";   // green
      case "Late": return "#f0ad4e";      // yellow
      case "Leave": return "#1890ff";     // blue
      case "Absent": return "#c62828";    // red
      case "Undertime": return "#7b1fa2"; // purple
      default: return "#e0e0e0";          // gray (none)
    }
  },
};  
    

    const fetchTodayAttendance = async () => {
      setLoadingStatus(true);
      try {
          const res = await api.get<TodayAttendanceResponse>("/attendance/today/");
          setAttendance(res.data.attendance);
        } catch (err: any) {
          console.error(err);
          const msg = err?.response?.data?.detail || "Failed to fetch attendance status.";
          message.error(msg);
        } finally {
          setLoadingStatus(false);
        }
    };

    const handlePunchIn = async () => {
      setLoadingPunchIn(true);
      try {
        const res = await api.post("/attendance/punch-in/", {});
        message.success(res.data?.message || "Punch in successful.");
        setAttendance(res.data.attendance);
        fetchAttendanceStats();
      } catch (err: any) {
        console.error(err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Punch in failed.";
        message.error(msg);
      } finally {
        setLoadingPunchIn(false);
      }
    };

    const handlePunchOut = async () => {
      setLoadingPunchOut(true);
      try {
        const res = await api.post("/attendance/punch-out/", {});
        message.success(res.data?.message || "Punch out successful.");
        setAttendance(res.data.attendance);
        fetchAttendanceStats();
      } catch (err: any) {
        console.error(err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Punch out failed.";
        message.error(msg);
      } finally {
        setLoadingPunchOut(false);
      }
    };

    const fetchAttendanceStats = async () => {
      setLoadingStats(true);
      try {
        const now = dayjs();
        const params = { year: now.year(), month: selectedMonth };

        const res = await api.get<AttendanceLogsResponse>("/attendance/logs/", { params });

        const rows = res.data.results || [];

        const present = rows.filter((r) => r.status === "PRESENT").length;
        const absent = rows.filter((r) => r.status === "ABSENT").length;

        const lates = rows.filter((r) => {
          const types = (r.event_types || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          return types.includes("Late");
        }).length;

        setStats({ present, lates, absent });
      } catch (err: any) {
        const backendMsg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to load attendance stats.";
        message.error(backendMsg);
      } finally {
        setLoadingStats(false);
      }
    };

    const loadCalendarEvents = async () => {
  try {
    const [holidayRes, payrollRes] = await Promise.all([
      api.get("/approvals/holidays/"),
      api.get("/payroll/periods/"),
    ]);

    const holidays = holidayRes.data;
    const payrolls = payrollRes.data;

    const events = [
      ...holidays.map((h: any) => {
          const base = h.base as HolidayBase;
          const type = h.type as HolidayType;

          const legend = HOLIDAY_LEGEND[base]?.[type];

          return {
            type: "holiday",
            start_date: h.date,
            title: `${h.base} Holiday – ${h.name}`,
            color: legend?.bgColor || "#999999",
          };
        }),


      ...payrolls.map((p: any) => ({
        type: "payroll",
        start_date: p.start_date,
        end_date: p.end_date,
        title: `Payroll (${dayjs(p.start_date).format("MMM D")} - ${dayjs(
          p.end_date
        ).format("MMM D")})`,
        color: PAYROLL_COLOR.bgColor,
      })),
    ];

    setCalendarEvents(events);
  } catch {
    message.error("Failed to load calendar events");
  }
};

    const fetchBaseTime = async (timezone: string, setter: (d: Date) => void) => {
      try {
        const res = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        const data = await res.json();
        setter(new Date(data.datetime));
      } catch (err) {
        console.error("Time API error", err);
      }
    };
    useEffect(() => {
    fetchAttendanceStats();
  }, [selectedMonth]);
    useEffect(() => {
      fetchTodayAttendance();
      fetchAttendanceStats();
      loadCalendarEvents();
    }, []);


    useEffect(() => {
      const interval = setInterval(() => {
        setNowTick((x) => x + 1);
      }, 1000);
      return () => clearInterval(interval);
    }, []);

 
    
    type StatusType = "NOT_IN" | "IN" | "OUT";

      const name = localStorage.getItem("user_name") || "User";

      const getStatusLabel = (att: TodayAttendanceResponse["attendance"]) => {
        if (!att || !att.time_in) return "STATUS : Not Clocked In";
        if (att.time_in && !att.time_out) return `STATUS : Clocked In (${att.time_in})`;
        return `STATUS : Clocked Out (${att.time_out})`;
      };
    
    const { key: statusKey, label: statusLabel } = getAttendanceStatusLabel(
      attendance,
      formatBackendTime
    );
    
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: dayjs().month(i).format("MMMM"),
  }));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />

        <Content className={styles.content}>
          <div className={styles.greetingCard}>
            <div className={styles.greetingLeft}>
              Good to see you, <span className={styles.greetingName}>{name}</span>
            </div>

            <div className={`${styles.greetingStatus} ${styles[statusKey]}`}>
              {statusLabel}
            </div>
          </div>

         {/* ROW: ATTENDANCE + COMPANY NOTE */}
          <Row
            gutter={16}
            className={styles.mainSection}
            align="stretch"
          >
          {/* LEFT: ATTENDANCE */}
          <Col xs={24} md={13}>
          <Card title="Attendance" className={styles.attendanceCard}>
              <div className={styles.timeRow}>
                <div className={styles.timeBox}>
                  <span>PH Time</span>
                  <h2>{formatTime(new Date(), "Asia/Manila")}</h2>
                </div>

                <div className={styles.timeBox}>
                  <span>USA Time</span>
                  <h2>{formatTime(new Date(), "America/New_York")}</h2>
                </div>
              </div>

              <div className={styles.buttonRow}>
                <Button
                  icon={<LoginOutlined />}
                  className={styles.punchInBtn}
                  size="large"
                  onClick={handlePunchIn}
                  loading={loadingPunchIn}
                  disabled={loadingStatus || !!attendance?.time_in}
                >
                  Punch in
                </Button>

                <Button
                  icon={<LogoutOutlined />}
                  className={styles.punchOutBtn}
                  size="large"
                  onClick={handlePunchOut}
                  loading={loadingPunchOut}
                  disabled={loadingStatus || !attendance?.time_in || !!attendance?.time_out}
                >
                  Punch out
                </Button>
              </div>
            </Card>
          </Col>

          {/* RIGHT: COMPANY NOTE */}
          <Col xs={24} md={11}>
            <CompanyNote />
          </Col>

        </Row>

        {/* ROW: ATTENDANCE PIE + CALENDAR */}
        <Row gutter={16} className={styles.tightSection}>

          {/* ATTENDANCE PIE */}
          <Col
            xs={24}
            md={13}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >            <Card
              title={
                <div className={styles.attendanceHeader}>
                  <span>Attendance</span>
                  <Select
                    size="small"
                    value={selectedMonth}
                    onChange={(value) => setSelectedMonth(value)}
                    style={{ width: 110 }}
                  >
                    {monthOptions.map((m) => (
                      <Option key={m.value} value={m.value}>
                        {m.label}
                      </Option>
                    ))}
                  </Select>

                  <Select
                    size="small"
                    value={selectedFilter}
                    onChange={(value) => setSelectedFilter(value)}
                    style={{ width: 120 }}
                  >
                    <Option value="ALL">All</Option>
                    <Option value="PRESENT">Present</Option>
                    <Option value="LATE">Late</Option>
                    <Option value="LEAVE">Leave</Option>
                    <Option value="ABSENT">Absent</Option>
                  </Select>
                </div>
              }
              className={styles.sectionCard}
            >
              <div className={styles.chartWrapper}>
                <Pie {...attendanceConfig} />
              </div>

              <div className={styles.chartLegend}>
                <span><i className={styles.grayDot} /> none</span>
                <span><i className={styles.greenDot} /> Present</span>
                <span><i className={styles.yellowDot} /> Late</span>
                <span><i className={styles.blueDot} /> Leave</span>
                <span><i className={styles.redDot} /> Absent</span>
                <span><i className={styles.purpleDot} /> Undertime</span>
              </div>
            </Card>

            <Card title="Status" className={styles.statusCard}>
              <Tabs
                defaultActiveKey="payslip"
                items={[
                  {
                    key: "payslip",
                    label: "Payslip",
                    children: (
                      <div className={styles.payslipList}>
                        <div className={styles.payslipRow}>
                          <span className={styles.payslipStatus}>Pending</span>
                          <span className={styles.payslipDate}>
                            March 20, 2025 10:21
                          </span>
                        </div>

                        <div className={styles.payslipRow}>
                          <span className={styles.payslipStatus}>Pending</span>
                          <span className={styles.payslipDate}>
                            January 1, 2026 08:00
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "attendance correction",
                    label: "Attendance Correction",
                    children: (
                      <div className={styles.payslipList}>
                        <div className={styles.payslipRow}>
                          <span className={styles.payslipStatus}>Pending</span>
                          <span className={styles.payslipDate}>
                            March 20, 2025 10:21
                          </span>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* CALENDAR */}
                <Col xs={24} md={11}>
                  <Card title="Calendar" className={`${styles.compactCard} ${styles.calendarCard}`}>
                    <SharedCalendar events={calendarEvents} />
                    <CalendarLegendDisplay />
                  </Card>
          </Col>
        </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
