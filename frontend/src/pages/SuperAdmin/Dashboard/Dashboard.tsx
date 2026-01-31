import React from 'react';
import { Layout, Row, Col, Calendar, Modal, Table, Button } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
import * as echarts from 'echarts';
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

  const [isHolidayModalOpen, setIsHolidayModalOpen] = React.useState(false);
  const [isHolidayDetailModalOpen, setIsHolidayDetailModalOpen] =
    React.useState(false);
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
    console.log('Declined:', selectedHoliday);
    setIsHolidayDetailModalOpen(false);
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
              <div className="card calendar-card">
                <Calendar fullscreen={false} />
              </div>

              <Row gutter={[16, 16]} className="stats-row">
                {/* Holiday Requests */}
                <Col span={12}>
                  <div
                    className="stat-card clickable"
                    onClick={() => setIsHolidayModalOpen(true)}
                  >
                    <div className="stat-label">Holiday Request(s)</div>
                    <div className="stat-value danger">12</div>
                  </div>
                </Col>

                {/* Payroll Requests (UNCHANGED) */}
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
            title="Holiday Request"
            open={isHolidayDetailModalOpen}
            onCancel={() => setIsHolidayDetailModalOpen(false)}
            footer={[
              <Button key="decline" onClick={handleDecline}>
                Decline
              </Button>,
              <Button key="approve" type="primary" onClick={handleApprove}>
                Approve
              </Button>,
            ]}
            width={500}
          >
            {selectedHoliday && (
              <>
                <p><strong>Holiday Name</strong><br />{selectedHoliday.name}</p>
                <p><strong>Holiday Date</strong><br />{selectedHoliday.date}</p>
                <p><strong>Holiday Type</strong><br />{selectedHoliday.type}</p>
                <p><strong>Holiday Base</strong><br />{selectedHoliday.base}</p>
              </>
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
