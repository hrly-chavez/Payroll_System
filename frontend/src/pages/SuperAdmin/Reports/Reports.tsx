import React, { useState } from 'react';
import { Layout, Tabs, Table, Button, Input, DatePicker, Avatar, Tag } from 'antd';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import './Reports.css';

import UserActivity from './User activity/UserActivity';

const { Content } = Layout;
const { TabPane } = Tabs;

/* ---------------- ATTENDANCE MODIFICATIONS ---------------- */
const attendanceColumns = [
  { title: 'Date / Time', dataIndex: 'date' },
  {
    title: 'Employee Name',
    dataIndex: 'employee',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.employeeAvatar} />
        <span>{record.employee}</span>
      </div>
    ),
  },
  {
    title: 'Changed By',
    dataIndex: 'changedBy',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.changedByAvatar} />
        <span>{record.changedBy}</span>
      </div>
    ),
  },
  { title: 'Field', dataIndex: 'field' },
  { title: 'Old', dataIndex: 'oldValue' },
  { title: 'New', dataIndex: 'newValue' },
  { title: 'Reason', dataIndex: 'reason' },
];

const attendanceData = [
  {
    key: '1',
    date: 'March 20, 2025',
    employee: 'Jeremy Neigh',
    employeeAvatar: 'https://i.pravatar.cc/40?img=3',
    changedBy: 'Annette Black',
    changedByAvatar: 'https://i.pravatar.cc/40?img=5',
    field: 'Time in',
    oldValue: '8:45 AM',
    newValue: '8:00 AM',
    reason: 'Forgot to log in',
  },
];

/* ---------------- PAYROLL ADJUSTMENT LOGS ---------------- */
const payrollAdjustmentColumns = [
  { title: 'Payroll Period', dataIndex: 'payrollPeriod' },
  {
    title: 'Employee Name',
    dataIndex: 'employee',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.employeeAvatar} />
        <span>{record.employee}</span>
      </div>
    ),
  },
  {
    title: 'Changed By',
    dataIndex: 'changedBy',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.changedByAvatar} />
        <span>{record.changedBy}</span>
      </div>
    ),
  },
  { title: 'Type', dataIndex: 'type' },
  { title: 'Amount', dataIndex: 'amount' },
  { title: 'Reason', dataIndex: 'reason' },
];

const payrollAdjustmentData = [
  {
    key: '1',
    payrollPeriod: 'March 1–15, 2025',
    employee: 'Jeremy Neigh',
    employeeAvatar: 'https://i.pravatar.cc/40?img=3',
    changedBy: 'Annette Black',
    changedByAvatar: 'https://i.pravatar.cc/40?img=5',
    type: 'Bonus',
    amount: '+₱2,500.00',
    reason: 'Performance incentive',
  },
];

/* ---------------- PAYROLL APPROVAL & RELEASE LOGS ---------------- */
const payrollApprovalColumns = [
  { title: 'Payroll Period', dataIndex: 'payrollPeriod' },
  {
    title: 'Prepared By',
    dataIndex: 'preparedBy',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.preparedByAvatar} />
        <span>{record.preparedBy}</span>
      </div>
    ),
  },
  {
    title: 'Approved By',
    dataIndex: 'approvedBy',
    render: (_: any, record: any) => (
      <div className="name-cell">
        <Avatar src={record.approvedByAvatar} />
        <span>{record.approvedBy}</span>
      </div>
    ),
  },
  { title: 'Approved Date', dataIndex: 'approvedDate' },
  {
    title: 'Status',
    dataIndex: 'status',
    render: (status: string) => {
      const color =
        status === 'Approved'
          ? 'green'
          : status === 'Pending'
          ? 'orange'
          : 'red';
      return <Tag color={color}>{status}</Tag>;
    },
  },
];

const payrollApprovalData = [
  {
    key: '1',
    payrollPeriod: 'March 1–15, 2025',
    preparedBy: 'Annette Black',
    preparedByAvatar: 'https://i.pravatar.cc/40?img=5',
    approvedBy: 'Jeremy Neigh',
    approvedByAvatar: 'https://i.pravatar.cc/40?img=3',
    approvedDate: 'March 18, 2025',
    status: 'Approved',
  },
];

/* ---------------- COMPONENT ---------------- */
const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1');

  return (
    <Layout className="reports-layout">
      <Sidebar />

      <Layout>
        <Topbar title="Reports" />

        <Content className="reports-content">
          <div className="reports-card">
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="User Activity Logs" key="1" />
              <TabPane tab="Attendance Modifications Logs" key="2" />
              <TabPane tab="Payroll Adjustment Logs" key="3" />
              <TabPane tab="Payroll Approval and Release Logs" key="4" />
            </Tabs>

            <div className="reports-filters">
              <Input.Search placeholder="Search" allowClear />
              <div className="filters-right">
                <DatePicker picker="month" />
                <Button type="primary">Generate Report</Button>
              </div>
            </div>

            {activeTab === '1' && <UserActivity />}

            {activeTab === '2' && (
              <Table
                columns={attendanceColumns}
                dataSource={attendanceData}
                pagination={{ pageSize: 5 }}
                scroll={{ x: 900 }}
              />
            )}

            {activeTab === '3' && (
              <Table
                columns={payrollAdjustmentColumns}
                dataSource={payrollAdjustmentData}
                pagination={{ pageSize: 5 }}
                scroll={{ x: 900 }}
              />
            )}

            {activeTab === '4' && (
              <Table
                columns={payrollApprovalColumns}
                dataSource={payrollApprovalData}
                pagination={{ pageSize: 5 }}
                scroll={{ x: 900 }}
              />
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Reports;
