import React from 'react';
import { Layout, Typography, Avatar, Badge } from 'antd';
import { BellFilled } from '@ant-design/icons';
import './Topbar.css';

const { Header } = Layout;
const { Text } = Typography;

interface TopbarProps {
  title?: string;
}

const Topbar: React.FC<TopbarProps> = ({ title = 'Dashboard' }) => { // can change here topbar name 
  return (
    <Header className="app-topbar">
      <div className="topbar-left">
        <Text className="topbar-title">
          {title}
        </Text>
      </div>

      <div className="topbar-right">
        <Badge dot>
          <BellFilled className="topbar-icon" />
        </Badge>
        <Avatar className="topbar-avatar">U</Avatar>
      </div>
    </Header>
  );
};

export default Topbar;
