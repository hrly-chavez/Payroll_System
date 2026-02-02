import React from 'react';
import { Layout, Row, Col, Calendar } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
import * as echarts from 'echarts';
import dayjs, { Dayjs } from 'dayjs';

const { Content } = Layout;

const Dashboard: React.FC = () => {
  const [chartOption, setChartOption] = React.useState<echarts.ComposeOption<echarts.BarSeriesOption>>();
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




  const baseData = [60, 12, 5, 8, 15];

  const computeSettings = (width: number) => {
    if (width >= 1400) return { barWidth: 72, fontSize: 13, gridTop: 56, height: 400 };
    if (width >= 1200) return { barWidth: 56, fontSize: 12, gridTop: 52, height: 360 };
    if (width >= 992) return { barWidth: 44, fontSize: 11, gridTop: 48, height: 320 };
    if (width >= 768) return { barWidth: 36, fontSize: 11, gridTop: 44, height: 280 };
    return { barWidth: '40%', fontSize: 10, gridTop: 40, height: 220 };
  };

  const updateChart = (width: number) => {
    const s = computeSettings(width);
    setChartHeight(s.height);

    setChartOption({
      tooltip: {},
      grid: { left: '6%', right: '6%', top: s.gridTop, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['PRESENT', 'ABSENT', 'LATE', 'OVERTIME', 'UNDERTIME'],
        axisTick: { alignWithLabel: true },
        axisLabel: { interval: 0, color: '#666', fontSize: s.fontSize },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        axisLabel: { color: '#666', fontSize: s.fontSize },
      },
      series: [
        {
          type: 'bar',
          data: baseData,
          barWidth: s.barWidth,
          itemStyle: { color: '#6c8ea3', borderRadius: [6, 6, 0, 0] },
        },
      ],
    });
  };

  React.useEffect(() => {
    // run once
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    updateChart(initialWidth);

    // debounced resize handler
    let t: number | undefined;
    const onResize = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => updateChart(window.innerWidth), 120);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (t) window.clearTimeout(t);
    };
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <Topbar title="Dashboard" />
          <Content style={{ margin: '16px' }}>
            <Greeting />

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
                  <h2 style={{ textAlign: 'center' }}>ANALYTICS</h2>
                  {chartOption && (
                    <Chart
                      option={chartOption}
                      style={{ height: chartHeight, marginTop: 24 }}
                    />
                  )}
                </div>
              </Col>

              <Col xs={24} lg={8}>
                <div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>
                  <h3 style={{ textAlign: 'center', marginBottom: 12 }}>January 2023</h3>
                  <Calendar fullscreen={false} dateCellRender={dateCellRender}/>
                </div>

                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <div style={{ padding: 16, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>Holiday Request(s)</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>12</div>
                    </div>
                  </Col>

                  <Col span={12}>
                    <div style={{ padding: 16, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>Pending Payroll</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>12</div>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Content>
        </Layout>
    </Layout>
  );
};

export default Dashboard;
