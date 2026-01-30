// ...existing code...
import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import logo from '../../components/attitechlogo.png';
import './Sidebar.css';

type UserRole = 'ADMIN' | 'SUPER_ADMIN' | 'EMPLOYEE';

interface SidebarProps {
  role?: UserRole;
}

const { Sider } = Layout;

const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  // fallback: try to read role from localStorage, otherwise default to EMPLOYEE
  const currentRole: UserRole =
    (role ?? (localStorage.getItem('role') as UserRole) ?? 'SUPER_ADMIN') as UserRole;

  // menu configuration with allowed roles
  const menuConfig: {
    key: string;
    label: string;
    icon: React.ReactNode;
    href: string;
    roles: UserRole[];
  }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <HomeOutlined />, href: '/employee_dashboard', roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] },
    { key: 'calendar', label: 'Calendar', icon: <CalendarOutlined />, href: '/employee/calendar', roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] },
    { key: 'attendance', label: 'Attendance', icon: <ClockCircleOutlined />, href: '/employee/attendance', roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] },
    { key: 'system', label: 'System Configuration', icon: <SettingOutlined />, href: '/employee/system', roles: ['SUPER_ADMIN'] }, // only SUPER_ADMIN
    { key: 'reports', label: 'Reports', icon: <BarChartOutlined />, href: '/employee/reports', roles: ['ADMIN', 'SUPER_ADMIN'] }, // admin+super
    { key: 'department', label: 'Department', icon: <TeamOutlined />, href: '/employee/department', roles: ['ADMIN', 'SUPER_ADMIN'] }, // admin+super
  ];

  const visibleItems = menuConfig.filter((m) => m.roles.includes(currentRole));

  return (
    <Sider className="custom-sider" width={250} theme="dark">
      <div className="logo-container">
        <img src={logo} alt="AttiTech" />
      </div>

      <Menu
        theme="dark"
        mode="inline"
        defaultSelectedKeys={['dashboard']}
        style={{ background: 'transparent', borderRight: 'none', paddingTop: 4 }}
        className="custom-menu"
      >
        {visibleItems.map((item) => (
          <Menu.Item key={item.key} icon={item.icon}>
            <a href={item.href}>{item.label}</a>
          </Menu.Item>
        ))}
      </Menu>
    </Sider>
  );
};

export default Sidebar;
// ...existing code...