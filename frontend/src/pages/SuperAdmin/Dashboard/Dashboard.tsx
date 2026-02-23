import React, { useEffect, useState } from "react";
import { Layout, Row, Col, Spin, message, DatePicker, Segmented, Card } from "antd";
import Chart from "../../../components/Chart";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";

import SharedCalendar from "../../../components/SharedCalendar/SharedCalendar";
import CompanyNote from "../../../components/CompanyNote/CompanyNote";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";

import { Pie } from "@ant-design/plots";

import * as echarts from "echarts";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";
import "./Dashboard.css";

import HolidayModal from "./HolidayModal";
import HolidayDetailModal from "./HolidayDetailModal";
import DeclineReasonModal from "./DeclineReasonModal";
import PendingPayrollModal from "./PendingPayrollModal";
import { HourglassOutlined } from "@ant-design/icons";

import {
  HOLIDAY_LEGEND,
  HolidayBase,
  HolidayType,
} from "../../../components/SharedCalendar/CalendarLegend";
import { PAYROLL_COLOR } from "../../../components/SharedCalendar/CalendarLegend";

const role = localStorage.getItem("role") || "";

const { Content } = Layout;

interface HolidayRequest {
  id: number;
  name: string;
  date: string;
  type: string;
  base: string;
  status: "Pending" | "Approved" | "Declined";
}

interface Payroll {
  id: number;
  employee_name: string;
  period: string;
  total_amount: number;
  status: string;
}

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "OVERTIME"
  | "UNDERTIME";

type RangeMode = "Day" | "Week" | "Month" | "Year";

type CalendarEvent = {
    type: "holiday" | "payroll";
    start_date: string;
    end_date?: string;
    title: string;
    color: string;
  };


