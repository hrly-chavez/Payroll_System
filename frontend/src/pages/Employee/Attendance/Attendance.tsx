import React, { useState } from "react";
import { Layout, Card, Calendar, Tooltip, Button, Row, Select, Table } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Attendance.module.css";
import dayjs from "dayjs";
import { CalendarOutlined } from "@ant-design/icons";
import AttendanceCorrection from "./AttendanceCorrection";
import LeaveRequest from "./LeaveRequest";


const { Content } = Layout;
const { Option } = Select;

const attendanceData: Record<string, { in: string; out: string }> = {
  "2023-03-07": { in: "8:03 AM", out: "5:12 PM" },
  "2023-03-15": { in: "9:10 AM", out: "6:05 PM" },
  "2023-03-19": { in: "8:00 AM", out: "4:55 PM" },
};

const Attendance: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);


  const dateCellRender = (value: dayjs.Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const record = attendanceData[dateStr];

    if (!record) return null;

    return (
      <Tooltip title={`In: ${record.in} | Out: ${record.out}`}>
        <div className={styles.attendanceDot}></div>
      </Tooltip>
    );
  };

  const columns = [
    { title: "Date", dataIndex: "date" },
    { title: "Punched In", dataIndex: "in" },
    { title: "Punched Out", dataIndex: "out" },
    { title: "WorkShift", dataIndex: "shift" },
    { title: "Status", dataIndex: "status" },
    { title: "Type", dataIndex: "type" },
  ];

  const tableData = [
    { key: 1, date: "16/08/2013", in: "8:02 AM", out: "5:10 PM", shift: "Vietnam", status: "Late", type: "Full Amount" },
    { key: 2, date: "12/06/2020", in: "8:00 AM", out: "4:59 PM", shift: "Nepal", status: "On Time", type: "Offline" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className={styles.content}>
          <Card>
            <Row justify="space-between" align="middle" className={styles.headerRow}>
              <div className={styles.monthPicker}>
                <Select defaultValue="March" size="large">
                  <Option value="March">March</Option>
                </Select>
                <Select defaultValue="2023" size="large">
                  <Option value="2023">2023</Option>
                </Select>
              </div>

              <Button
                type="primary"
                icon={<CalendarOutlined />}
                className={styles.requestBtn}
                onClick={() => setIsModalOpen(true)}
              >
                Request Attendance Correction
              </Button>

              <Button
                type="primary"
                icon={<CalendarOutlined />}
                className={styles.requestLeaveBtn}
                onClick={() => setIsLeaveOpen(true)}
              >
                Request Leave
              </Button>
            </Row>

            <Calendar fullscreen={false} dateCellRender={dateCellRender} />
          </Card>

          <Card title="Attendance History / Logs" className={styles.historyCard}>
            <Table columns={columns} dataSource={tableData} pagination={false} />
          </Card>

          <AttendanceCorrection
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
          <LeaveRequest
            open={isLeaveOpen}
            onClose={() => setIsLeaveOpen(false)}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
