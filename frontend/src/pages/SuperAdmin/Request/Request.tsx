import React, { useEffect, useState } from 'react';
import { Layout, Card, Table, Tag, Spin, message, Dropdown, Button, Select } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import dayjs from 'dayjs';
import './Request.css';

const { Content } = Layout;
const { Option } = Select;

interface RequestItem {
  id: number;
  type: 'Holiday' | 'Leave' | 'Payroll';
  name: string;           // Holiday name, Leave type, Payroll title
  date: string;           // request date
  status: string;
  base?: string;          // optional
  is_active: boolean;
  created_at: string;
}

const Request: React.FC = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Holiday' | 'Leave' | 'Payroll'>('All');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch all requests from different endpoints
      const [holidaysRes ] = await Promise.all([
        fetch('http://localhost:8000/api/approvals/superadmin/holidays/'),

      ]);

      if (!holidaysRes.ok ) {
        throw new Error('Failed to fetch requests');
      }

      const holidays = await holidaysRes.json();


      // Map each request type into unified format
      const allRequests: RequestItem[] = [
        ...holidays.map((h: any) => ({ ...h, type: 'Holiday' })),

      ];

      // Sort by latest created_at
      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setRequests(allRequests);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (key: string, requestId: number, requestType: string) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/approvals/superadmin/${requestType.toLowerCase()}/${requestId}/status/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: key }),
        }
      );

      if (!response.ok) throw new Error('Failed to update status');

      setRequests(prev =>
        prev.map(r => (r.id === requestId && r.type === requestType ? { ...r, status: key } : r))
      );

      message.success(`${requestType} request ${key}`);
    } catch (error) {
      console.error(error);
      message.error('Failed to update status');
    }
  };

  const filteredRequests = filter === 'All' ? requests : requests.filter(r => r.type === filter);

  const columns = [
    {
      title: 'Request Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={type === 'Holiday' ? 'blue' : type === 'Leave' ? 'orange' : 'purple'}>{type}</Tag>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: RequestItem) => {
        if (record.status === 'Approved' || record.status === 'Declined') {
          return (
            <Button
              disabled
              style={{
                backgroundColor: record.status === 'Approved' ? '#d4edda' : '#f8d7da',
                color: record.status === 'Approved' ? '#155724' : '#721c24',
                cursor: 'default',
              }}
            >
              {record.status}
            </Button>
          );
        }

        const menuItems = [
          { label: 'Approved', key: 'Approved' },
          { label: 'Declined', key: 'Declined' },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems, onClick: ({ key }) => handleStatusChange(key, record.id, record.type) }}
          >
            <Button>
              {record.status} <DownOutlined />
            </Button>
          </Dropdown>
        );
      },
    },
  ];

  return (
    <Layout className="request-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Requests" />
        <Content className="request-content">
          <Card className="request-card">
            <h2>All Requests</h2>

            {/* Filter dropdown */}
            <div style={{ marginBottom: 16 }}>
              <Select value={filter} onChange={(value) => setFilter(value)} style={{ width: 200 }}>
                <Option value="All">All</Option>
                <Option value="Holiday">Holiday</Option>
                <Option value="Leave">Leave</Option>
                <Option value="Payroll">Payroll</Option>
              </Select>
            </div>

            {loading ? (
              <Spin tip="Loading..." />
            ) : (
              <Table
                dataSource={filteredRequests}
                columns={columns}
                rowKey={record => `${record.type}-${record.id}`}
                pagination={{ pageSize: 10 }}
              />
            )}
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Request;
