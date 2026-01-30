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

interface MenuItemConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  hrefs: Partial<Record<UserRole, string>>;
}

const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  const currentRole: UserRole =
    (role ?? (localStorage.getItem('role') as UserRole) ?? 'SUPER_ADMIN') as UserRole;

  const menuConfig: MenuItemConfig[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: <HomeOutlined />,
      roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        EMPLOYEE: '/employee_dashboard',
        ADMIN: '/admin/dashboard',
        SUPER_ADMIN: '/super-admin/dashboard',
      },
    },
    {
      key: 'department',
      label: 'Department',
      icon: <TeamOutlined />,
      roles: ['ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        ADMIN: '/admin/department',
        SUPER_ADMIN: '/super-admin/department',
      },
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: <CalendarOutlined />,
      roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        EMPLOYEE: '/employee/calendar',
        ADMIN: '/admin/calendar',
        SUPER_ADMIN: '/super-admin/calendar',
      },
    },
    {
      key: 'attendance',
      label: 'Attendance',
      icon: <ClockCircleOutlined />,
      roles: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        EMPLOYEE: '/employee/attendance',
        ADMIN: '/admin/attendance',
        SUPER_ADMIN: '/super-admin/attendance',
      },
    },
    {
      key: 'system',
      label: 'System Configuration',
      icon: <SettingOutlined />,
      roles: ['SUPER_ADMIN'],
      hrefs: {
        SUPER_ADMIN: '/super-admin/system',
      },
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: <BarChartOutlined />,
      roles: ['ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        ADMIN: '/admin/reports',
        SUPER_ADMIN: '/super-admin/reports',
      },
    },
  ];

  const visibleItems = menuConfig.filter((item) =>
    item.roles.includes(currentRole)
  );

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
        {visibleItems.map((item) => {
          const href = item.hrefs[currentRole];

          if (!href) return null;

          return (
            <Menu.Item key={item.key} icon={item.icon}>
              <a href={href}>{item.label}</a>
            </Menu.Item>
          );
        })}
      </Menu>
    </Sider>
  );
};

export default Sidebar;
