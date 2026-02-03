import React, { useEffect, useState } from "react";
import { Layout, Card, Row, Col, Button, Tag, Calendar, Statistic, Divider, message } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import Greeting from "../../../components/Greeting/Greeting";
import styles from "./Dashboard.module.css";
import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import axios from "axios";
import api from "../../../api/axios";

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

const Dashboard: React.FC = () => {
  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);

  const [attendance, setAttendance] = useState<TodayAttendanceResponse["attendance"]>(null);
  const [loadingPunchIn, setLoadingPunchIn] = useState(false);
  const [loadingPunchOut, setLoadingPunchOut] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

    
    

    const fetchTodayAttendance = async () => {
      setLoadingStatus(true);
      try {
       try {
          const res = await api.get<TodayAttendanceResponse>("/api/attendance/today/");
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
       try {
          const res = await api.post("/api/attendance/punch-in/", {});
          message.success(res.data?.message || "Punch in successful.");
          setAttendance(res.data.attendance);
        } catch (err: any) {
          console.error(err);
          const msg = err?.response?.data?.detail || "Punch in failed.";
          message.error(msg);
        } 
      } catch (err: any) {
        console.error(err);
        message.error(err?.message || "Punch in failed.");
      } finally {
        setLoadingPunchIn(false);
      }
    };

    const handlePunchOut = async () => {
      setLoadingPunchOut(true);
      try {
        try {
          const res = await api.post("/api/attendance/punch-out/", {});
          message.success(res.data?.message || "Punch out successful.");
          setAttendance(res.data.attendance);
        } catch (err: any) {
          console.error(err);
          const msg = err?.response?.data?.detail || "Punch out failed.";
          message.error(msg);
        }

      } catch (err: any) {
        console.error(err);
        message.error(err?.message || "Punch out failed.");
      } finally {
        setLoadingPunchOut(false);
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
    fetchBaseTime("Asia/Manila", setPhTime);
    fetchBaseTime("America/New_York", setUsaTime);
    fetchTodayAttendance();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhTime((prev) => (prev ? new Date(prev.getTime() + 1000) : prev));
      setUsaTime((prev) => (prev ? new Date(prev.getTime() + 1000) : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date | null, timezone: string) =>
    date
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
          timeZone: timezone,
        }).format(date)
      : "--:--:--";
    

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />

        <Content className={styles.content}>
          <Greeting />

          {/* Stats */}
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="Total Present" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Lates" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Absences" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Leave request pending" value={0} /></Card></Col>
          </Row>

          <Row gutter={16} className={styles.mainSection}>

            {/* LEFT COLUMN */}
            <Col xs={24} md={12}>

              {/* ATTENDANCE */}
              <Card title="Attendance" className={styles.sectionCard}>
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

              {/* PAYSLIP STATUS */}
              <Card title="Payslip Status" className={styles.sectionCard}>
                <Tag color="processing">PROCESSING</Tag>
                <div>January 1, 2026</div>
              </Card>

              {/* PAYSLIP CUT OFF */}
              <Card title="Payslip Cut Off" className={styles.sectionCard}>
                <h3>08:00</h3>
                <div>January 1, 2026</div>
              </Card>

            </Col>

            {/* RIGHT COLUMN */}
            <Col xs={24} md={12}>
              <Card title="Calendar" className={styles.sectionCard}>
                <div className={styles.smallCalendar}>
                  <Calendar fullscreen={false} />
                </div>
              </Card>

              
              <Card title="Legend & Holidays" className={styles.sectionCard}>
              <div className={styles.legendHolidayGrid}>

                {/* LEFT: Legend */}
                <div className={styles.legendSection}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendGreen}></span> PH Holiday
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendRed}></span> US Holiday
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendYellow}></span> Work Day
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendGray}></span> Non-Work
                  </div>
                </div>

                {/* RIGHT: Holidays */}
                <ul className={styles.holidayList}>
                  <li>Jan 1 — New Year's Day</li>
                  <li>Feb 10 — Chinese New Year</li>
                  <li>Mar 29 — Good Friday</li>
                </ul>

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
