import React, { useEffect, useState } from "react";
import { Layout, Card, Row, Col, Button, Tag, Calendar, Statistic } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import Greeting from "../../../components/Greeting/Greeting";
import styles from "./Dashboard.module.css";

const { Content, Footer } = Layout;

const timezones = {
  PH: "Asia/Manila",
  USA: "America/New_York",
};

const Dashboard: React.FC = () => {
  const [phTime, setPhTime] = useState("--:--:--");
  const [usaTime, setUsaTime] = useState("--:--:--");

  const fetchTime = async (timezone: string, setter: (t: string) => void) => {
    try {
      const res = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
      const data = await res.json();

      const date = new Date(data.datetime);

      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZone: timezone, 
      }).format(date);

      setter(formatted);
    } catch (err) {
      console.error("Time API error", err);
    }
  };


  useEffect(() => {
    fetchTime(timezones.PH, setPhTime);
    fetchTime(timezones.USA, setUsaTime);

    const interval = setInterval(() => {
      fetchTime(timezones.PH, setPhTime);
      fetchTime(timezones.USA, setUsaTime);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

          {/* Main Section */}
          <Row gutter={16} className={styles.mainSection}>
            {/* Attendance */}
            <Col xs={24} md={12}>
              <Card title="Attendance">
                <div className={styles.timeRow}>
                  <div className={styles.timeBox}>
                    <span>PH Time 🇵🇭</span>
                    <h2>{phTime}</h2>
                  </div>

                  <div className={styles.timeBox}>
                    <span>USA Time 🇺🇸</span>
                    <h2>{usaTime}</h2>
                  </div>
                </div>

                <Row justify="center" className={styles.buttonRow}>
                  <Button className={styles.punchInBtn}>Punch in</Button>
                  <Button className={styles.punchOutBtn}>Punch out</Button>
                </Row>
              </Card>
            </Col>

            {/* Calendar */}
            <Col xs={24} md={12}>
              <Card title="Calendar">
                <Calendar fullscreen={false} />
              </Card>
            </Col>
          </Row>

          {/* Bottom */}
          <Row gutter={16} className={styles.bottomSection}>
            <Col xs={24} md={12}>
              <Card title="Payslip Status">
                <Tag color="processing">PROCESSING</Tag>
                <div>January 1, 2026</div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="Payslip Cut Off">
                <h3>08:00</h3>
                <div>January 1, 2026</div>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
