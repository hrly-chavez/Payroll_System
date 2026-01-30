import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';
import Topbar from '../../../components/Topbar/Topbar';
import Greeting from '../../../components/Greeting/Greeting';
const { Content } = Layout;

const Dashboard: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <Topbar title="Dashboard" />
          <Content style={{ margin: '16px' }}>
            <Greeting />
            <div style={{ padding: 24, background: '#fff' }}>
              This is the Admin Dashboard Page
            </div>
          </Content>
        </Layout>
    </Layout>
  );
};

export default Dashboard;
