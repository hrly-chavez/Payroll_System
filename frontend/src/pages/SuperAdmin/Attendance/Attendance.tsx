// src/pages/SuperAdmin/Attendance/Attendance.tsx
import React, { useEffect, useState } from "react";
import { Layout, Card, Table, Input, Avatar, Row, Col, Statistic, Tag, message } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import "./Attendance.css";
import api from "../../../api/axios";
import dayjs from "dayjs";

const { Content } = Layout;
const { Search } = Input;

type LogRow = {
  id: number;
  date: string;
  status: string;
  time_in: string | null;
  time_out: string | null;
  employee_id: number;
  full_name: string;
  department_name: string | null;
  shift_name: string | null;
  event_types: string;
};

type ApiResponse = {
  year: number;
  month: number;
  stats: {
    present: number;
    lates: number;
    absent: number;
  };
  count: number;
  results: LogRow[];
};

function formatTime(t: string | null) {
  if (!t) return "-";
  return dayjs(`2000-01-01 ${t}`).format("h:mm A");
}

function formatDate(d: string) {
  return dayjs(d).format("DD/MM/YYYY");
}

const Attendance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [stats, setStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [search, setSearch] = useState("");

  // current month by default (same as HR version)
  const year = dayjs().year();
  const month = dayjs().month() + 1;

  const fetchLogs = async (keyword?: string) => {
    try {
      setLoading(true);

      const params: any = { year, month };
      if (keyword && keyword.trim()) params.search = keyword.trim();

      const res = await api.get<ApiResponse>("/attendance/super_admin/logs/", { params });

      setRows(res.data.results);
      setStats(res.data.stats);
    } catch (err: any) {
      const backendMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load attendance logs.";
      message.error(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs("");
  }, []);

  const columns = [
    {
      title: "Name",
      dataIndex: "full_name",
      render: (_: any, record: LogRow) => (
        <div className="name-cell">
          <Avatar size={32}>{record.full_name?.[0] ?? "E"}</Avatar>
          <span>{record.full_name}</span>
        </div>
      ),
    },
    { title: "Department", dataIndex: "department_name", render: (v: any) => v ?? "-" },
    { title: "Time In", dataIndex: "time_in", render: (v: any) => formatTime(v) },
    { title: "Time Out", dataIndex: "time_out", render: (v: any) => formatTime(v) },
    {
      title: "Classification",
      render: () => "-",
    },
    { title: "Workshift", dataIndex: "shift_name", render: (v: any) => v ?? "-" },
    { title: "Date", dataIndex: "date", render: (v: any) => formatDate(v) },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) => {
        const map: Record<string, { label: string; color: string }> = {
          PRESENT: { label: "Present", color: "green" },
          ABSENT: { label: "Absent", color: "red" },
          HALF_DAY: { label: "Half Day", color: "orange" },
          REST_DAY: { label: "Rest Day", color: "blue" },
          HOLIDAY: { label: "Holiday", color: "purple" },
        };

        const x = map[status] || { label: status, color: "default" };
        return <Tag color={x.color}>{x.label}</Tag>;
      },
    },

  ];

  return (
    <Layout className="attendance-layout">
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className="attendance-content">
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic title="Total Present" value={stats.present} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Total Lates" value={stats.lates} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Total Absences" value={stats.absent} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Leave request pending" value={0} />
              </Card>
            </Col>
          </Row>

          <Card className="table-card">
            <div className="table-header">
              <Search
                placeholder="Search name / department"
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={(v) => fetchLogs(v)}
                allowClear
              />
            </div>

            <Table
              rowKey="id"
              columns={columns as any}
              dataSource={rows}
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: "max-content" }}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
