// src/pages/SuperAdmin/Attendance/Attendance.tsx
import React, { useEffect, useState } from "react";
import { Layout, Card, Table, Input, Avatar, Row, Col, Statistic, Tag, message, DatePicker, Segmented } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import "./Attendance.css";
import api from "../../../api/axios";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

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

function formatDate(d: string) {
  const x = dayjs(d);
  return x.isValid() ? x.format("DD/MM/YYYY") : "-";
}

function formatTimeWithRow(t: string | null, rowDate: string) {
  if (!t) return "-";

  // If backend sends full datetime (ISO or "YYYY-MM-DD ..."), parse directly
  const isDateTime = t.includes("T") || t.includes(" ");
  const d = isDateTime ? dayjs(t) : dayjs(`${rowDate} ${t}`, "YYYY-MM-DD HH:mm:ss");

  return d.isValid() ? d.format("h:mm A") : "-";
}

const Attendance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [stats, setStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [search, setSearch] = useState("");
  type RangeMode = "Month" | "Week" | "Day";
  const [rangeMode, setRangeMode] = useState<RangeMode>("Month");
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs()); // used for Day/Week anchor
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs()); // used for Month filter

  const [allRows, setAllRows] = useState<LogRow[]>([]); // raw rows from API (month)

  
  const computeStatsFromRows = (list: LogRow[]) => {
    const present = list.filter((r) => r.status === "PRESENT").length;
    const absent = list.filter((r) => r.status === "ABSENT").length;

    const lates = list.filter((r) => {
      const types = (r.event_types || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      return types.includes("Late");
    }).length;

    return { present, lates, absent };
  };

  const applyClientFilter = (list: LogRow[], mode: RangeMode, anchor: Dayjs) => {
    if (mode === "Month") return list;

    if (mode === "Day") {
      const target = anchor.format("YYYY-MM-DD");
      return list.filter((r) => r.date === target);
    }

    // Week (Mon-Sun)
    const start = anchor.startOf("week"); // if you want Monday as start, see note below
    const end = anchor.endOf("week");
    return list.filter((r) => {
      const d = dayjs(r.date);
      return d.isSame(start, "day") || (d.isAfter(start, "day") && d.isBefore(end, "day")) || d.isSame(end, "day");
    });
  };

  const fetchLogs = async (opts?: { keyword?: string; y?: number; m?: number }) => {
      try {
        setLoading(true);

        const y = opts?.y ?? selectedMonth.year();
        const m = opts?.m ?? (selectedMonth.month() + 1);

        const params: any = { year: y, month: m };
        if (opts?.keyword && opts.keyword.trim()) params.search = opts.keyword.trim();

        const res = await api.get<ApiResponse>("/attendance/super_admin/logs/", { params });

        // store raw month rows
        setAllRows(res.data.results);

        // apply Day/Week/Month filter on the month rows
        const anchor = selectedDate;
        const filtered = applyClientFilter(res.data.results, rangeMode, anchor);

        setRows(filtered);
        setStats(computeStatsFromRows(filtered));
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
    fetchLogs({ keyword: "" });
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
    { title: "Time In", dataIndex: "time_in", render: (_: any, r: LogRow) => formatTimeWithRow(r.time_in, r.date) },
    { title: "Time Out", dataIndex: "time_out", render: (_: any, r: LogRow) => formatTimeWithRow(r.time_out, r.date) },
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
            <Col xs={24} sm={12} md={6}>
              <Card className="statCard presentCard">
                <Statistic title="Total Present" value={stats.present} />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="statCard lateCard">
                <Statistic title="Total Lates" value={stats.lates} />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="statCard absentCard">
                <Statistic title="Total Absences" value={stats.absent} />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="statCard pendingCard">
                <Statistic title="Leave Request Pending" value={0} />
              </Card>
            </Col>
          </Row>

          <Card className="table-card">
            <div className="table-header">
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Segmented
                value={rangeMode}
                onChange={(v) => {
                  const mode = v as RangeMode;
                  setRangeMode(mode);

                  // re-apply filter immediately on existing month data
                  const filtered = applyClientFilter(allRows, mode, selectedDate);
                  setRows(filtered);
                  setStats(computeStatsFromRows(filtered));
                }}
                options={["Month", "Week", "Day"]}
              />

              {rangeMode === "Month" && (
                <DatePicker
                  picker="month"
                  value={selectedMonth}
                  onChange={(d) => {
                    if (!d) return;
                    setSelectedMonth(d);

                    // fetch server data for new month
                    fetchLogs({ keyword: search, y: d.year(), m: d.month() + 1 });
                  }}
                />
              )}

              {rangeMode !== "Month" && (
                <DatePicker
                  value={selectedDate}
                  onChange={(d) => {
                    if (!d) return;
                    setSelectedDate(d);

                    // ensure the month data loaded matches the anchor date's month
                    const ymChanged =
                      d.year() !== selectedMonth.year() || d.month() !== selectedMonth.month();

                    if (ymChanged) {
                      setSelectedMonth(d);
                      fetchLogs({ keyword: search, y: d.year(), m: d.month() + 1 });
                      return;
                    }

                    // same month: just re-filter client-side
                    const filtered = applyClientFilter(allRows, rangeMode, d);
                    setRows(filtered);
                    setStats(computeStatsFromRows(filtered));
                  }}
                />
              )}
            </div>

              <Search
                placeholder="Search name / department"
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={(v) => fetchLogs({ keyword: v })}
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
