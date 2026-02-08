import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Calendar, Spin, message, DatePicker, Segmented } from "antd";
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';

import * as echarts from 'echarts';
import dayjs from 'dayjs';
import type { Dayjs } from "dayjs";
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import './Dashboard.css';


import HolidayModal from './HolidayModal';
import HolidayDetailModal from './HolidayDetailModal';
import DeclineReasonModal from './DeclineReasonModal';
import PendingPayrollModal from './PendingPayrollModal';

const { Content } = Layout;

interface HolidayRequest {
  id: number;
  name: string;
  date: string;
  type: string;
  base: string;
  status: 'Pending' | 'Approved' | 'Declined';
}

interface Payroll {
  id: number;
  employee_name: string;
  period: string;
  total_amount: number;
  status: string;
}

interface AttendanceRecord {
  id: number;
  employee: number;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'OVERTIME' | 'UNDERTIME';
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'OVERTIME' | 'UNDERTIME';
type RangeMode = "Day" | "Week" | "Month" | "Year";


const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  /* ------------------ Chart state ------------------ */
  const [chartOption, setChartOption] =
    useState<echarts.ComposeOption<echarts.BarSeriesOption>>();
  const [chartHeight, setChartHeight] = useState<number>(360);

  /* ------------------ Holiday state ------------------ */
  const [holidayData, setHolidayData] = useState<HolidayRequest[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);

  /* ------------------ Payroll state ------------------ */
  const [pendingPayrolls, setPendingPayrolls] = useState<Payroll[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  /* ------------------ Attendance state ------------------ */
  const [attendanceData, setAttendanceData] = useState<Record<AttendanceStatus, number>>({
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    OVERTIME: 0,
    UNDERTIME: 0,
  });
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs()); // default today
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("Day");

  /* ------------------ Modal state ------------------ */
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isHolidayDetailModalOpen, setIsHolidayDetailModalOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayRequest | null>(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  /* ------------------ API Fetches ------------------ */
  const fetchHolidayRequests = async () => {
    setHolidayLoading(true);
    try {
      const res = await api.get<HolidayRequest[]>('/approvals/superadmin/holidays/');
      setHolidayData(res.data);
    } catch (error) {
      console.error('Failed to fetch holidays', error);
    } finally {
      setHolidayLoading(false);
    }
  };

  const fetchPendingPayrolls = async () => {
    setPayrollLoading(true);
    try {
      const res = await api.get<Payroll[]>('/superadmin/pending-payrolls/');
      setPendingPayrolls(res.data);
    } catch (error) {
      console.error('Failed to fetch pending payrolls', error);
    } finally {
      setPayrollLoading(false);
    }
  };

    const countFromRows = (list: any[]) => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let overtime = 0;
    let undertime = 0;

    list.forEach((r: any) => {
      if (r.status === "PRESENT") present++;
      if (r.status === "ABSENT") absent++;

      const types = (r.event_types || "")
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean);

      if (types.includes("Late")) late++;
      if (types.includes("OverTime")) overtime++;
      if (types.includes("UnderTime")) undertime++;
    });

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

