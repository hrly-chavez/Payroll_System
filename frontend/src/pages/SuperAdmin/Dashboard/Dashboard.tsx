//src/pages/SuperAdmin/Dashboard/Dashboard.tsx
import React, { useEffect, useState } from "react";
import { Layout, Row, Col, Spin, message, DatePicker, Segmented, Card } from "antd";
import Chart from "../../../components/Chart";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";

import SharedCalendar from "../../../components/SharedCalendar/SharedCalendar";
import CompanyNote from "../../../components/CompanyNote/CompanyNote";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";

import * as echarts from "echarts";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";
import "./Dashboard.css";

import OverTimeModal  from "./OverTimeModal";
import OverTimeDetailModal  from "./OverTimeDetailModal";
import DeclineReasonModal from "./DeclineReasonModal";
import { HourglassOutlined } from "@ant-design/icons";

import {HOLIDAY_LEGEND,HolidayBase,HolidayType,} from "../../../components/SharedCalendar/CalendarLegend";
import { PAYROLL_COLOR } from "../../../components/SharedCalendar/CalendarLegend";
import type { OverTimeRequest, PendingOTResponse } from "./types";

const role = localStorage.getItem("role") || "";

const { Content } = Layout;






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

/* ================= OVERTIME STATE ================= */
  const [overtimeData, setOvertimeData] = useState<OverTimeRequest[]>([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);



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
  const [isOverTimeModalOpen, setIsOverTimeModalOpen] = useState(false);
  const [isOverTimeDetailModalOpen, setIsOverTimeDetailModalOpen] =
    useState(false);
  const [selectedOverTime, setSelectedOverTime] =
    useState<OverTimeRequest | null>(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  

  /* ================= FETCH FUNCTIONS ================= */
  const fetchOverTimeRequests = async () => {
      setOvertimeLoading(true);
      try {
        const now = dayjs();

        const params = {
          year: now.year(),
          month: now.month() + 1,
        };

        const res = await api.get<PendingOTResponse>(
          "/attendance/super_admin/overtime/pending/",
          { params }
        );

        const mapped: OverTimeRequest[] = (res.data.results || []).map((r) => ({
          id: r.id,
          employee_id: r.employee_id,
          name: r.full_name,

          attendance_id: r.attendance_id,
          attendance_date: r.attendance_date,

          type: r.type, 

          minutes: r.minutes,
          start_time: r.start_time,
          end_time: r.end_time,

          time_in: r.time_in,
          time_out: r.time_out,

          status: r.approval_status,
          event_remarks: r.event_remarks,
          department_name: r.department_name,
          shift_name: r.shift_name,
        }));

        setOvertimeData(mapped);
        return mapped;
      } catch {
        message.error("Failed to fetch overtime requests");
        return [];
      } finally {
        setOvertimeLoading(false);
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
      if (types.includes("Overtime")) overtime++;
      if (types.includes("Undertime")) undertime++;
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
    fetchOverTimeRequests();
    loadCalendarEvents();
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

  const updateOverTimeStatus = async (status: "Approved" | "Declined") => {
    if (!selectedOverTime) return;
    try {
      const payload: any = { status };
        if (status === "Declined") payload.reason = declineReason;

        await api.post(
          `/attendance/super_admin/overtime/${selectedOverTime.id}/status/`,
          payload
        );

      setOvertimeData((prev) =>
        prev.map((r) => (r.id === selectedOverTime.id ? { ...r, status } : r))
      );

      message.success(`Overtime request ${status}`);
      setIsOverTimeDetailModalOpen(false);
      setIsDeclineModalOpen(false);
      setDeclineReason("");
      setSelectedOverTime(null);

      await fetchOverTimeRequests();
    } catch {
      message.error("Failed to update status");
    }
  };

  const handleApprove = async () => updateOverTimeStatus("Approved");
  const handleDecline = async () => updateOverTimeStatus("Declined");

  /* ================= RENDER ================= */
  return (
    <Layout className="dashboard-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />
        <Content className="dashboard-content">
          <Row gutter={[16, 16]} className="equalHeightRow">
          

          {/* PENDING PAYROLL */}
          <Col xs={25} md={7}>
            <Card className="stat-tile primary" hoverable>
              <div className="tile-title">Off Set (Coming Soon)</div>

              <div className="tile-body">
                <HourglassOutlined className="tile-icon" />
                <div className="tile-value">—</div>
              </div>
            </Card>
          </Col>

          {/* OVERTIME */}
          <Col xs={25} md={7}>
            <Card
              className="stat-tile"
              hoverable
              onClick={async () => {
                const latest = await fetchOverTimeRequests();
                const pending = latest.filter((r) => r.status === "Pending");

                if (pending.length === 1) {
                  setSelectedOverTime(pending[0]);
                  setIsOverTimeDetailModalOpen(true);
                } else {
                  setIsOverTimeModalOpen(true);
                }
              }}
            >
              <div className="tile-title">Overtime Pending(s)</div>
                {/* Change this into clock coming soon */}
              <div className="tile-body">
                <HourglassOutlined className="tile-icon" />
                <div className="tile-value">
                  {overtimeData.filter((r) => r.status === "Pending").length}
                </div>
              </div>
            </Card>
          </Col>

          {/* ANNOUNCEMENTS */}
          <Col xs={24} md={10}>
            <CompanyNote role="SUPER_ADMIN" />
          </Col>

        </Row>

          {/* ================= BOTTOM ROW ================= */}
            <Row gutter={[16, 16]} className="equalHeightRow">
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
          <OverTimeModal
            visible={isOverTimeModalOpen}
            onClose={() => setIsOverTimeModalOpen(false)}
            data={overtimeData}
            loading={overtimeLoading}
            navigateToAll={() => navigate("/super-admin/requests/")}
            onRowClick={(row) => {
              setIsOverTimeModalOpen(false);      // close list modal
              setSelectedOverTime(row);
              setIsOverTimeDetailModalOpen(true); // open detail modal
            }}
          />

          <OverTimeDetailModal
            visible={isOverTimeDetailModalOpen}
            overtime={selectedOverTime}
            onClose={() => setIsOverTimeDetailModalOpen(false)} 
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


        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;