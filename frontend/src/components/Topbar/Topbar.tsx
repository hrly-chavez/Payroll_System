import React, { useEffect, useState } from 'react';
import { Layout, Typography, Avatar, Badge, Button, Dropdown } from 'antd';
import { BellFilled, ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

const { Header } = Layout;
const { Text } = Typography;

interface TopbarProps {
  title?: string;
  showBack?: boolean;
  onLogout?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ title = 'Dashboard', showBack, onLogout }) => {
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    if (onLogout) onLogout();
    navigate('/', { replace: true });
  };

  // 🔔 Fetch unread notification count from backend
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/notifications/unread-count/', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        });
        const data = await res.json();
        setNotifCount(data.count);
      } catch {
        console.log('Failed to load notification count');
      }
    };

    fetchNotifCount();
  }, []);

  const items = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

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
        {/* 🔔 Notification Bell → Redirect to page */}
        <Badge count={notifCount} size="small">
          <BellFilled
            className="topbar-icon"
            onClick={() => navigate('/notification')}
          />
        </Badge>

        {/* Avatar Dropdown */}
        <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
          <Avatar className="topbar-avatar" style={{ cursor: 'pointer' }}>U</Avatar>
        </Dropdown>
      </div>
    </Header>
  );
};

export default Topbar;
