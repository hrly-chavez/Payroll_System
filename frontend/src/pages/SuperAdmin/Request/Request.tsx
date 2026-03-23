  //src/pages/SuperAdmin/Request/Request.tsx
  
  import React, { useEffect, useState } from 'react';
  import { Layout, Card, Table, Tag, Spin, message, Dropdown, Button, Select } from 'antd';
  import { DownOutlined } from '@ant-design/icons';
  import Sidebar from '../../../components/Sidebar/Sidebar';
  import Topbar from '../../../components/Topbar/Topbar';
  import dayjs from 'dayjs';
  import './Request.css';
  import api from "../../../api/axios";
  import LoanDeclineModal from './LoanDeclineModal';

  const { Content } = Layout;
  const { Option } = Select;

  interface RequestItem {
    id: number;
    type: "Holiday" | "Leave" | "Loan";
    employee: string;
    details: string;
    reason: string;
    status: string;
    model: "holiday" | "leave" | "loan";
    created_at: string;

    loan_name?: string;
    principal_amount?: string;
    remaining_balance?: string;
    effective_from?: string;
    effective_to?: string | null;
    declined_reason?: string | null;
    rule_name?: string | null;
    deduction_mode?: string | null;
    deduction_value?: string | null;
    apply_to_cutoff?: string | null;
  }

  const Request: React.FC = () => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState<"All" | "Holiday" | "Leave" | "Loan">("All");
    const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Approved" | "Active" | "Declined">("All");

    const [declineModalOpen, setDeclineModalOpen] = useState(false);
    const [declineSubmitting, setDeclineSubmitting] = useState(false);
    const [selectedDeclineRecord, setSelectedDeclineRecord] = useState<RequestItem | null>(null);

    useEffect(() => {
      fetchRequests();
    }, []);

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const res = await api.get("/approvals/all-requests/");
        setRequests(sortRequests(res.data || []));
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
      if (s === "pending") return 1;
      if (s === "approved") return 2;
      if (s === "active") return 3;
      if (s === "declined" || s === "cancelled") return 4;
      return 5;
    };

    return [...data].sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

    const openDeclineModal = (record: RequestItem) => {
      setSelectedDeclineRecord(record);
      setDeclineModalOpen(true);
    };

    const closeDeclineModal = () => {
      setDeclineModalOpen(false);
      setSelectedDeclineRecord(null);
    };

    const handleDeclineSubmit = async (declineReason: string) => {
      if (!selectedDeclineRecord) return;

      setDeclineSubmitting(true);
      try {
        if (selectedDeclineRecord.model === "loan") {
          await api.post(`/approvals/superadmin/loans/${selectedDeclineRecord.id}/decline/`, {
            decline_reason: declineReason,
          });
        } else if (selectedDeclineRecord.model === "holiday") {
          await api.post(`/approvals/superadmin/holidays/${selectedDeclineRecord.id}/status/`, {
            status: "Declined",
            decline_reason: declineReason,
          });
        } else {
          message.warning("Leave decline action is not wired here yet.");
          return;
        }

        await fetchRequests();
        message.success(`${selectedDeclineRecord.type} request Declined`);
        closeDeclineModal();
      } catch (error: any) {
        console.error(error);
        const backendMessage =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "Failed to decline request";
        message.error(backendMessage);
      } finally {
        setDeclineSubmitting(false);
      }
    };

    const handleStatusChange = async (key: string, record: RequestItem) => {
      try {
        if (key === "Declined") {
          openDeclineModal(record);
          return;
        }

        if (record.model === "holiday") {
          await api.post(`/approvals/superadmin/holidays/${record.id}/status/`, { status: key });
        } else if (record.model === "loan") {
          if (key === "Approved") {
            await api.post(`/approvals/superadmin/loans/${record.id}/approve/`);
          } else if (key === "Active") {
            await api.post(`/approvals/superadmin/loans/${record.id}/activate/`);
          }
        } else {
          message.warning("Leave status action is not wired here yet.");
          return;
        }

        await fetchRequests();
        message.success(`${record.type} request ${key}`);
      } catch (error: any) {
        console.error(error);
        const backendMessage =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "Failed to update status";
        message.error(backendMessage);
      }
    };

    const filteredRequests = requests.filter((r) => {
      const typeMatch = filterType === "All" || r.type === filterType;
      const displayStatus = r.status === "Cancelled" ? "Declined" : r.status;
      const statusMatch = filterStatus === "All" || displayStatus === filterStatus;
      return typeMatch && statusMatch;
    });

   const columns = [
      {
        title: "Request Type",
        dataIndex: "type",
        key: "type",
        render: (type: string) => (
          <Tag color={type === "Holiday" ? "blue" : type === "Leave" ? "orange" : "purple"}>
            {type}
          </Tag>
        ),
      },
      {
        title: "Employee",
        dataIndex: "employee",
        key: "employee",
      },
      {
        title: "Details",
        dataIndex: "details",
        key: "details",
      },
      {
        title: "Reason / Remarks",
        dataIndex: "reason",
        key: "reason",
        render: (value: string) => value || "-",
      },
      {
        title: "Status",
        key: "status",
        render: (_: any, record: RequestItem) => {
          const displayStatus = record.status === "Cancelled" ? "Declined" : record.status;

          if (displayStatus === "Approved" || displayStatus === "Declined" || displayStatus === "Active") {
            return (
              <Button
                disabled
                style={{
                  backgroundColor:
                    displayStatus === "Approved"
                      ? "#d4edda"
                      : displayStatus === "Active"
                      ? "#d1ecf1"
                      : "#f8d7da",
                  color:
                    displayStatus === "Approved"
                      ? "#155724"
                      : displayStatus === "Active"
                      ? "#0c5460"
                      : "#721c24",
                  cursor: "default",
                }}
              >
                {displayStatus}
              </Button>
            );
          }

          const menuItems =
            record.model === "loan"
              ? [
                  { label: "Approved", key: "Approved" },
                  { label: "Declined", key: "Declined" },
                ]
              : record.model === "holiday"
              ? [
                  { label: "Approved", key: "Approved" },
                  { label: "Declined", key: "Declined" },
                ]
              : [];

          if (!menuItems.length) {
            return <Tag>{displayStatus}</Tag>;
          }

          return (
            <Dropdown
              menu={{
                items: menuItems,
                onClick: ({ key }) => handleStatusChange(key, record),
              }}
            >
              <Button>
                {displayStatus} <DownOutlined />
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
                  <Option value="Loan">Loan</Option>
                </Select>

                <Select value={filterStatus} onChange={value => setFilterStatus(value)} style={{ width: 200 }}>
                  <Option value="All">All Statuses</Option>
                  <Option value="Pending">Pending</Option>
                  <Option value="Approved">Approved</Option>
                  <Option value="Active">Active</Option>
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
                  scroll={{ x: "max-content" }}
                />
              )}
            </Card>
          </Content>
        </Layout>
        <LoanDeclineModal
          open={declineModalOpen}
          loading={declineSubmitting}
          requestType={selectedDeclineRecord?.type}
          onClose={closeDeclineModal}
          onSubmit={handleDeclineSubmit}
        />
      </Layout>
    );
  };

  export default Request;
