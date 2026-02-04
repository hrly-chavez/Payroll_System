import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Calendar, Modal, Table, Button, Spin } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Chart state
  const [chartOption, setChartOption] = useState<echarts.ComposeOption<echarts.BarSeriesOption>>();
  const [chartHeight, setChartHeight] = useState<number>(360);

  // Holiday state
  const [holidayData, setHolidayData] = useState<HolidayRequest[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(false);

  // Payroll state
  const [pendingPayrolls, setPendingPayrolls] = useState<Payroll[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Modal state
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isHolidayDetailModalOpen, setIsHolidayDetailModalOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayRequest | null>(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  /* ------------------ Fetch Holiday Requests ------------------ */
  const fetchHolidayRequests = async () => {
    setHolidayLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/approvals/superadmin/holidays/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch holidays');
      const holidays: HolidayRequest[] = await res.json();
      setHolidayData(holidays);
    } catch (error) {
      console.error(error);
    } finally {
      setHolidayLoading(false);
    }
  };

  /* ------------------ Pending Payroll API ------------------ */
  const fetchPendingPayrolls = async () => {
    setPayrollLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/superadmin/pending-payrolls/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch pending payrolls');
      const data: Payroll[] = await res.json();
      setPendingPayrolls(data);
    } catch (error) {
      console.error(error);
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidayRequests();
    fetchPendingPayrolls();
  }, []);

  /* ------------------ Chart ------------------ */
  const baseData = [60, 12, 5, 8, 15];
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
      series: [{ type: 'bar', data: baseData, barWidth: s.barWidth, itemStyle: { color: '#6c8ea3' } }],
    });
  };
  useEffect(() => {
    updateChart(window.innerWidth);
    window.addEventListener('resize', () => updateChart(window.innerWidth));
  }, []);

  /* ------------------ Holiday Table ------------------ */
  const holidayColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Base',
      dataIndex: 'base',
      key: 'base',
    },
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

  const handleRowClick = (record: HolidayRequest) => {
    setSelectedHoliday(record);
    setIsHolidayDetailModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedHoliday) return;
    try {
      const res = await fetch(
        `http://localhost:8000/api/superadmin/holidays/${selectedHoliday.id}/status/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ status: 'Approved' }),
        }
      );
      if (!res.ok) throw new Error('Failed to approve');
      fetchHolidayRequests();
      setIsHolidayDetailModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDecline = async () => {
    if (!selectedHoliday) return;
    try {
      const res = await fetch(
        `http://localhost:8000/api/superadmin/holidays/${selectedHoliday.id}/status/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ status: 'Declined' }),
        }
      );
      if (!res.ok) throw new Error('Failed to decline');
      fetchHolidayRequests();
      setIsDeclineModalOpen(false);
      setIsHolidayDetailModalOpen(false);
      setDeclineReason('');
    } catch (error) {
      console.error(error);
    }
  };

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
                  const pendingHolidays = holidayData.filter((h) => h.status === 'Pending');
                  if (pendingHolidays.length === 1) {
                    // Directly open detail modal
                    setSelectedHoliday(pendingHolidays[0]);
                    setIsHolidayDetailModalOpen(true);
                  } else {
                    // Open table modal
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
              <Button
                key="see-all"
                type="link"
                onClick={() => navigate('/super-admin/requests')}
              >
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
            onRow={(record) => ({
              onClick: () => {
                setSelectedHoliday(record);
                setIsHolidayDetailModalOpen(true);
                setIsHolidayModalOpen(false); // close table modal
              },
              style: { cursor: 'pointer' },
            })}
          />

          </Modal>

          {/* Holiday Detail Modal */}
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
            getContainer={false} // important for modal inside another modal
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
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{ width: '100%', minHeight: 100 }}
            />
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
