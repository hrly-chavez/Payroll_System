//src/pages/HR/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import { Layout, Row, Col, Card, Statistic, Table, DatePicker, Calendar, List, Button, message,Alert } from "antd";
import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import styles from "./adminDashboard.module.css";
import api from "../../../api/axios";
import { formatTime, getAttendanceStatusLabel, formatBackendTime } from "../../helpers";
import SharedCalendar from "./../../../components/SharedCalendar/SharedCalendar";
import { Tabs,Modal, Input } from "antd";
import {
  HOLIDAY_LEGEND,
  HolidayBase,
  HolidayType,
  PAYROLL_COLOR,
} from "../../../components/SharedCalendar/CalendarLegend";
import CompanyNote from "../../../components/CompanyNote/CompanyNote";
import { Pie } from "@ant-design/plots";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";


const { Content } = Layout;

/* ================= TYPES ================= */
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
  event_types: string;
};

type AttendanceLogsResponse = {
  year: number;
  month: number;
  count: number;
  results: AttendanceLogRow[];
};


type TodayRow = {
  key: number;
  name: string;
  in: string;
  out: string;
  status: string;
};
type AdminLogsResponse = {
  year: number;
  month: number;
  count: number;
  results: Array<{
    id: number;
    date: string;
    status: string;
    time_in: string | null;
    time_out: string | null;
    employee_id: number;
    full_name: string;
    department_name: string | null;
    shift_name: string | null;
    event_types: string;
  }>;
};

type CalendarEvent = {
  type: "holiday" | "payroll";
  start_date: string;
  end_date?: string;
  title: string;
  color: string;
};

const columns = [
  { title: "Name", dataIndex: "name" },
  { title: "Time-in", dataIndex: "in" },
  { title: "Time-out", dataIndex: "out" },
  { title: "Status", dataIndex: "status" },
];


