"use client";

import React, { useState } from "react";
import {
  Layout,
  Card,
  Calendar,
  Tooltip,
  Button,
  Row,
  Select,
  Table,
} from "antd";
import type { Dayjs } from "dayjs";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Attendance.module.css";
import dayjs from "dayjs";
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
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
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);

  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());

  /* =========================
     Calendar controls
  ========================== */
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: dayjs().month(i).format("MMMM"),
    value: i,
  }));

  const year = calendarValue.year();
  const month = calendarValue.month();
  const years = Array.from({ length: 10 }, (_, i) => year - 5 + i);

  const goPrevMonth = () =>
    setCalendarValue((v) => v.subtract(1, "month"));
  const goNextMonth = () =>
    setCalendarValue((v) => v.add(1, "month"));
  const setMonth = (m: number) =>
    setCalendarValue((v) => v.month(m));
  const setYear = (y: number) =>
    setCalendarValue((v) => v.year(y));

  /* =========================
     Calendar cell render
  ========================== */
  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const record = attendanceData[dateStr];

    if (!record) return null;

    return (
      <Tooltip title={`In: ${record.in} | Out: ${record.out}`}>
        <div className={styles.attendanceDot} />
      </Tooltip>
    );
  };

  /* =========================
     Table
  ========================== */
  const columns = [
    { title: "Date", dataIndex: "date" },
    { title: "Punched In", dataIndex: "in" },
    { title: "Punched Out", dataIndex: "out" },
    { title: "WorkShift", dataIndex: "shift" },
    { title: "Status", dataIndex: "status" },
    { title: "Type", dataIndex: "type" },
  ];

  const tableData = [
    {
      key: 1,
      date: "16/08/2013",
      in: "8:02 AM",
      out: "5:10 PM",
      shift: "Vietnam",
      status: "Late",
      type: "Full Amount",
    },
    {
      key: 2,
      date: "12/06/2020",
      in: "8:00 AM",
      out: "4:59 PM",
      shift: "Nepal",
      status: "On Time",
      type: "Offline",
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className={styles.content}>
          {/* ===== Header actions ===== */}
          <Card>
            <Row
              justify="space-between"
              align="middle"
              className={styles.headerRow}
            >
              <div className={styles.monthPicker}>
                <Select
                  size="large"
                  value={month}
                  options={monthOptions}
                  onChange={setMonth}
                />
                <Select
                  size="large"
                  value={year}
                  options={years.map((y) => ({
                    label: y,
                    value: y,
                  }))}
                  onChange={setYear}
                />
              </div>

               <div className={styles.actions}>
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
                  className={styles.requestBtn}
                  onClick={() => setIsLeaveOpen(true)}
                >
                  Request Leave
                </Button>
              </div>
            </Row>

            {/* ===== Styled Calendar (same layout as HR Calendar) ===== */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Button
                    size="small"
                    icon={<LeftOutlined />}
                    onClick={goPrevMonth}
                  />
                  <div style={{ fontWeight: 600 }}>
                    {calendarValue.format("MMMM YYYY")}
                  </div>
                  <Button
                    size="small"
                    icon={<RightOutlined />}
                    onClick={goNextMonth}
                  />
                </div>
              </div>

              <Calendar
                value={calendarValue}
                onSelect={(val) => setCalendarValue(val)}
                headerRender={() => null}
                fullscreen={false}
                dateCellRender={dateCellRender}
              />
            </div>
          </Card>

          {/* ===== Attendance history ===== */}
          <Card title="Attendance History / Logs" className={styles.historyCard}>
            <Table
              columns={columns}
              dataSource={tableData}
              pagination={false}
            />
          </Card>

          {/* ===== Modals ===== */}
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
