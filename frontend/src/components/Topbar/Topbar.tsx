import React from 'react';
import { Layout, Typography, Avatar, Badge, Button, Dropdown, MenuProps } from 'antd';
import { BellFilled, ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

const { Header } = Layout;
const { Text } = Typography;

interface TopbarProps {
  title?: string;
  showBack?: boolean;
  onLogout?: () => void; // optional callback for additional logout logic
}

const Topbar: React.FC<TopbarProps> = ({ title = 'Dashboard', showBack, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    if (onLogout) onLogout();

    navigate('/', { replace: true });
  };

  // ✅ Ant Design v5 style menu items
  const items: MenuProps['items'] = [
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
        <Badge dot>
          <BellFilled className="topbar-icon" />
        </Badge>

        {/* ✅ v5 style Dropdown */}
        <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
          <Avatar className="topbar-avatar" style={{ cursor: 'pointer' }}>U</Avatar>
        </Dropdown>
      </div>
    </Header>
  );
};

export default Topbar;
