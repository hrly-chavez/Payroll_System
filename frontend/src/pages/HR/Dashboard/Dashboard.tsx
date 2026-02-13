//src/pages/HR/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import { Layout, Row, Col, Card, Statistic, Table, DatePicker, Calendar, List, Button, message } from "antd";
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




const { Content } = Layout;

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
     🟢 COMPANY NOTE MODAL STATE (for Add Note button)
     ========================================================= */
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  const handleAddNote = async () => {
    try {
      console.log("New Note:", noteContent);

      message.success("Note added successfully");
      setIsNoteModalOpen(false);
      setNoteContent("");
    } catch {
      message.error("Failed to add note");
    }
  };

  /* =========================================================
     🟢 CALENDAR EVENTS STATE (holidays + payroll periods)
     ========================================================= */
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    /* =========================================================
     🟢 DAILY SUMMARY STATE (FOR THE DATE PIE CHART)
     👉 This fixes your setDailySummary error
     ========================================================= */

  const [dailySummary, setDailySummary] = useState({
    present: 0,
    notReported: 0,
  });

  // ================= DAILY PIE DATA =================
  const dailyChartData = [
    {
      type: "Reported",
      value: dailySummary.present,
    },
    {
      type: "Not Reported",
      value: dailySummary.notReported,
    },
  ];

 /* =========================================================
     🟢 TIME STATES
     ========================================================= */

  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);

  /* =========================================================
     🟢 ATTENDANCE STATES
     ========================================================= */

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [myStats, setMyStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [loadingMyStats, setLoadingMyStats] = useState(false);

  /* =========================================================
     🟢 TODAY EMPLOYEE TABLE STATES
     ========================================================= */

  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [loadingTodayRows, setLoadingTodayRows] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs()); 

  /* =========================================================
     🟢 FETCH TODAY EMPLOYEE ATTENDANCE
     👉 ALSO UPDATES THE DAILY PIE CHART
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
            in: r.time_in ? dayjs(`2000-01-01 ${r.time_in}`).format("h:mm A") : "-",
            out: r.time_out ? dayjs(`2000-01-01 ${r.time_out}`).format("h:mm A") : "-",
            status: isLate ? "Late" : "Present",
          };
        });

      setTodayRows(filtered);

/* =========================================================
         🟢 DAILY SUMMARY CALCULATION (FOR DATE PIE)
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

/* =========================================================
     🟢 PIE CONFIG FOR DATE CARD
     ========================================================= */

  const dailyPieConfig = {
    data: dailyChartData,
    angleField: "value",
    colorField: "type",
    radius: 1,
    innerRadius: 0.75, 
    legend: false,
    label: false,
    tooltip: false,
    animation: {
      appear: {
        animation: "wave-in",
        duration: 800,
      },
    },
    color: ({ type }: { type: string }) => {
  switch (type) {
    case "Reported":
      return "#2e7d32"; // green
    case "Not Reported":
      return "#c62828"; // red
    default:
      return "#e0e0e0";
  }
},
 // ================= CENTER PERCENTAGE =================
  statistic: {
    title: false,
    content: {
      style: {
        fontSize: "18px",
        fontWeight: 600,
      },
      formatter: () => {
        const total = dailyChartData.reduce((a, b) => a + b.value, 0);
        const reported =
          dailyChartData.find(d => d.type === "Reported")?.value || 0;

        if (total === 0) return "0%";

        return `${Math.round((reported / total) * 100)}%`;
      },
    },
  },
  };

/* =========================================================
   🟢 FETCH BASE TIME (PH & US CLOCK)
   - Calls WorldTimeAPI
   - Updates time every second via interval
   - Used for real-time clock display
   ========================================================= */

  const fetchBaseTime = async (timezone: string, setter: (d: Date) => void) => {
    try {
      const res = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
      const data = await res.json();
      setter(new Date(data.datetime));
    } catch (err) {
      console.error("Time API error", err);
    }
  };

/* =========================================================
   🟢 LOAD CALENDAR EVENTS (HOLIDAYS + PAYROLL PERIODS)
   - Fetches holidays from backend
   - Fetches payroll periods
   - Converts them into calendar event format
   - Applies legend color mapping
   ========================================================= */

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
   🟢 FETCH MONTHLY DASHBOARD STATS
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
   🟢 FETCH TODAY ATTENDANCE (FOR ADMIN USER)
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

