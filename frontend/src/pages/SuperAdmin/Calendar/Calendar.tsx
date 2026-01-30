import React from 'react';
import Sidebar from '../../../components/Sidebar/Sidebar';
import { Layout } from 'antd';

const Calendar: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div>
            This is the Super Admin Calendar Page
        </div>
    </Layout>
  );
};

export default Calendar;
