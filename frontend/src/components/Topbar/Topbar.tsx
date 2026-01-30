import React from 'react';
import { Layout, Typography, Avatar, Badge, Button } from 'antd';
import { BellFilled, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

const { Header } = Layout;
const { Text } = Typography;

interface TopbarProps {
  title?: string;
  showBack?: boolean;   // ✅ ADD THIS
}

const Topbar: React.FC<TopbarProps> = ({ title = 'Dashboard', showBack }) => {
  const navigate = useNavigate(); // ✅ REQUIRED FOR BACK BUTTON

  return (
    <Header className="app-topbar">
      <div className="topbar-left">
        {showBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="topbar-back"
            onClick={() => navigate(-1)}
          />
        )}
        <Text className="topbar-title">{title}</Text>
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
