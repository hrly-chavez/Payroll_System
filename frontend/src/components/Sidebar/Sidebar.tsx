import React, { useEffect, useState} from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  // const currentRole: UserRole =
  //   (role ?? (localStorage.getItem('role') as UserRole) ?? 'EMPLOYEE') as UserRole;

  const [currentRole, setCurrentRole] = useState<UserRole>('EMPLOYEE');

  useEffect(() => {
    if (role) {
      setCurrentRole(role);
    } else {
      const storedRole = localStorage.getItem('role') as UserRole | null;
      if (storedRole) {
        setCurrentRole(storedRole);
      }
    }
  }, [role]);

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

  const visibleItems = menuConfig.filter(item =>
    item.roles.includes(currentRole)
  );

  const selectedKey =
    menuConfig.find(item =>
      Object.values(item.hrefs).includes(location.pathname)
    )?.key ?? 'dashboard';

  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' && window.innerWidth < 768);
  const [collapsed, setCollapsed] = useState<boolean>(isMobile);

  React.useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showOverlay = isMobile && !collapsed;

  React.useEffect(() => {
    const body = document.body;
    // only add a class when the mobile sidebar is opened (overlay)
    body.classList.remove('sidebar-open-mobile');

    if (isMobile && !collapsed) {
      body.classList.add('sidebar-open-mobile');
    }

    return () => {
      body.classList.remove('sidebar-open-mobile');
    };
  }, [collapsed, isMobile]);

  return (
    <>
      {showOverlay && (
        <div
          className="sider-overlay"
          onClick={() => setCollapsed(true)}
          aria-hidden
        />
      )}

      <Sider
        className={`custom-sider ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}
        width={250}
        theme="dark"
        collapsible
        collapsedWidth={isMobile ? 0 : 80}
        breakpoint="md"
        collapsed={collapsed}
        onCollapse={value => setCollapsed(value)}
        onBreakpoint={broken => {
          setIsMobile(broken);
          if (broken) setCollapsed(true);
        }}
      >
        <div className="logo-container">
          <img src={logo} alt="AttiTech" />
        </div>


        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          className="custom-menu"
          inlineCollapsed={collapsed}
          style={{ background: 'transparent', borderRight: 'none', paddingTop: 4 }}
        >
          {visibleItems.map(item => {
            const href = item.hrefs[currentRole];
            if (!href) return null;

            return (
              <Menu.Item key={item.key} icon={item.icon}>
                <Link to={href}>{item.label}</Link>
              </Menu.Item>
            );
          })}
        </Menu>
      </Sider>
    </>
  );
};

export default Sidebar;
