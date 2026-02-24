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
import CompanyNote from "../../../components/CompanyNote/CompanyNote";
import { HOLIDAY_LEGEND, HolidayBase, HolidayType } from "../../../components/SharedCalendar/CalendarLegend";
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
type PunchInEligibilityResponse = {
  can_punch_in: boolean;
  reason: string;
  shift_start_dt: string | null;
  shift_end_dt: string | null;
  earliest_allowed_dt: string | null;
  now_dt: string;
  work_date: string;
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
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, leave: 0, undertime: 0, overtime: 0, });
  const [loadingStats, setLoadingStats] = useState(false);

  const [punchInEligibility, setPunchInEligibility] = useState<PunchInEligibilityResponse | null>(null);
  const [loadingPunchInEligibility, setLoadingPunchInEligibility] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1); // 1–12
  const [selectedFilter, setSelectedFilter] = useState<
  "ALL" | "PRESENT" | "LATE" | "LEAVE" | "ABSENT" | "UNDERTIME" | "OVERTIME" >("ALL");

  // ===== Attendance Pie Data (6 categories + filter + safe fallback) =====
  type PieRow = { type: string; value: number };

  const rawChartData: PieRow[] = [
    { type: "Present", value: stats.present },
    { type: "Late", value: stats.late },
    { type: "Leave", value: stats.leave },
    { type: "Absent", value: stats.absent },
    { type: "Undertime", value: stats.undertime },
    { type: "Overtime", value: stats.overtime },
  ];

  const total = rawChartData.reduce((sum, d) => sum + d.value, 0);

  const filtered =
    selectedFilter === "ALL"
      ? rawChartData
      : rawChartData.filter((d) => d.type.toUpperCase() === selectedFilter);

  const nonZero = filtered.filter((d) => d.value > 0);

  const finalChartData: PieRow[] =
    total === 0 || nonZero.length === 0
      ? [{ type: "No data", value: 1 }]
      : nonZero;

  const getPercent = (value: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  const attendanceConfig = {
    data: finalChartData,
    angleField: "value",
    colorField: "type",

    // donut shape (like your 2nd pic)
    radius: 0,
    innerRadius: 0.92,

    // smooth animation + hover
    animation: {
      appear: {
        animation: "wave-in",
        duration: 800,
      },
    },
    interactions: [{ type: "element-active" }],

    // slice styling (crisp separators)
    pieStyle: {
      lineWidth: 2,
      stroke: "#ffffff",
    },

    // percent labels inside slices
    label:
      total === 0
        ? false
        : {
            type: "inner",
            offset: "-50%",
            content: ({ percent }: any) => `${Math.round(percent * 100)}%`,
            style: {
              fontSize: 14,
              fontWeight: 700,
              fill: "#ffffff",
              textAlign: "center",
            },
          },

    legend: false,

    // center content (total)
    statistic: {
      title: false,
      content: {
        style: {
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: 800,
          fontSize: "18px",
          lineHeight: "22px",
        },
        content:
          total === 0
            ? "No data"
            : `${total}\nlogs`,
      },
    },

    color: ({ type }: { type: string }) => {
    switch (type) {
      case "Present": return "#22c55e";
      case "Late": return "#f59e0b";
      case "Leave": return "#3b82f6";
      case "Absent": return "#ef4444";
      case "Undertime": return "#a855f7";
      case "Overtime": return "#14b8a6";
      case "No data": return "#e5e7eb";
      default: return "#e5e7eb";
    }
  },

    // no padding weirdness
    appendPadding: 10,
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
    const fetchPunchInEligibility = async () => {
      setLoadingPunchInEligibility(true);
      try {
        const res = await api.get<PunchInEligibilityResponse>("/attendance/punch-in-eligibility/");
        setPunchInEligibility(res.data);
      } catch (err: any) {
        console.error(err);
        // Don’t spam errors for this “helper” endpoint. Just set a safe default.
        setPunchInEligibility({
          can_punch_in: false,
          reason: "Unable to check punch-in eligibility.",
          shift_start_dt: null,
          shift_end_dt: null,
          earliest_allowed_dt: null,
          now_dt: dayjs().toISOString(),
          work_date: dayjs().format("YYYY-MM-DD"),
        });
      } finally {
        setLoadingPunchInEligibility(false);
      }
    };

    const handlePunchIn = async () => {
      setLoadingPunchIn(true);
      try {
        const res = await api.post("/attendance/punch-in/", {});
        message.success(res.data?.message || "Punch in successful.");
        setAttendance(res.data.attendance);
        fetchAttendanceStats();
        fetchPunchInEligibility();
      } catch (err: any) {
        console.error(err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Punch in failed.";
        message.error(msg);
        fetchPunchInEligibility();
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
        const leave = rows.filter((r) => r.status === "LEAVE").length;

        // event_types example: "Late, UnderTime"
        const hasEvent = (r: AttendanceLogRow, key: string) => {
          const types = (r.event_types || "")
            .split(",")
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
          return types.includes(key.toLowerCase());
        };

        const late = rows.filter((r) => hasEvent(r, "late")).length;
        const undertime = rows.filter((r) => hasEvent(r, "undertime")).length;

        // IMPORTANT: your backend might spell it "Overtime" or "OverTime"
        const overtime = rows.filter(
          (r) => hasEvent(r, "overtime") || hasEvent(r, "over time") || hasEvent(r, "overTime")
        ).length;

        setStats({ present, late, absent, leave, undertime, overtime });
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
      fetchPunchInEligibility();
      fetchAttendanceStats();
      loadCalendarEvents();
    }, []);

    useEffect(() => {
      // Refresh eligibility every 20 seconds (server-based)
      const interval = setInterval(() => {
        fetchPunchInEligibility();
      }, 20000);

      return () => clearInterval(interval);
    }, []);
    useEffect(() => {
      const interval = setInterval(() => {
        setNowTick((x) => x + 1);
      }, 1000);
      return () => clearInterval(interval);
    }, []);

 
    
    type StatusType = "NOT_IN" | "IN" | "OUT";

      const name = localStorage.getItem("user_name") || "User";
  

  const { key: statusKey, label: statusLabel } = getAttendanceStatusLabel(
    attendance,
    formatBackendTime
  );
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: dayjs().month(i).format("MMMM"),
  }));
  const punchInDisabled =
    loadingStatus ||
    loadingPunchInEligibility ||
    loadingPunchIn ||
    !!attendance?.time_in ||
    !(punchInEligibility?.can_punch_in ?? false);

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
                  disabled={punchInDisabled}
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
              {punchInEligibility && !punchInEligibility.can_punch_in ? (
                  <div className={styles.punchInHint}>
                    {punchInEligibility.reason}
                  </div>
                ) : null}
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
                <span className={styles.attendanceTitle}>Attendance</span>

                <div className={styles.attendanceControls}>
                  <Select
                    size="small"
                    value={selectedMonth}
                    onChange={(value) => setSelectedMonth(value)}
                    className={styles.headerSelect}
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
                    className={styles.headerSelect}
                  >
                    <Option value="ALL">All</Option>
                    <Option value="PRESENT">Present</Option>
                    <Option value="LATE">Late</Option>
                    <Option value="LEAVE">Leave</Option>
                    <Option value="ABSENT">Absent</Option>
                    <Option value="UNDERTIME">Undertime</Option>
                    <Option value="OVERTIME">Overtime</Option>
                  </Select>
                </div>
              </div>
              }
              className={styles.sectionCard}
            >
              <div className={styles.chartWrapper}>
                <Pie {...attendanceConfig} />
              </div>

              <div className={styles.chartLegendPro}>
                {rawChartData.map((item) => (
                  <div key={item.type} className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      data-type={item.type}
                      aria-hidden="true"
                    />
                    <div className={styles.legendText}>
                      <div className={styles.legendLabel}>{item.type}</div>
                      <div className={styles.legendMeta}>
                        {item.value} • {getPercent(item.value)}%
                      </div>
                    </div>
                  </div>
                ))}
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
