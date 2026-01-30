import React from 'react';
import { Layout } from 'antd';
import Chart from '../../../components/Chart';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import * as echarts from 'echarts';

const { Header, Content, Footer } = Layout;

const Dashboard: React.FC = () => {
  // ✅ ComposeOption type
  const chartOption: echarts.ComposeOption<echarts.BarSeriesOption> = {
    title: { text: 'Weekly Sales' },
    tooltip: {},
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: [120, 200, 150, 80, 70, 110, 130],
        itemStyle: { color: '#1890ff' },
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />

      <Layout>
        <Topbar title="Dashboard" />

        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, background: '#fff' }}>
            <h2>Dashboard Charts</h2>
            <Chart option={chartOption} style={{ height: 400, marginTop: 24 }} />
          </div>
        </Content>

        <Footer style={{ textAlign: 'center' }}>My App ©2026</Footer>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
