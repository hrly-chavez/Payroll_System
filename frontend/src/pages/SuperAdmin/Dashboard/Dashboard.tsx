import React from 'react';
import { Layout, Row, Col, Calendar, Modal, Table, Button } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
import * as echarts from 'echarts';
import dayjs, { Dayjs } from 'dayjs';

import './Dashboard.css';

const { Content } = Layout;

interface HolidayRequest {
  key: number;
  name: string;
  date: string;
  type: string;
  base: string;
}

const Dashboard: React.FC = () => {
  const [chartOption, setChartOption] =
    React.useState<echarts.ComposeOption<echarts.BarSeriesOption>>();
  const [chartHeight, setChartHeight] = React.useState<number>(360);

  //holiday
  type ApiHoliday = {
    date: string; // YYYY-MM-DD
    localName: string;
    name: string;
  };

  type Holiday = {
    name: string;
    country: 'US' | 'PH';
  };

  const [holidays, setHolidays] = React.useState<Record<string, Holiday[]>>({});

  const fetchHolidays = async () => {
    const year = dayjs().year();

    try {
      const [usRes, phRes] = await Promise.all([
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`),
        fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`)
      ]);

      const usHolidays: ApiHoliday[] = await usRes.json();
      const phHolidays: ApiHoliday[] = await phRes.json();

      const holidayMap: Record<string, Holiday[]> = {};

      usHolidays.forEach(h => {
        holidayMap[h.date] = [
          ...(holidayMap[h.date] || []),
          { name: h.localName, country: 'US' }
        ];
      });

      phHolidays.forEach(h => {
        holidayMap[h.date] = [
          ...(holidayMap[h.date] || []),
          { name: h.localName, country: 'PH' }
        ];
      });

      setHolidays(holidayMap);
    } catch (error) {
      console.error('Failed to load holidays', error);
    }
  };

  React.useEffect(() => {
    fetchHolidays();
  }, []);

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dateKey = value.format('YYYY-MM-DD');
    const dayHolidays = holidays[dateKey];

    if (!dayHolidays) return null;

    return (
      <div>
        {dayHolidays.map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: 10,
              color: h.country === 'US' ? '#910002' : '#389100',
              lineHeight: '12px'
            }}
          >
            {h.country === 'US' ? '🎌' : 'PH'} {h.name}
          </div>
        ))}
      </div>
    );
  };



  const [isHolidayModalOpen, setIsHolidayModalOpen] = React.useState(false);
  const [isHolidayDetailModalOpen, setIsHolidayDetailModalOpen] =
    React.useState(false);

  const [isDeclineModalOpen, setIsDeclineModalOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState('');

  const [selectedHoliday, setSelectedHoliday] =
    React.useState<HolidayRequest | null>(null);

  const baseData = [60, 12, 5, 8, 15];

  /* ------------------ Chart logic ------------------ */
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
          data: baseData,
          barWidth: s.barWidth,
          itemStyle: { color: '#6c8ea3' },
        },
      ],
    });
  };

  React.useEffect(() => {
    updateChart(window.innerWidth);
    window.addEventListener('resize', () => updateChart(window.innerWidth));
  }, []);

  /* ------------------ Holiday data ------------------ */
  const holidayColumns = [
    { title: 'Holiday Name', dataIndex: 'name' },
    { title: 'Holiday Date', dataIndex: 'date' },
    { title: 'Holiday Type', dataIndex: 'type' },
    { title: 'Holiday Base', dataIndex: 'base' },
  ];

  const holidayData: HolidayRequest[] = [
    {
      key: 1,
      name: 'ABC Holiday',
      date: 'November 18, 2026',
      type: 'Regular Holiday',
      base: 'US Base',
    },
    {
      key: 2,
      name: 'XYZ Holiday',
      date: 'December 25, 2026',
      type: 'Special Holiday',
      base: 'US Base',
    },
  ];

  /* ------------------ Actions ------------------ */
  const handleRowClick = (record: HolidayRequest) => {
    setSelectedHoliday(record);
    setIsHolidayDetailModalOpen(true);
  };

  const handleApprove = () => {
    console.log('Approved:', selectedHoliday);
    setIsHolidayDetailModalOpen(false);
  };

  const handleDecline = () => {
    setIsDeclineModalOpen(true);
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
                {chartOption && (
                  <Chart option={chartOption} style={{ height: chartHeight }} />
                )}
              </div>
            </Col>

              <Col xs={24} lg={8}>
                <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
                  <h3 style={{ textAlign: 'center', marginBottom: 12 }}>January 2023</h3>
                  <Calendar fullscreen={false} dateCellRender={dateCellRender}/>
                </div>

              <Row gutter={[16, 16]} className="stats-row">
                <Col span={12}>
                  <div
                    className="stat-card clickable"
                    onClick={() => setIsHolidayModalOpen(true)}
                  >
                    <div className="stat-label">Holiday Request(s)</div>
                    <div className="stat-value danger">12</div>
                  </div>
                </Col>

                <Col span={12}>
                  <div className="stat-card">
                    <div className="stat-label">Pending Payroll</div>
                    <div className="stat-value danger">12</div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* Holiday List Modal */}
          <Modal
            title="Holiday Request(s)"
            open={isHolidayModalOpen}
            onCancel={() => setIsHolidayModalOpen(false)}
            footer={null}
            width={800}
          >
            <Table
              columns={holidayColumns}
              dataSource={holidayData}
              pagination={false}
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                style: { cursor: 'pointer' },
              })}
            />
          </Modal>

          {/* Holiday Detail Modal */}
          <Modal
            title={<span style={{ fontWeight: 700 }}>HOLIDAY REQUEST(S)</span>}
            open={isHolidayDetailModalOpen}
            onCancel={() => setIsHolidayDetailModalOpen(false)}
            footer={
              <div className="holiday-modal-footer">
                <Button onClick={handleDecline}>Decline</Button>
                <Button type="primary" onClick={handleApprove}>
                  Approve
                </Button>
              </div>
            }
            width={520}
          >
            {selectedHoliday && (
              <div className="holiday-detail">
                <div className="holiday-field">
                  <label>Holiday Name</label>
                  <input value={selectedHoliday.name.toUpperCase()} disabled />
                </div>

                <div className="holiday-field">
                  <label>Holiday Date</label>
                  <input value={selectedHoliday.date.toUpperCase()} disabled />
                </div>

                <div className="holiday-field">
                  <label>Holiday Type</label>
                  <input value={selectedHoliday.type.toUpperCase()} disabled />
                </div>

                <div className="holiday-field">
                  <label>Holiday Base</label>
                  <input value={selectedHoliday.base.toUpperCase()} disabled />
                </div>
              </div>
            )}
          </Modal>

          {/* Decline Reason Modal */}
          <Modal
            title={<span style={{ fontWeight: 700 }}>Reason for Declining</span>}
            open={isDeclineModalOpen}
            centered
            onCancel={() => setIsDeclineModalOpen(false)}
            footer={null}
            width={520}
          >
            <div className="holiday-detail">
              <div className="holiday-field">
                <textarea
                  className="decline-textarea"
                  placeholder="Enter reason for declining"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
              </div>

              <div className="holiday-modal-footer">
                <Button
                  type="primary"
                  onClick={() => {
                    console.log('Declined:', selectedHoliday, declineReason);
                    setIsDeclineModalOpen(false);
                    setIsHolidayDetailModalOpen(false);
                    setDeclineReason('');
                  }}
                >
                  Save
                </Button>

                <Button onClick={() => setIsDeclineModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>

        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
