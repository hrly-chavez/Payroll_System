import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';
import Topbar from '../../../components/Topbar/Topbar';
const { Content } = Layout;

const SystemConfiguration: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <Topbar title="System Configuration" />
          <Content style={{ margin: '16px' }}>
            <div style={{ padding: 24, background: '#fff' }}>
              This is the Super Admin System Configuration Page
            </div>
          </Content>
        </Layout>
    </Layout>
  );
};

export default SystemConfiguration; 
