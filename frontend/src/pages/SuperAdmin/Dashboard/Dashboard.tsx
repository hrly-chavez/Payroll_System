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

import ExcessTimeModal from "./ExcessTimeModal";
import ExcessTimeDetailModal from "./ExcessTimeDetailModal";
import DeclineReasonModal from "./DeclineReasonModal";
import { HourglassOutlined } from "@ant-design/icons";

import { HOLIDAY_LEGEND, HolidayBase, HolidayType } from "../../../components/SharedCalendar/CalendarLegend";
import { PAYROLL_COLOR } from "../../../components/SharedCalendar/CalendarLegend";
import type { ExcessTimeRequest, PendingExcessTimeResponse } from "./types";

const role = localStorage.getItem("role") || "";

const { Content } = Layout;

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "OVERTIME"
  | "UNDERTIME";

type RangeMode = "Day" | "Week" | "Month" | "Year";

type AttendanceAnalyticsResponse = {
  mode: RangeMode;
  date: string;
  start_date: string;
  end_date: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  undertime: number;
  overtime: number;
};

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

  /* ================= EXCESS TIME STATE ================= */
  const [excessTimeData, setExcessTimeData] = useState<ExcessTimeRequest[]>([]);
  const [excessTimeLoading, setExcessTimeLoading] = useState(false);

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
  const [isExcessTimeModalOpen, setIsExcessTimeModalOpen] = useState(false);
  const [isExcessTimeDetailModalOpen, setIsExcessTimeDetailModalOpen] =
    useState(false);
  const [selectedExcessTime, setSelectedExcessTime] =
    useState<ExcessTimeRequest | null>(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  /* ================= FETCH FUNCTIONS ================= */
  const fetchExcessTimeRequests = async () => {
    setExcessTimeLoading(true);
    try {
      const now = dayjs();

      const params = {
        year: now.year(),
        month: now.month() + 1,
      };

      const res = await api.get<PendingExcessTimeResponse>(
        "/attendance/super_admin/excess-time/pending/",
        { params }
      );

      const mapped: ExcessTimeRequest[] = (res.data.results || []).map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        name: r.full_name,

        attendance_id: r.attendance_id,
        attendance_date: r.attendance_date,

        minutes: r.minutes,
        start_time: r.start_time,
        end_time: r.end_time,

        time_in: r.time_in,
        time_out: r.time_out,

        status: r.status,
        resolution_type: r.resolution_type,
        remarks: r.remarks,
        created_at: r.created_at,

        department_name: r.department_name,
        shift_name: r.shift_name,
      }));

      setExcessTimeData(mapped);
      return mapped;
    } catch {
      message.error("Failed to fetch excess time requests");
      return [];
    } finally {
      setExcessTimeLoading(false);
    }
  };

  const fetchAttendanceAnalytics = async (d?: Dayjs, mode?: RangeMode) => {
    setAttendanceLoading(true);
    try {
      const anchor = d ?? selectedDate;
      const m = mode ?? rangeMode;

      const params = {
        mode: m,
        date: anchor.format("YYYY-MM-DD"),
      };

      const res = await api.get<AttendanceAnalyticsResponse>(
        "/attendance/super_admin/analytics/",
        { params }
      );

      setAttendanceData({
        PRESENT: res.data.present ?? 0,
        ABSENT: res.data.absent ?? 0,
        LATE: res.data.late ?? 0,
        OVERTIME: res.data.overtime ?? 0,
        UNDERTIME: res.data.undertime ?? 0,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load attendance analytics";
      message.error(msg);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceAnalytics(selectedDate, rangeMode);
  }, [selectedDate, rangeMode]);

  useEffect(() => {
    fetchExcessTimeRequests();
    loadCalendarEvents();
  }, []);

  /* ================= CHART ================= */

  const computeSettings = (width: number) => {
    if (width >= 1400) return { barWidth: 72 };
    if (width >= 1200) return { barWidth: 56 };
    if (width >= 992) return { barWidth: 44 };
    if (width >= 768) return { barWidth: 36 };
    return { barWidth: "40%" as const };
  };

  const updateChart = (width: number) => {
    const s = computeSettings(width);
    setChartOption({
      grid: { left: 40, right: 16, top: 18, bottom: 40, containLabel: true },
      xAxis: { type: "category", data: ["PRESENT", "ABSENT", "LATE", "OVERTIME", "UNDERTIME"], axisLabel: { interval: 0 } },
      yAxis: { type: "value", min: 0 },
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

  const resolveExcessTimeRequest = async (
    action: "Approve as Overtime" | "Approve as Offset" | "Decline"
  ) => {
    if (!selectedExcessTime) return;

    try {
      const payload: { action: string; reason?: string } = { action };

      if (action === "Decline") {
        payload.reason = declineReason.trim();
      }

      await api.post(
        `/attendance/super_admin/excess-time/${selectedExcessTime.id}/resolve/`,
        payload
      );

      let successMessage = "Excess time request updated successfully.";
      if (action === "Approve as Overtime") {
        successMessage = "Excess time approved as Overtime.";
      } else if (action === "Approve as Offset") {
        successMessage = "Excess time approved as Offset.";
      } else if (action === "Decline") {
        successMessage = "Excess time request declined.";
      }

      message.success(successMessage);

      setIsExcessTimeDetailModalOpen(false);
      setIsDeclineModalOpen(false);
      setDeclineReason("");
      setSelectedExcessTime(null);

      await fetchExcessTimeRequests();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.reason?.[0] ||
        err?.response?.data?.reason ||
        "Failed to resolve excess time request";
      message.error(msg);
    }
  };

  const handleApproveAsOvertime = async () =>
    resolveExcessTimeRequest("Approve as Overtime");

  const handleApproveAsOffset = async () =>
    resolveExcessTimeRequest("Approve as Offset");

  const handleDecline = async () =>
    resolveExcessTimeRequest("Decline");

  return (
    <Layout className="dashboard-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />
        <Content className="dashboard-content">
          <Row gutter={[16, 16]} className="equalHeightRow">
            <Col xs={25} md={7}>
              <Card className="stat-tile primary" hoverable>
                <div className="tile-title">Off Set (Coming Soon)</div>

                <div className="tile-body">
                  <HourglassOutlined className="tile-icon" />
                  <div className="tile-value">—</div>
                </div>
              </Card>
            </Col>

            <Col xs={25} md={7}>
            
              <Card
                className="stat-tile"
                hoverable
                onClick={async () => {
                  const latest = await fetchExcessTimeRequests();
                  const pending = latest.filter((r) => r.status === "Pending");

                  if (pending.length === 1) {
                    setSelectedExcessTime(pending[0]);
                    setIsExcessTimeDetailModalOpen(true);
                  } else {
                    setIsExcessTimeModalOpen(true);
                  }
                }}
              >
                <div className="tile-title">Excess Time Pending(s)</div>
                <div className="tile-body">
                  <HourglassOutlined className="tile-icon" />
                  <div className="tile-value">
                    {excessTimeData.filter((r) => r.status === "Pending").length}
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={10}>
              <CompanyNote role="SUPER_ADMIN" />
            </Col>
          </Row>

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
                      fetchAttendanceAnalytics(d, rangeMode);
                    }}
                  />
                </div>
                <div className="chart-area">
                  <Spin spinning={attendanceLoading} style={{ width: "100%", height: "100%" }}>
                    <div className="chart-fill">
                      {chartOption && <Chart option={chartOption} />}
                    </div>
                  </Spin>
                </div>
              </div>
            </Col>

            <Col xs={24} lg={8}>
              <div className="card calendar-card">
                <SharedCalendar events={calendarEvents} />
                <CalendarLegendDisplay />
              </div>
            </Col>
          </Row>

          <ExcessTimeModal
            visible={isExcessTimeModalOpen}
            onClose={() => setIsExcessTimeModalOpen(false)}
            data={excessTimeData}
            loading={excessTimeLoading}
            navigateToAll={() => navigate("/super-admin/requests/")}
            onRowClick={(row) => {
              setIsExcessTimeModalOpen(false);
              setSelectedExcessTime(row);
              setIsExcessTimeDetailModalOpen(true);
            }}
          />

          <ExcessTimeDetailModal
              visible={isExcessTimeDetailModalOpen}
              excessTime={selectedExcessTime}
              onClose={() => setIsExcessTimeDetailModalOpen(false)}
              onApproveAsOvertime={handleApproveAsOvertime}
              onApproveAsOffset={handleApproveAsOffset}
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