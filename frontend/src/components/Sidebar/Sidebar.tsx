import React, { useEffect, useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
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
  const [currentRole, setCurrentRole] = useState<UserRole>('SUPER_ADMIN');
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [collapsed, setCollapsed] = useState<boolean>(isMobile);

  // Touch positions for swipe
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Set current role
  useEffect(() => {
    if (role) {
      setCurrentRole(role);
    } else {
      const storedRole = localStorage.getItem('role') as UserRole | null;
      if (storedRole) setCurrentRole(storedRole);
    }
  }, [role]);

  // Handle window resize
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Swipe handlers for mobile (only from left edge)
  const handleTouchStart = (e: TouchEvent) => {
    const x = e.touches[0].clientX;
    if (x < 30) setTouchStartX(x); // only detect touches from very left edge
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchStartX !== null) {
      setTouchEndX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null) {
      const distance = touchEndX - touchStartX;
      if (distance > 50) setCollapsed(false); // open sidebar
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  useEffect(() => {
    if (!isMobile) return;
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStartX, touchEndX, isMobile]);

  // Menu configuration
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
      label: 'Payroll Management',
      icon: <CalendarOutlined />,
      roles: ['ADMIN', 'SUPER_ADMIN'],
      hrefs: {
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
      roles: ['ADMIN'],
      hrefs: {
        ADMIN: '/admin/reports',
      },
    },
    {
      key: 'reports',
      label: 'Logs',
      icon: <BarChartOutlined />,
      roles: ['SUPER_ADMIN'],
      hrefs: {
        SUPER_ADMIN: '/super-admin/reports',
      },
    },
    {
      key: 'Requests',
      label: 'Requests',
      icon: <FileTextOutlined />,
      roles: ['ADMIN', 'SUPER_ADMIN'],
      hrefs: {
        EMPLOYEE: '/employee/requests',
        ADMIN: '/admin/requests',
        SUPER_ADMIN: '/super-admin/requests',
      },
    },
    {
      key: 'Payslip',
      label: 'Payslip',
      icon: <DollarOutlined />,
      roles: ['EMPLOYEE'],
      hrefs: {
        EMPLOYEE: '/employee/payslips',
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

  const showOverlay = isMobile && !collapsed;

  // Add/remove body class for mobile overlay
  useEffect(() => {
    const body = document.body;
    body.classList.remove('sidebar-open-mobile');
    if (isMobile && !collapsed) body.classList.add('sidebar-open-mobile');
    return () => body.classList.remove('sidebar-open-mobile');
  }, [collapsed, isMobile]);

  // Auto-collapse / expand on hover (desktop only)
  const handleMouseEnter = () => {
    if (!isMobile) setCollapsed(false);
  };
  const handleMouseLeave = () => {
    if (!isMobile) setCollapsed(true);
  };

  return (
    <>
      {/* Mobile overlay */}
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        trigger={null}
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
              <Menu.Item key={item.key} icon={item.icon} onClick={() => isMobile && setCollapsed(true)}>
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
