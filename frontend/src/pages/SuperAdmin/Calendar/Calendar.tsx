import React from 'react';
import { Layout } from 'antd';
import CalendarPage from 'pages/HR/Calendar/Calendar';
const { Content } = Layout;


const Calendar: React.FC = () => {
  return (
        <CalendarPage showRequests={false} />
  );
};

export default Calendar; 