const Dashboard: React.FC = () => {
  const today = dayjs().format("MMMM D, YYYY");

/* =========================================================
      COMPANY NOTE MODAL STATE (for Add Note button)
     ========================================================= */
  const [noteContent, setNoteContent] = useState("");

  /* =========================================================
     CALENDAR EVENTS STATE (holidays + payroll periods)
     ========================================================= */
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [punchInEligibility, setPunchInEligibility] = useState<PunchInEligibilityResponse | null>(null);
  const [loadingPunchInEligibility, setLoadingPunchInEligibility] = useState(false);

  const [dailySummary, setDailySummary] = useState({
    present: 0,
    notReported: 0,
  });

  // ===== Admin Date Donut (Employee-style) =====
  type AdminDailyRow = { type: "Reported" | "Not Reported" | "No data"; value: number };

  const adminRawDaily: AdminDailyRow[] = [
    { type: "Reported", value: dailySummary.present || 0 },
    { type: "Not Reported", value: dailySummary.notReported || 0 },
    { type: "No data", value: 0 }, // placeholder for typing; not rendered when data exists
  ];

  const adminDailyTotal = (dailySummary.present || 0) + (dailySummary.notReported || 0);

  const adminDailyFinal: AdminDailyRow[] =
    adminDailyTotal === 0
      ? [{ type: "No data", value: 1 }]
      : [
          { type: "Reported", value: dailySummary.present || 0 },
          { type: "Not Reported", value: dailySummary.notReported || 0 },
        ];

  const adminDailyPercent = (value: number) =>
    adminDailyTotal === 0 ? 0 : Math.round((value / adminDailyTotal) * 100);

  const adminDailyConfig = {
  data: adminDailyFinal,
  angleField: "value",
  colorField: "type",

  radius: 0.98,
  legend: false,

  // smooth + crisp separators
  animation: {
    appear: { animation: "wave-in", duration: 800 },
  },
  interactions: [{ type: "element-active" }],

  pieStyle: {
    lineWidth: 2,
    stroke: "#ffffff",
  },

  // ✅ FIX: disable labels to avoid "shape.inner" crash
  label: false,

  // center text
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
        adminDailyTotal === 0
          ? "No data"
          : `${dailySummary.present || 0} / ${adminDailyTotal}\nreported`,
    },
  },

  color: ({ type }: { type: string }) => {
    switch (type) {
      case "Reported":
        return "#386FA4";
      case "Not Reported":
        return "#E5E7EB";
      case "No data":
        return "#E5E7EB";
      default:
        return "#E5E7EB";
    }
  },

  appendPadding: 10,
};
 /* =========================================================
      TIME STATES
     ========================================================= */

  const [nowTick, setNowTick] = useState(0);


  /* =========================================================
      ATTENDANCE STATES
     ========================================================= */

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [myStats, setMyStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [loadingMyStats, setLoadingMyStats] = useState(false);

  /* =========================================================
      TODAY EMPLOYEE TABLE STATES
     ========================================================= */

  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [loadingTodayRows, setLoadingTodayRows] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs()); 

  /* =========================================================
      FETCH TODAY EMPLOYEE ATTENDANCE
      ALSO UPDATES THE DAILY PIE CHART
     ========================================================= */

  const fetchTodayEmployeesAttendance = async (d?: dayjs.Dayjs) => {
    setLoadingTodayRows(true);
    try {
      const target = d ?? dayjs();
      const params = { year: target.year(), month: target.month() + 1 };

      const res = await api.get<AdminLogsResponse>("/attendance/admin/logs/", { params });
      

      const targetStr = target.format("YYYY-MM-DD");

      const filtered = (res.data.results || [])
        .filter((r) => r.date === targetStr)
        .filter((r) => !!r.time_in)
        .map((r) => {
          const types = (r.event_types || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

          const isLate = types.includes("Late");

          return {
            key: r.id,
            name: r.full_name,
            in: r.time_in ? formatBackendTime(r.time_in) : "-",
            out: r.time_out ? formatBackendTime(r.time_out) : "-",
            status: isLate ? "Late" : "Present",
          };
        });

      setTodayRows(filtered);

/* =========================================================
          DAILY SUMMARY CALCULATION (FOR DATE PIE)
         ========================================================= */

      const totalEmployees = res.data.results.length;
      const presentCount = filtered.length;

      setDailySummary({
        present: presentCount,
        notReported: totalEmployees - presentCount,
      });

    } catch (err: any) {
      message.error("Failed to load attendance.");
    } finally {
      setLoadingTodayRows(false);
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

    const events: CalendarEvent[] = [
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
        title: "Payroll",
        color: PAYROLL_COLOR.bgColor,
      })),
    ];

    setCalendarEvents(events);
  } catch {
    message.error("Failed to load calendar events");
  }
};