/* =========================================================
   🟢 INITIAL DASHBOARD LOAD
   - Runs only once on component mount
   - Loads everything needed for dashboard
   ========================================================= */

  useEffect(() => {
  fetchBaseTime("Asia/Manila", setPhTime);
  fetchBaseTime("America/New_York", setUsaTime);
  fetchTodayAttendance();
  loadCalendarEvents();
  fetchMyDashboardStats();
  fetchTodayEmployeesAttendance(selectedDate);
}, []);

/* =========================================================
   🟢 DEBUG CALENDAR EVENTS
   - Logs calendar events whenever they change
   ========================================================= */

  useEffect(() => {
    console.log("Calendar Events:", calendarEvents);
  }, [calendarEvents]);

/* =========================================================
   🟢 REAL-TIME CLOCK UPDATE
   - Adds 1 second every second
   - Keeps PH and US time live
   ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setPhTime((p) => (p ? new Date(p.getTime() + 1000) : p));
      setUsaTime((p) => (p ? new Date(p.getTime() + 1000) : p));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* =========================================================
   🟢 HANDLE PUNCH IN
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

/* =========================================================
   🟢 HANDLE PUNCH OUT
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
   🟢 CURRENT USER NAME
   - Retrieved from localStorage
   ========================================================= */

  const name = localStorage.getItem("user_name") || "User";

 /* =========================================================
   🟢 STATUS LABEL HELPER
   - Determines badge color and text
   ========================================================= */ 

  const { key: statusKey, label: statusLabel } = getAttendanceStatusLabel(
    attendance,
    formatBackendTime
  );
      

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
          <Row gutter={16} className={styles.mainSection}>

        {/* DATE CARD */}
        <Col xs={24} md={8}>
          <Card
              title={selectedDate.format("MMMM D, YYYY")}
              className={`${styles.compactCard} ${styles.dateCard}`}
            >
            <div style={{ padding: 20 }}>
              {/* 🟢 DAILY DONUT CHART */}
              <Pie {...dailyPieConfig} height={150} />

              {/* 🟢 LEGEND */}
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <span style={{ marginRight: 15 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: "#d9d9d9",
                      borderRadius: "50%",
                      marginRight: 6,
                    }}
                  />
                  Not Reported
                </span>

                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: "#2f5e8e",
                      borderRadius: "50%",
                      marginRight: 6,
                    }}
                  />
                  Reported
                </span>
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
              <div className={styles.timeRow}>
              <div className={styles.timeBox}>
                <span>PH Time</span>
                <h2>{formatTime(phTime, "Asia/Manila")}</h2>
              </div>
              <div className={styles.timeBox}>
                <span>USA Time</span>
                <h2>{formatTime(usaTime, "America/New_York")}</h2>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <Button
                icon={<LoginOutlined />}
                className={styles.punchInBtn}
                onClick={handlePunchIn}
                loading={loadingPunchIn}
                disabled={loadingStatus || !!attendance?.time_in}
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
          </Card>
        </Col>

        {/* COMPANY NOTE */}
      <Col xs={24} md={8}>
            <CompanyNote role="ADMIN" />
      </Col>
      </Row>

      {/* ROW 2: PENDING + CALENDAR */}
      <Row gutter={16} className={styles.mainSection}>

        {/* PENDING REQUESTS */}
        <Col xs={24} md={16}>
          <Card title="Pending Requests" className={styles.pendingCard}>
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
                  key: "payroll",
                  label: "Payroll",
                  children: <div>Payroll requests here</div>,
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
        <Card title="Calendar" className={styles.compactCard}>
          <SharedCalendar events={calendarEvents} />
        </Card>
      </Col>
      <Modal
        title="Add Company Note"
        open={isNoteModalOpen}
        onCancel={() => setIsNoteModalOpen(false)}
        onOk={handleAddNote}
        okText="Submit"
      >
        <Input.TextArea
          rows={4}
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Write company note here..."
        />
      </Modal>
    </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
