import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';

const SystemConfiguration: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div>
            This is the Super Admin System Configuration Page
        </div>
    </Layout>
  );
};

export default SystemConfiguration;