const Dashboard: React.FC = () => {
  const currentDate = dayjs().format("MMMM D, YYYY");

  const navigate = useNavigate();

  /* ------------------ Calendar ------------------ */
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const loadCalendarEvents = async () => {
    try {
      const [holidayRes, payrollRes] = await Promise.all([
        api.get("/approvals/holidays/"),
        api.get("/payroll/periods/"),
      ]);

      const holidays = holidayRes.data;
      const payrolls = payrollRes.data;

      const events: CalendarEvent[] = [
        ...holidays.map((h: any) => {
          const base = h.base as HolidayBase;
          const type = h.type as HolidayType;

          const legend = HOLIDAY_LEGEND[base]?.[type];

          return {
            type: "holiday",
            start_date: h.date,
            title: `${h.base} Holiday – ${h.name}`,
            color: legend?.bgColor || "#999999",
          };
        }),

        ...payrolls.map((p: any) => ({
          type: "payroll",
          start_date: p.start_date,
          end_date: p.end_date,
          title: "Payroll",
          color: PAYROLL_COLOR.bgColor,
        })),
      ];

      setCalendarEvents(events);
    } catch {
      message.error("Failed to load calendar events");
    }
  };
  
  /* ------------------ Chart state ------------------ */
  const [chartOption, setChartOption] =
    useState<echarts.ComposeOption<echarts.BarSeriesOption>>();
  const [chartHeight, setChartHeight] = useState<number>(280);

  /* ================= HOLIDAY STATE ================= */
  const [holidayData, setHolidayData] = useState<HolidayRequest[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);

  /* ================= PAYROLL STATE ================= */
  const [pendingPayrolls, setPendingPayrolls] = useState<Payroll[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  /* ================= ATTENDANCE STATE ================= */
  const [attendanceData, setAttendanceData] =
    useState<Record<AttendanceStatus, number>>({
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      OVERTIME: 0,
      UNDERTIME: 0,
    });
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("Day");

  /* ================= MODAL STATE ================= */
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isHolidayDetailModalOpen, setIsHolidayDetailModalOpen] =
    useState(false);
  const [selectedHoliday, setSelectedHoliday] =
    useState<HolidayRequest | null>(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  /* ================= FETCH FUNCTIONS ================= */
  const fetchHolidayRequests = async () => {
    setHolidayLoading(true);
    try {
      const res = await api.get<HolidayRequest[]>(
        "/approvals/superadmin/holidays/"
      );
      setHolidayData(res.data);
      return res.data;
    } catch {
      message.error("Failed to fetch holidays");
      return [];
    } finally {
      setHolidayLoading(false);
    }
  };

  const fetchPendingPayrolls = async () => {
    setPayrollLoading(true);
    try {
      const res = await api.get<Payroll[]>("/superadmin/pending-payrolls/");
      setPendingPayrolls(res.data);
    } catch {
      message.error("Failed to fetch payrolls");
    } finally {
      setPayrollLoading(false);
    }
  };

  /* ================= ATTENDANCE COUNT FUNCTION ================= */
  const countFromRows = (list: any[], totalEmployees: number) => {
    let present = 0,
      late = 0,
      overtime = 0,
      undertime = 0;

    list.forEach((r: any) => {
      if (r.status === "PRESENT") present++;
      const types = (r.event_types || "")
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean);

      if (types.includes("Late")) late++;
      if (types.includes("OverTime")) overtime++;
      if (types.includes("UnderTime")) undertime++;
    });

    const absent = totalEmployees - present;

    return { PRESENT: present, ABSENT: absent, LATE: late, OVERTIME: overtime, UNDERTIME: undertime };
  };

  const fetchMonthRows = async (y: number, m: number) => {
    const params = { year: y, month: m };
    const res = await api.get("/attendance/admin/logs/", { params });
    return res.data.results || [];
  };

  const filterRowsByRange = (rows: any[], mode: RangeMode, anchor: Dayjs) => {
    if (mode === "Month") {
      const start = anchor.startOf("month");
      const end = anchor.endOf("month");
      return rows.filter((r) => {
        const d = dayjs(r.date);
        return (d.isAfter(start, "day") || d.isSame(start, "day")) &&
          (d.isBefore(end, "day") || d.isSame(end, "day"));
      });
    }
    if (mode === "Day") {
      const target = anchor.format("YYYY-MM-DD");
      return rows.filter((r) => r.date === target);
    }
    if (mode === "Week") {
      const start = anchor.startOf("week");
      const end = anchor.endOf("week");
      return rows.filter((r) => {
        const d = dayjs(r.date);
        return (d.isAfter(start, "day") || d.isSame(start, "day")) &&
          (d.isBefore(end, "day") || d.isSame(end, "day"));
      });
    }
    return rows;
  };

  const fetchAttendanceAnalytics = async (d?: Dayjs, mode?: RangeMode) => {
    setAttendanceLoading(true);
    try {
      const anchor = d ?? selectedDate;
      const m = mode ?? rangeMode;

      // TODO: replace with real total employees count
      const totalEmployees = 10;

      if (m === "Year") {
        const y = anchor.year();
        const all: any[] = [];
        for (let mm = 1; mm <= 12; mm++) {
          const rows = await fetchMonthRows(y, mm);
          all.push(...rows);
        }
        setAttendanceData(countFromRows(all, totalEmployees));
        return;
      }

      const y = anchor.year();
      const month = anchor.month() + 1;
      const monthRows = await fetchMonthRows(y, month);
      const filtered = filterRowsByRange(monthRows, m, anchor);
      setAttendanceData(countFromRows(filtered, totalEmployees));
    } catch {
      message.error("Failed to load attendance analytics");
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidayRequests();
    loadCalendarEvents();
    fetchPendingPayrolls();
    fetchAttendanceAnalytics(selectedDate, rangeMode);
  }, []);

  /* ================= CHART ================= */
  const computeSettings = (width: number) => {
    if (width >= 1400) return { barWidth: 72, height: 400 };
    if (width >= 1200) return { barWidth: 56, height: 360 };
    if (width >= 992) return { barWidth: 44, height: 320 };
    if (width >= 768) return { barWidth: 36, height: 280 };
    return { barWidth: "40%", height: 220 };
  };

  const updateChart = (width: number) => {
    const s = computeSettings(width);
    setChartHeight(s.height);
    setChartOption({
      xAxis: { type: "category", data: ["PRESENT", "ABSENT", "LATE", "OVERTIME", "UNDERTIME"] },
      yAxis: { type: "value" },
      series: [
        {
          type: "bar",
          data: [
            attendanceData.PRESENT,
            attendanceData.ABSENT,
            attendanceData.LATE,
            attendanceData.OVERTIME,
            attendanceData.UNDERTIME,
          ],
          barWidth: s.barWidth,
          itemStyle: { color: "#6c8ea3" },
          label: { show: true, position: "top" },
        },
      ],
    });
  };

  useEffect(() => {
    updateChart(window.innerWidth);
    const handleResize = () => updateChart(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [attendanceData]);

  /* ================= HOLIDAY STATUS ================= */
  const updateHolidayStatus = async (status: "Approved" | "Declined") => {
    if (!selectedHoliday) return;
    try {
      await api.post(`/approvals/superadmin/holidays/${selectedHoliday.id}/status/`, {
        status,
        reason: status === "Declined" ? declineReason : null,
      });
      setHolidayData(prev =>
        prev.map(h => (h.id === selectedHoliday.id ? { ...h, status } : h))
      );
      message.success(`Holiday request ${status}`);
      setIsHolidayDetailModalOpen(false);
      setIsDeclineModalOpen(false);
      setDeclineReason("");
      setSelectedHoliday(null);
      await fetchHolidayRequests();
    } catch {
      message.error("Failed to update status");
    }
  };

  const handleApprove = async () => updateHolidayStatus("Approved");
  const handleDecline = async () => updateHolidayStatus("Declined");

  /* ================= RENDER ================= */
  return (
    <Layout className="dashboard-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />
        <Content className="dashboard-content">
          {/* ================= TOP ROW ================= */}
          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} md={6}>
              <div className="card stat-card">
                <h4 className="card-title">{currentDate}</h4>
                <div
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* 🟢 DONUT CHART */}
                  <Pie
                    data={[
                      { type: "Reported", value: attendanceData.PRESENT || 0 },
                      { type: "Not Reported", value: attendanceData.ABSENT || 0 },
                    ]}
                    angleField="value"
                    colorField="type"
                    radius={1}
                    innerRadius={0.75}
                    legend={false}
                    label={false}
                    tooltip={false}
                    height={170}
                    scale={{
                      color: {
                        domain: ["Reported", "Not Reported"],
                        range: ["#1677ff", "#6BE0E0"],
                      },
                    }}
                  />

                  {/* 🟢 CUSTOM LEGEND */}
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 16,
                      display: "flex",
                      justifyContent: "center",
                      gap: 24,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          background: "#6BE0E0",
                          borderRadius: "50%",
                          marginRight: 6,
                          display: "inline-block",
                        }}
                      />
                      Not Reported
                    </span>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          background: "#1677ff",
                          borderRadius: "50%",
                          marginRight: 6,
                          display: "inline-block",
                        }}
                      />
                      Reported
                    </span>
                  </div>
                </div>
              </div>
            </Col>

            <Col xs={24} md={4}>
              <div
                className="card stat-card stat-tile primary clickable"
                onClick={() => setIsPayrollModalOpen(true)}
              >
                <div className="tile-title">Pending Payroll</div>

                <div className="tile-body">
                  <HourglassOutlined className="tile-icon" />
                  <div className="tile-value">
                    {payrollLoading ? <Spin /> : pendingPayrolls.length}
                  </div>
                </div>
              </div>
            </Col>
            <Col xs={24} md={4}>
              <div
                className="card stat-card stat-tile clickable"
                onClick={async () => {
                  const latestHolidays = await fetchHolidayRequests();
                  const pendingHolidays = latestHolidays.filter(
                    (h) => h.status === "Pending"
                  );

                  if (pendingHolidays.length === 1) {
                    setSelectedHoliday(pendingHolidays[0]);
                    setIsHolidayDetailModalOpen(true);
                  } else {
                    setIsHolidayModalOpen(true);
                  }
                }}
              >
                <div className="tile-title">Holiday Request(s)</div>

                <div className="tile-body">
                  <HourglassOutlined className="tile-icon" />
                  <div className="tile-value">
                    {holidayData.filter((h) => h.status === "Pending").length}
                    
                  </div>
                </div>
              </div>
            </Col>


            <Col xs={24} md={10}>
               <CompanyNote role="SUPER_ADMIN" />
            </Col>  
          </Row>

          {/* ================= BOTTOM ROW ================= */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={16}>
              <div className="card analytics-card">
                <div className="filter-row">
                  <Segmented
                    value={rangeMode}
                    options={["Day", "Week", "Month", "Year"]}
                    onChange={(v) => {
                      const mode = v as RangeMode;
                      setRangeMode(mode);
                      fetchAttendanceAnalytics(selectedDate, mode);
                    }}
                  />
                  <DatePicker
                    value={selectedDate}
                    onChange={(d) => {
                      if (!d) return;
                      setSelectedDate(d);
                      fetchAttendanceAnalytics(d);
                    }}
                  />
                </div>
                <Spin spinning={attendanceLoading}>
                  {chartOption && <Chart option={chartOption} style={{ height: chartHeight }} />}
                </Spin>
              </div>
            </Col>

            <Col xs={24} lg={8}>
            <div className="card calendar-card">
              <SharedCalendar events={calendarEvents} />
              <CalendarLegendDisplay />
            </div>
            </Col>
          </Row>

          {/* ================= MODALS ================= */}
          <HolidayModal
            visible={isHolidayModalOpen}
            onClose={() => setIsHolidayModalOpen(false)}
            data={holidayData}
            loading={holidayLoading}
            navigateToAll={() => navigate("/super-admin/requests/")}
            onRowClick={(holiday) => {
              setSelectedHoliday(holiday);
              setIsHolidayDetailModalOpen(true);
            }}
          />

          <HolidayDetailModal
            visible={isHolidayDetailModalOpen}
            holiday={selectedHoliday}
            onClose={() => setIsHolidayDetailModalOpen(false)}
            onApprove={handleApprove}
            onDecline={() => setIsDeclineModalOpen(true)}
          />

          <DeclineReasonModal
            visible={isDeclineModalOpen}
            reason={declineReason}
            setReason={setDeclineReason}
            onCancel={() => setIsDeclineModalOpen(false)}
            onSave={handleDecline}
          />

          <PendingPayrollModal
            visible={isPayrollModalOpen}
            onClose={() => setIsPayrollModalOpen(false)}
            data={pendingPayrolls}
            loading={payrollLoading}
            navigateToAll={() => navigate("/superadmin/payroll")}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
