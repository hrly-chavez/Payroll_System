import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';

const Reports: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div>
            This is the Admin Reports Page
        </div>
    </Layout>
  );
};

export default Reports;