/* =========================================================
   FETCH MONTHLY DASHBOARD STATS
   - Gets PRESENT / LATE / ABSENT count
   - Used for summary statistics cards
   ========================================================= */ 

  const fetchMyDashboardStats = async () => {
    setLoadingMyStats(true);
    try {
      const now = dayjs();
      const params = { year: now.year(), month: now.month() + 1 };

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

      setMyStats({ present, lates, absent });
    } catch (err: any) {
      const backendMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load attendance stats.";
      message.error(backendMsg);
    } finally {
      setLoadingMyStats(false);
    }
  };

 /* =========================================================
   FETCH TODAY ATTENDANCE (FOR ADMIN USER)
   - Gets today's punch-in / punch-out status
   - Updates status badge on dashboard
   ========================================================= */ 

  const fetchTodayAttendance = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get<TodayAttendanceResponse>("/attendance/today/");
      setAttendance(res.data.attendance);
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to fetch attendance status.";
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
      // Don't spam errors; just set safe default state
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
/* =========================================================
   INITIAL DASHBOARD LOAD
   - Runs only once on component mount
   - Loads everything needed for dashboard
   ========================================================= */

  useEffect(() => {
    fetchTodayAttendance();
    fetchPunchInEligibility();
    loadCalendarEvents();
    fetchMyDashboardStats();
    fetchTodayEmployeesAttendance(selectedDate);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPunchInEligibility();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

/* =========================================================
   DEBUG CALENDAR EVENTS
   - Logs calendar events whenever they change
   ========================================================= */

  useEffect(() => {
    console.log("Calendar Events:", calendarEvents);
  }, [calendarEvents]);

/* =========================================================
   REAL-TIME CLOCK UPDATE
   - Adds 1 second every second
   - Keeps PH and US time live
   ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick((x) => x + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);


  /* =========================================================
   HANDLE PUNCH IN
   - Calls backend punch-in API
   - Refreshes stats + employee list
   ========================================================= */

  const handlePunchIn = async () => {
    setLoadingPunchIn(true);
    try {
      const res = await api.post("/attendance/punch-in/", {});
      message.success(res.data?.message || "Punch in successful.");
      setAttendance(res.data.attendance);
      fetchMyDashboardStats();
      fetchTodayEmployeesAttendance(selectedDate);
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
/* =========================================================
   HANDLE PUNCH OUT
   - Calls backend punch-out API
   - Refreshes stats + employee list
   ========================================================= */

  const handlePunchOut = async () => {
    setLoadingPunchOut(true);
    try {
      const res = await api.post("/attendance/punch-out/", {});
      message.success(res.data?.message || "Punch out successful.");
      setAttendance(res.data.attendance);
      fetchMyDashboardStats();
      fetchTodayEmployeesAttendance(selectedDate);


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

/* =========================================================
   CURRENT USER NAME
   - Retrieved from localStorage
   ========================================================= */

  const name = localStorage.getItem("user_name") || "User";

 /* =========================================================
   STATUS LABEL HELPER
   - Determines badge color and text
   ========================================================= */ 

  const { key: statusKey, label: statusLabel } = getAttendanceStatusLabel(
    attendance,
    formatBackendTime
  );
      
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

          {/* STATS */}
          {/* ROW 1: DATE + ATTENDANCE + COMPANY NOTE */}
          <Row gutter={16} className={`${styles.mainSection} ${styles.equalHeightRow}`}>

        {/* DATE CARD */}
        <Col xs={24} md={8}>
          <Card
              title={selectedDate.format("MMMM D, YYYY")}
              className={`${styles.compactCard} ${styles.dateCard}`}
            >
            <div className={styles.dateChartArea}>
            <div className={styles.chartWrapperAdmin}>
              <Pie {...adminDailyConfig} />
            </div>

            <div className={styles.chartLegendAdmin}>
              {(adminDailyTotal === 0
                ? [{ type: "No data" as const, value: 0 }]
                : [
                    { type: "Reported" as const, value: dailySummary.present || 0 },
                    { type: "Not Reported" as const, value: dailySummary.notReported || 0 },
                  ]
              ).map((item) => (
                <div key={item.type} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    data-type={item.type}
                    aria-hidden="true"
                  />
                  <div className={styles.legendText}>
                    <div className={styles.legendLabel}>{item.type}</div>
                    <div className={styles.legendMeta}>
                      {item.value} • {adminDailyPercent(item.value)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </Card>
          </Col>

        {/* ATTENDANCE */}
        <Col xs={24} md={8}>
          <Card
            title="Attendance"
            className={`${styles.compactCard} ${styles.attendanceCard}`}
          >
            <div className={styles.attendanceCenter}>
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
                  onClick={handlePunchIn}
                  loading={loadingPunchIn}
                  disabled={punchInDisabled}
                >
                  Punch in
                </Button>
                <Button
                  icon={<LogoutOutlined />}
                  className={styles.punchOutBtn}
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
            </div>
          </Card>
        </Col>

        {/* COMPANY NOTE */}
      <Col xs={24} md={8}>
            <CompanyNote role="ADMIN" />
      </Col>
      </Row>

      {/* ROW 2: PENDING + CALENDAR */}
      <Row
        gutter={16}
        className={styles.mainSection}
        align="top"
      >
        {/* PENDING REQUESTS */}
        <Col xs={24} md={16}>
          <Card title="Pending Request(s)" className={styles.pendingCard}>
            <Tabs
              defaultActiveKey="holiday"
              size="small"
              className={styles.pendingTabs}
              items={[
                {
                  key: "holiday",
                  label: "Holiday",
                  children: <div>Holiday requests here</div>,
                },
                {
                  key: "leave",
                  label: "Leave",
                  children: <div>Leave requests here</div>,
                },
                {
                key: "attendance correction",
                  label: "Attendance Correction",
                  children: <div>Attendance question requests here</div>,
                },
              ]}
            />
              </Card>
      </Col>

      {/* CALENDAR */}
      <Col xs={24} md={8}>
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
