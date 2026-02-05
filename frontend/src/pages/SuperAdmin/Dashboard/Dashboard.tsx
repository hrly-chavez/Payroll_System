import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Calendar, Modal, Table, Button, Spin, message } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios'; // <-- import your axios instance
import './Dashboard.css';

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

// ✅ Define attendance status type
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

  /* ------------------ Fetch Holiday Requests ------------------ */
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

  /* ------------------ Pending Payroll API ------------------ */
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

  /* ------------------ Fetch Attendance Records ------------------ */
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
        if (item.status in counts) {
          counts[item.status as AttendanceStatus]++;
        }
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
      xAxis: {
        type: 'category',
        data: ['PRESENT', 'ABSENT', 'LATE', 'OVERTIME', 'UNDERTIME'],
      },
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
          label: {
            show: true,
            position: 'top',
          },
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

  /* ------------------ SAME STATUS UPDATE AS Request.tsx ------------------ */
  const updateHolidayStatus = async (status: 'Approved' | 'Declined') => {
    if (!selectedHoliday) return;

    try {
      await api.post(
        `/approvals/superadmin/holidays/${selectedHoliday.id}/status/`,
        {
          status,
          reason: status === 'Declined' ? declineReason : null,
        }
      );

      setHolidayData(prev =>
        prev.map(h =>
          h.id === selectedHoliday.id ? { ...h, status } : h
        )
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

  /* ------------------ Holiday Table ------------------ */
  const holidayColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Base', dataIndex: 'base', key: 'base' },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: HolidayRequest) => (
        <Button
          disabled
          style={{
            backgroundColor:
              record.status === 'Approved'
                ? '#d4edda'
                : record.status === 'Declined'
                ? '#f8d7da'
                : '#fff',
            color:
              record.status === 'Approved'
                ? '#155724'
                : record.status === 'Declined'
                ? '#721c24'
                : '#000',
            cursor: 'default',
          }}
        >
          {record.status}
        </Button>
      ),
    },
  ];

  return (
    <Layout className="dashboard-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Dashboard" />
        <Content className="dashboard-content">
          <Greeting />
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <div className="card analytics-card">
                {chartOption && (
                  <Chart option={chartOption} style={{ height: chartHeight }} />
                )}
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
                <h3 style={{ textAlign: 'center', marginBottom: 12 }}>
                  Calendar
                </h3>
                <Calendar fullscreen={false} />
              </div>

              <Row gutter={[16, 16]} className="stats-row">
                <Col span={12}>
                  <div
                    className="stat-card clickable"
                    onClick={() => {
                      const pendingHolidays = holidayData.filter(
                        h => h.status === 'Pending'
                      );
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
                      {holidayLoading ? (
                        <Spin size="small" />
                      ) : (
                        holidayData.filter(h => h.status === 'Pending').length
                      )}
                    </div>
                  </div>
                </Col>

                <Col span={12}>
                  <div
                    className="stat-card clickable"
                    onClick={() => navigate('/super-admin/requests')}
                  >
                    <div className="stat-label">Pending Payroll</div>
                    <div className="stat-value danger">
                      {payrollLoading ? <Spin size="small" /> : pendingPayrolls.length}
                    </div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* ---------------- Holiday Request Modal ---------------- */}
          <Modal
            title="Holiday Request(s)"
            open={isHolidayModalOpen}
            onCancel={() => setIsHolidayModalOpen(false)}
            footer={[
              <Button key="see-all" type="link" onClick={() => navigate('/super-admin/requests')}>
                See All
              </Button>,
              <Button key="close" onClick={() => setIsHolidayModalOpen(false)}>
                Close
              </Button>,
            ]}
            width={800}
          >
            <Table
              columns={holidayColumns}
              dataSource={holidayData.filter(h => h.status === 'Pending')}
              loading={holidayLoading}
              pagination={false}
              rowKey="id"
              onRow={record => ({
                onClick: () => {
                  setSelectedHoliday(record);
                  setIsHolidayDetailModalOpen(true);
                  setIsHolidayModalOpen(false);
                },
                style: { cursor: 'pointer' },
              })}
            />
          </Modal>

          {/* ---------------- Holiday Detail Modal ---------------- */}
          <Modal
            title="Holiday Detail"
            open={isHolidayDetailModalOpen}
            onCancel={() => setIsHolidayDetailModalOpen(false)}
            footer={[
              <Button key="decline" onClick={() => setIsDeclineModalOpen(true)}>
                Decline
              </Button>,
              <Button key="approve" type="primary" onClick={handleApprove}>
                Approve
              </Button>,
            ]}
            width={600}
            getContainer={false}
          >
            {selectedHoliday ? (
              <div className="holiday-detail">
                <div className="holiday-field">
                  <label>Holiday Name</label>
                  <input value={selectedHoliday.name} disabled />
                </div>
                <div className="holiday-field">
                  <label>Date</label>
                  <input value={dayjs(selectedHoliday.date).format('MMM DD, YYYY')} disabled />
                </div>
                <div className="holiday-field">
                  <label>Type</label>
                  <input value={selectedHoliday.type} disabled />
                </div>
                <div className="holiday-field">
                  <label>Base</label>
                  <input value={selectedHoliday.base} disabled />
                </div>
                <div className="holiday-field">
                  <label>Status</label>
                  <input value={selectedHoliday.status} disabled />
                </div>
              </div>
            ) : (
              <Spin tip="Loading..." />
            )}
          </Modal>

          {/* ---------------- Decline Reason Modal ---------------- */}
          <Modal
            title="Reason for Declining"
            open={isDeclineModalOpen}
            onCancel={() => setIsDeclineModalOpen(false)}
            footer={[
              <Button key="save" type="primary" onClick={handleDecline}>
                Save
              </Button>,
              <Button key="cancel" onClick={() => setIsDeclineModalOpen(false)}>
                Cancel
              </Button>,
            ]}
          >
            <textarea
              placeholder="Enter reason for declining"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              style={{ width: '100%', minHeight: 100 }}
            />
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
