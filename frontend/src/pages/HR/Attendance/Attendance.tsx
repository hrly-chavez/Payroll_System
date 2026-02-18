// src/pages/HR/Attendance/Attendance.tsx
import React, { useEffect, useState } from "react";
import { Layout, Card, Row, Col, Input, Table, Avatar, Tag, Statistic, message, DatePicker, Segmented } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Attendance.module.css";
import api from "../../../api/axios";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Content } = Layout;
const { Search } = Input;

type HRLogRow = {
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
  results: HRLogRow[];
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
  const [rows, setRows] = useState<HRLogRow[]>([]);
  const [stats, setStats] = useState({ present: 0, lates: 0, absent: 0 });
  const [search, setSearch] = useState("");

  type RangeMode = "Month" | "Week" | "Day";

  const [rangeMode, setRangeMode] = useState<RangeMode>("Month");
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());   
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs()); 

  const [allRows, setAllRows] = useState<HRLogRow[]>([]); 


  const computeStatsFromRows = (list: HRLogRow[]) => {
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

  const applyClientFilter = (list: HRLogRow[], mode: RangeMode, anchor: Dayjs) => {
    if (mode === "Month") return list;

    if (mode === "Day") {
      const target = anchor.format("YYYY-MM-DD");
      return list.filter((r) => r.date === target);
    }

    // Week
    const start = anchor.startOf("week");
    const end = anchor.endOf("week");

    return list.filter((r) => {
      const d = dayjs(r.date);
      return (d.isAfter(start, "day") || d.isSame(start, "day")) &&
            (d.isBefore(end, "day") || d.isSame(end, "day"));
    });
  };

  const fetchLogs = async (opts?: { keyword?: string; y?: number; m?: number }) => {
    try {
      setLoading(true);

      const y = opts?.y ?? selectedMonth.year();
      const m = opts?.m ?? (selectedMonth.month() + 1);

      const params: any = { year: y, month: m };
      if (opts?.keyword && opts.keyword.trim()) params.search = opts.keyword.trim();

      const res = await api.get<ApiResponse>("/attendance/admin/logs/", { params });

      setAllRows(res.data.results);

      const filtered = applyClientFilter(res.data.results, rangeMode, selectedDate);

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
      render: (_: any, record: HRLogRow) => (
        <div className={styles.nameCell}>
          <Avatar>{record.full_name?.[0] ?? "E"}</Avatar>
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
    {
      title: "Workshift",
      dataIndex: "shift_name",
      render: (v: any) => v ?? "-",
    },
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
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className={styles.content}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Card className={`${styles.statCard} ${styles.presentCard}`}>
                <Statistic title="Total Present" value={stats.present} />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Card className={`${styles.statCard} ${styles.lateCard}`}>
                <Statistic title="Total Lates" value={stats.lates} />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Card className={`${styles.statCard} ${styles.absentCard}`}>
                <Statistic title="Total Absences" value={stats.absent} />
              </Card>
            </Col>
          </Row>

          <Card className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Segmented
                  value={rangeMode}
                  onChange={(v) => {
                    const mode = v as RangeMode;
                    setRangeMode(mode);

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

                      const ymChanged =
                        d.year() !== selectedMonth.year() || d.month() !== selectedMonth.month();

                      if (ymChanged) {
                        setSelectedMonth(d);
                        fetchLogs({ keyword: search, y: d.year(), m: d.month() + 1 });
                        return;
                      }

                      const filtered = applyClientFilter(allRows, rangeMode, d);
                      setRows(filtered);
                      setStats(computeStatsFromRows(filtered));
                    }}
                  />
                )}
              </div>
              <Search
                placeholder="Search name / department"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={(v) => fetchLogs({ keyword: v })}
                allowClear
                className={styles.searchRight}
              />
            </div>

            <Table
              rowKey="id"
              loading={loading}
              dataSource={rows}
              columns={columns as any}
              pagination={{ pageSize: 10, showSizeChanger: true}}
              rowClassName={styles.rowStyle}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
