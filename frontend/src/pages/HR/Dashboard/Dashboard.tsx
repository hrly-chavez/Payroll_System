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

const attendanceData = [
  { key: 1, name: "Jeremy Neigh", in: "9:42 P.M.", out: "7:26 A.M.", status: "Present" },
  { key: 2, name: "Annette Black", in: "12:18 A.M.", out: "9:28 A.M.", status: "Late" },
  { key: 3, name: "Theresa Webb", in: "11:58 P.M.", out: "9:20 A.M.", status: "Present" },
  { key: 4, name: "Kathryn Murphy", in: "12:00 A.M.", out: "9:00 A.M.", status: "Present" },
  { key: 5, name: "Jane Cooper", in: "11:50 P.M.", out: "10:00 A.M.", status: "Present" },
];

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
            <Col span={6}><Card><Statistic title="Pending Correction Request" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Lates" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Absences" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Attendance Summary" value={0} /></Card></Col>
          </Row>

          {/* ATTENDANCE + CALENDAR */}
          <Row gutter={16} className={styles.mainSection}>
            <Col xs={24} lg={16}>
              {/* ATTENDANCE */}
              <Card title="Attendance" className={styles.compactCard}>
                <div className={styles.timeRow}>
                  <div className={styles.timeBox}>
                    <span>PH Time 🇵🇭</span>
                    <h2>{formatTime(phTime, "Asia/Manila")}</h2>
                  </div>
                  <div className={styles.timeBox}>
                    <span>USA Time 🇺🇸</span>
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
      {/* CALENDAR */}
            <Col xs={24} lg={8}>
              <Card title="Calendar" className={styles.compactCard}>
                <div className={styles.calendarWrapper}>
                <SharedCalendar events={calendarEvents} />
                </div>
              </Card>
            </Col>
          </Row>

          {/* TODAY TABLE */}
          <Card title={today} extra={<DatePicker />} className={styles.sectionCard}>
            <Table columns={columns} dataSource={attendanceData} pagination={{ pageSize: 5 }} size="small" />
          </Card>

          {/* BOTTOM CARDS */}
          <Row gutter={16} className={styles.bottomRow}>
            <Col xs={24} md={8}>
              <Card title="Pending Holiday Request" className={styles.equalCard}>
                <List size="small" dataSource={["Scrum Master","Software Tester","Software Developer","UI/UX Designer"]} renderItem={item => <List.Item>{item}</List.Item>} />
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card title="Pending Leave Request" className={styles.equalCard}>
                <List size="small" dataSource={["Scrum Master","Software Tester","Software Developer","UI/UX Designer"]} renderItem={item => <List.Item>{item}</List.Item>} />
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card title="Payroll Pending Approval" className={styles.equalCard}>
                <List size="small" dataSource={["Scrum Master","Software Tester","Software Developer","UI/UX Designer"]} renderItem={item => <List.Item>{item}</List.Item>} />
              </Card>
            </Col>
          </Row>

        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
