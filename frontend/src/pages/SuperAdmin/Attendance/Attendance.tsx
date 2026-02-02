import React from 'react';
import { Layout, Card, Table, Input, Avatar, Row, Col, Statistic } from 'antd';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import './Attendance.css';

const { Content } = Layout;
const { Search } = Input;

const dataSource = [
  {
    key: '1',
    name: 'Jeremy Neigh',
    department: 'HR',
    timeIn: '12:00 a.m',
    timeOut: '9:00 a.m',
    classification: 'Full time',
    workshift: '12:00 - 9:00 a.m',
    date: '15/08/2017',
    status: 'Present',
  },
  {
    key: '2',
    name: 'Annette Black',
    department: 'IT',
    timeIn: '12:00 a.m',
    timeOut: '9:00 a.m',
    classification: 'Part-Time',
    workshift: '12:00 - 9:00 a.m',
    date: '16/08/2013',
    status: 'Late',
  },
  {
    key: '3',
    name: 'Theresa Webb',
    department: 'Finance',
    timeIn: '12:00 a.m',
    timeOut: '9:00 a.m',
    classification: 'Full time',
    workshift: '12:00 - 9:00 a.m',
    date: '07/05/2016',
    status: 'Present',
  },
  {
    key: '4',
    name: 'Kathryn Murphy',
    department: 'Agent',
    timeIn: '12:00 a.m',
    timeOut: '9:00 a.m',
    classification: 'Student',
    workshift: '12:00 - 9:00 a.m',
    date: '12/06/2020',
    status: 'Present',
  },
  {
    key: '5',
    name: 'Courtney Henry',
    department: 'Agent',
    timeIn: '12:00 a.m',
    timeOut: '9:00 a.m',
    classification: 'Full time',
    workshift: '12:00 - 9:00 a.m',
    date: '28/10/2012',
    status: 'Late',
  },
];

const columns = [
  {
    title: 'Name',
    dataIndex: 'name',
    render: (text: string) => (
      <div className="name-cell">
        <Avatar size={32}>{text.charAt(0)}</Avatar>
        <span>{text}</span>
      </div>
    ),
  },
  { title: 'Department', dataIndex: 'department' },
  { title: 'Time In', dataIndex: 'timeIn' },
  { title: 'Time Out', dataIndex: 'timeOut' },
  { title: 'Classification', dataIndex: 'classification' },
  { title: 'Workshift', dataIndex: 'workshift' },
  { title: 'Date', dataIndex: 'date' },
  { title: 'Status', dataIndex: 'status' },
];

const Attendance: React.FC = () => {
  return (
    <Layout className="attendance-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />
        <Content className="attendance-content">
          
          {/* Stats Cards */}
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="Total Present" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Lates" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Absences" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Leave request pending" value={0} /></Card></Col>
          </Row>

          {/* Table Section */}
          <Card className="table-card">
            <div className="table-header">
              <Search placeholder="Search" className="search-input" />
            </div>

            <Table
              columns={columns}
              dataSource={dataSource}
              pagination={{ pageSize: 5 }}
              scroll={{ x: 'max-content' }}
            />
          </Card>

        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
