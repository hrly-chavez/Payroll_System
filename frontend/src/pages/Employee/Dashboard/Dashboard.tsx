import React from 'react';
import { Layout, Menu } from 'antd';
import Chart from '../../../components/Chart';
import * as echarts from 'echarts';

const { Header, Content, Footer, Sider } = Layout;

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
      <Sider>
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']}>
          <Menu.Item key="1">Dashboard</Menu.Item>
          <Menu.Item key="2">Settings</Menu.Item>
        </Menu>
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>Dashboard Header</Header>

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
