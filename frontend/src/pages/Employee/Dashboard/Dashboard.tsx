import React, { useEffect, useState } from "react";
import { Layout, Card, Row, Col, Button, Tag, Calendar, Statistic, Select } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import Greeting from "../../../components/Greeting/Greeting";
import styles from "./Dashboard.module.css";
import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";

const { Content } = Layout;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);

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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhTime(p => p ? new Date(p.getTime() + 1000) : p);
      setUsaTime(p => p ? new Date(p.getTime() + 1000) : p);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date | null, tz: string) =>
    date
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
          timeZone: tz,
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
            <Col xs={24} md={12} className={styles.flexCol}>
              <Card title="Attendance" className={`${styles.sectionCard} ${styles.equalTopCard}`}>
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
                  <Button icon={<LoginOutlined />} className={styles.punchInBtn}>Punch in</Button>
                  <Button icon={<LogoutOutlined />} className={styles.punchOutBtn}>Punch out</Button>
                </div>
              </Card>
            </Col>

            {/* RIGHT COLUMN */}
            <Col xs={24} md={12} className={styles.flexCol}>
              <Card title="Calendar" className={`${styles.sectionCard} ${styles.equalTopCard}`}>
                <Calendar
                  fullscreen={false}
                  headerRender={({ value, onChange }) => {
                    const current = value as Dayjs;
                    const year = current.year();
                    const month = current.month();
                    const years = Array.from({ length: 20 }, (_, i) => year - 10 + i);

                    return (
                      <div className={styles.calendarHeader}>
                        <Select size="small" value={year} onChange={(y) => onChange(current.year(y))}>
                          {years.map(y => <Option key={y} value={y}>{y}</Option>)}
                        </Select>

                        <Select size="small" value={month} onChange={(m) => onChange(current.month(m))}>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <Option key={i} value={i}>{dayjs().month(i).format("MMM")}</Option>
                          ))}
                        </Select>
                      </div>
                    );
                  }}
                />
              </Card>
            </Col>

          </Row>

          {/* LOWER CARDS */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card title="Payslip Status" className={styles.sectionCard}>
                <Tag color="processing">PROCESSING</Tag>
                <div>January 1, 2026</div>
              </Card>

              <Card title="Payslip Cut Off" className={styles.sectionCard}>
                <h3>08:00</h3>
                <div>January 1, 2026</div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
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
