import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';

const Attendance: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div>
            This is the Attendance Page
        </div>
    </Layout>
  );
};

export default Attendance;
