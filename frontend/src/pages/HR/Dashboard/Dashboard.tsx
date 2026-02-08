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
import { Tabs } from "antd";



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



const columns = [
  { title: "Name", dataIndex: "name" },
  { title: "Time-in", dataIndex: "in" },
  { title: "Time-out", dataIndex: "out" },
  { title: "Status", dataIndex: "status" },
];


const Dashboard: React.FC = () => {
  const today = dayjs().format("MMMM D, YYYY");
  const [calendarEvents, setCalendarEvents] = useState([]);

  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [myStats, setMyStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [loadingMyStats, setLoadingMyStats] = useState(false);

  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [loadingTodayRows, setLoadingTodayRows] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs()); // default = today



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
    } catch (err: any) {
      const backendMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load attendance.";
      message.error(backendMsg);
    } finally {
      setLoadingTodayRows(false);
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
  const loadCalendarEvents = async () => {
  try {
    const res = await api.get("/approvals/holidays/");
    const holidays = res.data;

    const events = holidays.map((h: any) => ({
      date: h.date,
      type: "holiday",
      color: h.base === "PH" ? "#2e7d32" : h.base === "US" ? "#c62828" : "#616161",
    }));

    setCalendarEvents(events);
  } catch {
    message.error("Failed to load holidays");
  }
};

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

  useEffect(() => {
  fetchBaseTime("Asia/Manila", setPhTime);
  fetchBaseTime("America/New_York", setUsaTime);
  fetchTodayAttendance();
  loadCalendarEvents();
  fetchMyDashboardStats();
  fetchTodayEmployeesAttendance(selectedDate);


}, []);


  useEffect(() => {
    const interval = setInterval(() => {
      setPhTime((p) => (p ? new Date(p.getTime() + 1000) : p));
      setUsaTime((p) => (p ? new Date(p.getTime() + 1000) : p));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
  const name = localStorage.getItem("user_name") || "User";

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
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic title="Total Present" value={myStats.present} loading={loadingMyStats} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Total Lates" value={myStats.lates} loading={loadingMyStats} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Total Absences" value={myStats.absent} loading={loadingMyStats} />
              </Card>
            </Col>
            <Col span={6}><Card><Statistic title="Pending Correction Request" value={0} /></Card></Col>
          </Row>


          {/* ATTENDANCE + CALENDAR */}
          <Row gutter={16} className={styles.mainSection}>
            <Col xs={24} lg={14}>
              {/* ATTENDANCE */}
              <Card title="Attendance" className={styles.compactCard}>
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

              <Card
              title="Pending Requests"
              className={`${styles.requestCard} ${styles.requestUnderAttendance}`}
            >
              <Tabs
                defaultActiveKey="holiday"
                size="small"
                className={styles.requestTabsAnt}
                items={[
                  {
                    key: "holiday",
                    label: "Holiday",
                    children: (
                      <div className={styles.requestList}>
                        <div className={styles.requestItem}>
                          <span>ABC HOLIDAY</span>
                          <span>12/25/2026</span>
                        </div>
                        <div className={styles.requestItem}>
                          <span>ABC HOLIDAY</span>
                          <span>01/01/2027</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "leave",
                    label: "Leave",
                    children: (
                      <div className={styles.requestList}>
                        <div className={styles.requestItem}>
                          <span>John Doe</span>
                          <span>02/10/2026</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "payroll",
                    label: "Payroll",
                    children: (
                      <div className={styles.requestList}>
                        <div className={styles.requestItem}>
                          <span>January Payroll</span>
                          <span>For Approval</span>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
            </Col>
            
            {/* CALENDAR */}
            <Col xs={24} lg={10}>
              <Card title="Calendar" className={styles.compactCard}>
                <div className={styles.calendarWrapper}>
                <SharedCalendar events={calendarEvents} />
                </div>
              </Card>
            </Col>
          </Row>




          {/* TODAY TABLE */}
          <Card title={selectedDate.format("MMMM D, YYYY")}
            extra={<DatePicker value={selectedDate}
                onChange={(d) => {
                  if (!d) return;
                  setSelectedDate(d);
                  fetchTodayEmployeesAttendance(d);
                }}/>}className={styles.sectionCard}>

            <Table
            columns={columns}
            dataSource={todayRows}
            loading={loadingTodayRows}
            pagination={{ pageSize: 5 }}
            size="small"
              />
          </Card>

        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
