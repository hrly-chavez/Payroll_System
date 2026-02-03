import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import Greeting from "../../../components/Greeting/Greeting";
import {
  Layout,
  Row,
  Col,
  Card,
  Statistic,
  Table,
  DatePicker,
  Calendar,
  List,
  Button,
} from "antd";
import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import styles from "./adminDashboard.module.css";

const { Content } = Layout;

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

  const [phTime, setPhTime] = useState<Date | null>(null);
  const [usaTime, setUsaTime] = useState<Date | null>(null);

  // ✅ NO API — stable local clock
  useEffect(() => {
    const updateTime = () => {
      setPhTime(new Date());
      setUsaTime(new Date());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
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
                  <Button icon={<LoginOutlined />} className={styles.punchInBtn}>Punch in</Button>
                  <Button icon={<LogoutOutlined />} className={styles.punchOutBtn}>Punch out</Button>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Calendar" className={styles.compactCard}>
                <div className={styles.calendarWrapper}>
                  <Calendar fullscreen={false} />
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
