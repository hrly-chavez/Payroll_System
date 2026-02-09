import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Calendar, Spin, message } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import './Dashboard.css';

// ✅ Import the modularized modals
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

  const fetchAttendanceRecords = async () => {
    try {
      const res = await api.get<AttendanceRecord[]>('/employee/attendance/');
      const counts: Record<AttendanceStatus, number> = {
        PRESENT: 0,
        ABSENT: 0,
        LATE: 0,
        OVERTIME: 0,
        UNDERTIME: 0,
      };
      res.data.forEach(item => {
        if (item.status in counts) counts[item.status as AttendanceStatus]++;
      });
      setAttendanceData(counts);
    } catch (error) {
      console.error('Failed to fetch attendance data', error);
    }
  };

  useEffect(() => {
    fetchHolidayRequests();
    fetchPendingPayrolls();
    fetchAttendanceRecords();
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
                {chartOption && <Chart option={chartOption} style={{ height: chartHeight }} />}
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