    // Year (handled elsewhere)
    return rows;
  };

  const fetchAttendanceAnalytics = async (d?: Dayjs, mode?: RangeMode) => {
    setAttendanceLoading(true);
    try {
      const anchor = d ?? selectedDate;
      const m = (mode ?? rangeMode);

      if (m === "Year") {
        const y = anchor.year();

        // fetch all 12 months then aggregate
        const all: any[] = [];
        for (let mm = 1; mm <= 12; mm++) {
          const rows = await fetchMonthRows(y, mm);
          all.push(...rows);
        }

        setAttendanceData(countFromRows(all));
        return;
      }

      // Day / Week / Month
      const y = anchor.year();
      const month = anchor.month() + 1;

      const monthRows = await fetchMonthRows(y, month);
      const filtered = filterRowsByRange(monthRows, m, anchor);

      setAttendanceData(countFromRows(filtered));
    } catch (err) {
      console.error(err);
      message.error("Failed to load attendance analytics");
    } finally {
      setAttendanceLoading(false);
    }
  };



  useEffect(() => {
    fetchHolidayRequests();
    fetchPendingPayrolls();
    fetchAttendanceAnalytics(selectedDate, rangeMode);
  }, []);


  /* ------------------ Chart ------------------ */
  const computeSettings = (width: number) => {
    if (width >= 1400) return { barWidth: 72, height: 400 };
    if (width >= 1200) return { barWidth: 56, height: 360 };
    if (width >= 992) return { barWidth: 44, height: 320 };
    if (width >= 768) return { barWidth: 36, height: 280 };
    return { barWidth: '40%', height: 220 };
  };

  const updateChart = (width: number) => {
    const s = computeSettings(width);
    setChartHeight(s.height);

    setChartOption({
      xAxis: { type: 'category', data: ['PRESENT', 'ABSENT', 'LATE', 'OVERTIME', 'UNDERTIME'] },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: [
            attendanceData.PRESENT,
            attendanceData.ABSENT,
            attendanceData.LATE,
            attendanceData.OVERTIME,
            attendanceData.UNDERTIME,
          ],
          barWidth: s.barWidth,
          itemStyle: { color: '#6c8ea3' },
          label: { show: true, position: 'top' },
        },
      ],
    });
  };

  useEffect(() => {
    updateChart(window.innerWidth);
    const handleResize = () => updateChart(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [attendanceData]);

  /* ------------------ Holiday Status Update ------------------ */
  const updateHolidayStatus = async (status: 'Approved' | 'Declined') => {
    if (!selectedHoliday) return;
    try {
      await api.post(`/approvals/superadmin/holidays/${selectedHoliday.id}/status/`, {
        status,
        reason: status === 'Declined' ? declineReason : null,
      });
      setHolidayData(prev =>
        prev.map(h => (h.id === selectedHoliday.id ? { ...h, status } : h))
      );
      message.success(`Holiday request ${status}`);
      setIsHolidayDetailModalOpen(false);
      setIsDeclineModalOpen(false);
      setDeclineReason('');
      setSelectedHoliday(null);
    } catch (error) {
      console.error('Failed to update status', error);
      message.error('Failed to update status');
    }
  };

  const handleApprove = async () => updateHolidayStatus('Approved');
  const handleDecline = async () => updateHolidayStatus('Declined');

  return (
    <Layout className="dashboard-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />
        <Content className="dashboard-content">
          

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <div className="card analytics-card">

                {/* DATE FILTER FOR BAR GRAPH */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
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
                  picker={rangeMode === "Month" ? "month" : rangeMode === "Year" ? "year" : "date"}
                  value={selectedDate}
                  onChange={(d: Dayjs | null) => {
                    if (!d) return;
                    setSelectedDate(d);
                    fetchAttendanceAnalytics(d);
                  }}
                />
              </div>


                {/* BAR GRAPH */}
                <Spin spinning={attendanceLoading}>
                  {chartOption && (
                    <Chart option={chartOption} style={{ height: chartHeight }} />
                  )}
                </Spin>

              </div>
            </Col>


            <Col xs={24} lg={8}>
              <div
                style={{
                  padding: 24,
                  background: '#fff',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <h3 style={{ textAlign: 'center', marginBottom: 12 }}>Calendar</h3>
                <Calendar fullscreen={false} />
              </div>

              <Row gutter={[16, 16]} className="stats-row">
                <Col span={12}>
                  <div
                    className="stat-card clickable"
                    onClick={() => {
                      const pendingHolidays = holidayData.filter(h => h.status === 'Pending');
                      if (pendingHolidays.length === 1) {
                        setSelectedHoliday(pendingHolidays[0]);
                        setIsHolidayDetailModalOpen(true);
                      } else {
                        setIsHolidayModalOpen(true);
                      }
                    }}
                  >
                    <div className="stat-label">Holiday Request(s)</div>
                    <div className="stat-value danger">
                      {holidayLoading ? <Spin size="small" /> : holidayData.filter(h => h.status === 'Pending').length}
                    </div>
                  </div>
                </Col>

                <Col span={12}>
                  <div className="stat-card clickable" onClick={() => setIsPayrollModalOpen(true)}>
                    <div className="stat-label">Pending Payroll</div>
                    <div className="stat-value danger">
                      {payrollLoading ? <Spin size="small" /> : pendingPayrolls.length}
                    </div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* ---------------- Modals ---------------- */}
          <HolidayModal
            visible={isHolidayModalOpen}
            onClose={() => setIsHolidayModalOpen(false)}
            onRowClick={record => {
              setSelectedHoliday(record);
              setIsHolidayDetailModalOpen(true);
              setIsHolidayModalOpen(false);
            }}
            data={holidayData}
            loading={holidayLoading}
            navigateToAll={() => navigate('/super-admin/requests')}
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
            navigateToAll={() => navigate('/super-admin/requests')}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
