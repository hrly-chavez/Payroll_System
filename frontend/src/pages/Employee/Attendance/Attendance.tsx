// src/pages/Employee/Attendance/Attendance.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Layout,
  Card,
  Calendar,
  Tooltip,
  Button,
  Row,
  Select,
  Tabs,
  Spin,
  Table,
  Tag,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";

import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AttendanceCorrection from "./AttendanceCorrection";
import LeaveRequest from "./LeaveRequest";
import AttendaceLogs from "./AttendanceLogs";
import api from "../../../api/axios";
import styles from "./Attendance.module.css";

const { Content } = Layout;

/* =========================
   Mock attendance data
========================= */
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
     Leave Requests state
  ========================== */
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchLeaveRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get("/approvals/leaves/");
      setLeaveRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch leave requests", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

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

  const goPrevMonth = () => setCalendarValue((v) => v.subtract(1, "month"));
  const goNextMonth = () => setCalendarValue((v) => v.add(1, "month"));
  const setMonth = (m: number) => setCalendarValue((v) => v.month(m));
  const setYear = (y: number) => setCalendarValue((v) => v.year(y));

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
     Leave Requests table columns
  ========================== */
  const leaveColumns = [
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      key: "leave_type",
    },
    {
      title: "Half Day",
      dataIndex: "is_halfday",
      key: "is_halfday",
      render: (val: boolean) => (val ? "Yes" : "No"),
    },
    {
      title: "Half Day Part",
      dataIndex: "halfday_part",
      key: "halfday_part",
      render: (val: string | null) => val ?? "-",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
    },
    {
      title: "Date From",
      dataIndex: "date_from",
      key: "date_from",
      render: (val: string) => dayjs(val).format("DD MMM YYYY"),
    },
    {
      title: "Date To",
      dataIndex: "date_to",
      key: "date_to",
      render: (val: string) => dayjs(val).format("DD MMM YYYY"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const color =
          status === "approved"
            ? "green"
            : status === "rejected"
            ? "red"
            : "orange";
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
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
                  options={years.map((y) => ({ label: y, value: y }))}
                  onChange={setYear}
                />
              </div>

              <div className={styles.actions}>
                <Button
                  type="primary"
                  icon={<CalendarOutlined />}
                  onClick={() => setIsModalOpen(true)}
                >
                  Request Attendance Correction
                </Button>

                <Button
                  type="primary"
                  icon={<CalendarOutlined />}
                  onClick={() => setIsLeaveOpen(true)}
                >
                  Request Leave
                </Button>
              </div>
            </Row>

            {/* ===== Calendar ===== */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", gap: 12 }}>
                  <Button size="small" icon={<LeftOutlined />} onClick={goPrevMonth} />
                  <strong>{calendarValue.format("MMMM YYYY")}</strong>
                  <Button size="small" icon={<RightOutlined />} onClick={goNextMonth} />
                </div>
              </div>

              <Calendar
                value={calendarValue}
                onSelect={setCalendarValue}
                headerRender={() => null}
                fullscreen={false}
                dateCellRender={dateCellRender}
              />
            </div>
          </Card>

          {/* ===== Logs & Requests ===== */}
          <Card className={styles.historyCard}>
            <Tabs defaultActiveKey="logs">
              <Tabs.TabPane tab="Attendance Logs" key="logs">
                <AttendaceLogs year={year} month={month + 1} />
              </Tabs.TabPane>

              <Tabs.TabPane tab="Requests" key="requests">
                <Spin spinning={loadingRequests}>
                  <Table
                    rowKey="id"
                    columns={leaveColumns}
                    dataSource={leaveRequests}
                    pagination={{ pageSize: 5 }}
                  />
                </Spin>
              </Tabs.TabPane>
            </Tabs>
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
