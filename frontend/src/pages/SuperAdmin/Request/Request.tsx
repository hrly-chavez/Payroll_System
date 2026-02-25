  import React, { useEffect, useState } from 'react';
  import { Layout, Card, Table, Tag, Spin, message, Dropdown, Button, Select } from 'antd';
  import { DownOutlined } from '@ant-design/icons';
  import Sidebar from '../../../components/Sidebar/Sidebar';
  import Topbar from '../../../components/Topbar/Topbar';
  import dayjs from 'dayjs';
  import './Request.css';
  import api from "../../../api/axios";


  const { Content } = Layout;
  const { Option } = Select;

  interface RequestItem {
    id: number;
    type: 'Holiday' | 'Leave';
    name: string;
    date: string;
    status: string;
    base?: string;
    is_active: boolean;
    created_at: string;
  }

  const Request: React.FC = () => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState<'All' | 'Leave'>('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Declined'>('All');

    useEffect(() => {
      fetchRequests();
    }, []);

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const holidaysRes = await api.get("/approvals/holidays/");
        const holidays = holidaysRes.data;

        const allRequests: RequestItem[] = [
          ...holidays.map((h: any) => ({ ...h, type: "Holiday" })),
        ];

        setRequests(sortRequests(allRequests));
      } catch (error) {
        console.error(error);
        message.error("Failed to fetch requests");
      } finally {
        setLoading(false);
      }
    };

    const sortRequests = (data: RequestItem[]) => {
      const normalizeStatus = (status: string) => status.toLowerCase();

      const statusPriority = (status: string) => {
        const s = normalizeStatus(status);
        if (s === 'pending') return 1;
        if (s === 'approved') return 2;
        if (s === 'declined') return 3;
        return 4;
      };

      return [...data].sort((a, b) => {
        const statusDiff = statusPriority(a.status) - statusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    };

    const handleStatusChange = async (key: string, requestId: number, requestType: string) => {
      try {
        await api.post(`/approvals/superadmin/holidays/${requestId}/status/`, { status: key });
        setRequests((prev) =>
          sortRequests(
            prev.map((r) => r.id === requestId && r.type === requestType ? { ...r, status: key } : r)
          )
        );
        message.success(`${requestType} request ${key}`);
      } catch (error) {
        console.error(error);
        message.error("Failed to update status");
      }
    };

    const filteredRequests = requests.filter(r => {
      const typeMatch = filterType === 'All' || r.type === filterType;
      const statusMatch = filterStatus === 'All' || r.status === filterStatus;
      return typeMatch && statusMatch;
    });

    const columns = [
      {
        title: 'Request Type',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Tag color={type === 'Holiday' ? 'blue' : type === 'Leave' ? 'orange' : 'purple'}>
            {type}
          </Tag>
        ),
      },
      { title: 'Name', dataIndex: 'name', key: 'name' },
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
              menu={{
                items: menuItems,
                onClick: ({ key }) => handleStatusChange(key, record.id, record.type),
              }}
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

              {/* Filters */}
              <div style={{ marginBottom: 16, display: 'flex', gap: '16px' }}>
                <Select value={filterType} onChange={value => setFilterType(value)} style={{ width: 200 }}>
                  <Option value="All">All Types</Option>
                  <Option value="Holiday">Holiday</Option>
                  <Option value="Leave">Leave</Option>
                </Select>

                <Select value={filterStatus} onChange={value => setFilterStatus(value)} style={{ width: 200 }}>
                  <Option value="All">All Statuses</Option>
                  <Option value="Pending">Pending</Option>
                  <Option value="Approved">Approved</Option>
                  <Option value="Declined">Declined</Option>
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
