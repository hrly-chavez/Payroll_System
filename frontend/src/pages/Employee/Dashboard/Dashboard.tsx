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

const Dashboard: React.FC = () => {
  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);
  const [calendarEvents, setCalendarEvents] = useState([]);

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

    
    

    const fetchTodayAttendance = async () => {
      setLoadingStatus(true);
      try {
       try {
          const res = await api.get<TodayAttendanceResponse>("/attendance/today/");
          setAttendance(res.data.attendance);
        } catch (err: any) {
          console.error(err);
          const msg = err?.response?.data?.detail || "Failed to fetch attendance status.";
          message.error(msg);
        }
      } catch (err: any) {
        console.error(err);
        message.error(err?.message || "Failed to load attendance status.");
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
      const fetchTime = async () => {
        try {
          const ph = await fetch("https://worldtimeapi.org/api/timezone/Asia/Manila").then(r => r.json());
          const us = await fetch("https://worldtimeapi.org/api/timezone/America/New_York").then(r => r.json());
          setPhTime(new Date(ph.datetime));
          setUsaTime(new Date(us.datetime));
        } catch {}
      };
      fetchTime();
      fetchBaseTime("Asia/Manila", setPhTime);
      fetchBaseTime("America/New_York", setUsaTime);
      fetchTodayAttendance();
      loadCalendarEvents();
    }, []);

    useEffect(() => {
      const interval = setInterval(() => {
        setPhTime(p => p ? new Date(p.getTime() + 1000) : p);
        setUsaTime(p => p ? new Date(p.getTime() + 1000) : p);
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



          {/* Stats */}
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="Total Present" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Lates" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Absences" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Leave request pending" value={0} /></Card></Col>
          </Row>

          <Row gutter={16} className={styles.mainSection}>

            {/* LEFT COLUMN */}
            <Col xs={24} md={14}>

              {/* ATTENDANCE */}
              <Card title="Attendance" className={styles.sectionCard}>
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
              <Card title="Payslip Status" className={styles.sectionCard}>
                <Tag color="processing">PROCESSING</Tag>
                <div>January 1, 2026</div>
              </Card>

              <Card title="Payslip Cut Off" className={styles.sectionCard}>
                <h3>08:00</h3>
                <div>January 1, 2026</div>
              </Card>
            </Col>

            {/* RIGHT COLUMN */}
            <Col xs={24} md={10}>
              <Card title="Calendar" className={styles.calendarCard}>
                <SharedCalendar events={calendarEvents} />
              </Card>

              <Card title="Legend & Holidays" className={styles.sectionCard}>
                <div className={styles.legendSection}>
                  <div className={styles.legendItem}><span className={styles.legendGreen}></span> PH Holiday</div>
                  <div className={styles.legendItem}><span className={styles.legendRed}></span> US Holiday</div>
                  <div className={styles.legendItem}><span className={styles.legendYellow}></span> Work Day</div>
                  <div className={styles.legendItem}><span className={styles.legendGray}></span> Non-Work</div>
                </div>
              </Card>
              </Col>

          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
