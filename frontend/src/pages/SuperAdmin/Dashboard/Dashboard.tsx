import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';

const Dashboard: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div>
            This is the Admin Dashboard Page
        </div>
    </Layout>
  );
};

export default Dashboard;
