// src/pages/HR/Attendance/Attendance.tsx
import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Row,
  Col,
  Input,
  Table,
  Avatar,
  Tag,
  Statistic,
  message,
  DatePicker,
  Segmented,
  Button,
  Modal,
  Radio,
  Select,
  Space,
  Divider,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
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

type EmployeeOption = { value: number; label: string };

function formatDate(d: string) {
  const x = dayjs(d);
  return x.isValid() ? x.format("MM/DD/YYYY") : "-";
}

function formatTimeWithRow(t: string | null, rowDate: string) {
  if (!t) return "-";
  const isDateTime = t.includes("T") || t.includes(" ");
  const d = isDateTime ? dayjs(t) : dayjs(`${rowDate} ${t}`, "YYYY-MM-DD HH:mm:ss");
  return d.isValid() ? d.format("h:mm A") : "-";
}

// PDF download helper (does NOT redirect tab)
const downloadPDF = async (url: string, filename: string) => {
  const res = await api.get(url, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const objectUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  a.remove();
  window.URL.revokeObjectURL(objectUrl);
};

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

  // import file for biometric
  const [biometricOpen, setBiometricOpen] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // PDF modal state (same concept as attendance correction)
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // scope
  const [pdfScope, setPdfScope] = useState<"all" | "user">("all");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // filter type
  const [pdfFilterType, setPdfFilterType] = useState<"date" | "month" | "year">("month");
  const [pdfDate, setPdfDate] = useState<Dayjs | null>(dayjs());
  const [pdfMonth, setPdfMonth] = useState<Dayjs | null>(dayjs());
  const [pdfYear, setPdfYear] = useState<Dayjs | null>(dayjs());

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
      return (d.isAfter(start, "day") || d.isSame(start, "day")) && (d.isBefore(end, "day") || d.isSame(end, "day"));
    });
  };

  const fetchLogs = async (opts?: { keyword?: string; y?: number; m?: number }) => {
    try {
      setLoading(true);

      const y = opts?.y ?? selectedMonth.year();
      const m = opts?.m ?? (selectedMonth.month() + 1);

      const params: any = { year: y, month: m };
      if (opts?.keyword && opts.keyword.trim()) params.search = opts.keyword.trim();

      const res = await api.get<ApiResponse>("/attendance/attendance-logs/", { params });

      setAllRows(res.data.results);

      const filtered = applyClientFilter(res.data.results, rangeMode, selectedDate);

      setRows(filtered);
      setStats(computeStatsFromRows(filtered));
    } catch (err: any) {
      const backendMsg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to load attendance logs.";
      message.error(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  // Load employees for dropdown (use your working dropdown endpoint)
  const loadEmployees = async () => {
    try {

      const res = await api.get("/employees/dropdown/");
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];

      const opts: EmployeeOption[] = data.map((e: any) => {
        const fullName = `${e.fname ?? ""} ${e.lname ?? ""}`.trim();
        return {
          value: Number(e.value ?? e.id),
          label: String(e.label ?? (fullName || `Employee #${e.value ?? e.id}`)),
        };
      });

      setEmployeeOptions(opts);
    } catch (err) {
      console.error(err);
      message.error("Failed to load employees for PDF dropdown.");
      setEmployeeOptions([]);
    }
  };

  useEffect(() => {
    fetchLogs({ keyword: "" });
    loadEmployees();
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
  { title: "Time In", dataIndex: "time_in", render: (_: any, r: HRLogRow) => formatTimeWithRow(r.time_in, r.date) },
  { title: "Time Out", dataIndex: "time_out", render: (_: any, r: HRLogRow) => formatTimeWithRow(r.time_out, r.date) },
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
  {
    title: "Event Types",
    dataIndex: "event_types",
    render: (v: string) => (v && v.trim() ? v : "-"),
  },
];
  //import .xlsx file
  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const isXlsx =
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.name.endsWith(".xlsx");

      if (!isXlsx) {
        message.error("Only .xlsx files are allowed!");
        return Upload.LIST_IGNORE;
      }

      setFile(file);
      return false; // prevent auto upload
    },
    maxCount: 1,
  };

  const handleImportBiometrics = async () => {
    if (!file) {
      message.warning("Please select an Excel (.xlsx) file.");
      return;
    }

    try {
      setBiometricLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      await api.post("/attendance/import-biometrics/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      message.success("Biometrics imported successfully!");
      setBiometricOpen(false);
      setFile(null);

      // refresh table after import
      fetchLogs({ keyword: search });
    } catch (err: any) {
      console.error(err);
      message.error("Failed to import biometrics.");
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleOpenPDFModal = () => {
    // prefill modal based on current UI selection (nice UX)
    if (rangeMode === "Day") {
      setPdfFilterType("date");
      setPdfDate(selectedDate);
    } else if (rangeMode === "Week") {
      // For week mode, you can still export by month, or use "date" anchor.
      // We'll default to "date" anchor (backend can interpret it as a date filter),
      // but if your backend only supports date/month/year, date is fine.
      setPdfFilterType("date");
      setPdfDate(selectedDate);
    } else {
      setPdfFilterType("month");
      setPdfMonth(selectedMonth);
    }

    setPdfOpen(true);
  };

  const handleGeneratePDF = async () => {
    try {
      // Validate scope
      if (pdfScope === "user" && !selectedEmployeeId) {
        message.warning("Please select an employee.");
        return;
      }

      // Validate filter choice
      if (pdfFilterType === "date" && !pdfDate) {
        message.warning("Please select a date.");
        return;
      }
      if (pdfFilterType === "month" && !pdfMonth) {
        message.warning("Please select a month.");
        return;
      }
      if (pdfFilterType === "year" && !pdfYear) {
        message.warning("Please select a year.");
        return;
      }

      setPdfLoading(true);

      const params = new URLSearchParams();
      params.append("scope", pdfScope);

      if (pdfScope === "user" && selectedEmployeeId) {
        params.append("employee_id", String(selectedEmployeeId));
      }

      if (pdfFilterType === "date" && pdfDate) params.append("date", pdfDate.format("YYYY-MM-DD"));
      if (pdfFilterType === "month" && pdfMonth) params.append("month", pdfMonth.format("YYYY-MM"));
      if (pdfFilterType === "year" && pdfYear) params.append("year", pdfYear.format("YYYY"));

      // If you want the PDF export to support search keyword too, only add if your backend supports it.
      // params.append("search", search);

      // Set this to your actual Attendance Logs PDF endpoint
      // Example:
      // /reports/attendance-logs/pdf/
      // /attendance/admin/logs/pdf/
      // Use whatever you implement on backend.
      const url = `/attendance/attendance-logs/pdf/?${params.toString()}`;

      const stamp = dayjs().format("YYYY-MM-DD");
      await downloadPDF(url, `Attendance_Logs_${stamp}.pdf`);

      setPdfOpen(false);
    } catch (err) {
      console.error(err);
      message.error("Failed to generate attendance PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

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

                      const ymChanged = d.year() !== selectedMonth.year() || d.month() !== selectedMonth.month();

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

                <Space>
                  <Button type="primary" onClick={handleOpenPDFModal}>
                    Generate PDF
                  </Button>

                  <Button type="primary" onClick={() => setBiometricOpen(true)}>
                    Import Biometrics
                  </Button>
                </Space>
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
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10, showSizeChanger: true}}
              rowClassName={styles.rowStyle}
            />
          </Card>
        </Content>

        <Modal
          title="Import Biometrics"
          open={biometricOpen}
          onCancel={() => {
            setBiometricOpen(false);
            setFile(null);
          }}
          onOk={handleImportBiometrics}
          okText="Import"
          confirmLoading={biometricLoading}
          destroyOnClose
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <Upload {...uploadProps}>
              <Button>Select Excel File (.xlsx)</Button>
            </Upload>

            {file && (
              <div>
                Selected file: <strong>{file.name}</strong>
              </div>
            )}
          </Space>
        </Modal>

        <Modal
          title="Generate Attendance Report"
          open={pdfOpen}
          onCancel={() => setPdfOpen(false)}
          onOk={handleGeneratePDF}
          okText="Generate PDF"
          confirmLoading={pdfLoading}
          destroyOnClose
        >
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Scope</div>
              <Radio.Group
                value={pdfScope}
                onChange={(e) => {
                  const v = e.target.value as "all" | "user";
                  setPdfScope(v);
                  if (v === "all") setSelectedEmployeeId(null);
                }}
              >
                <Radio value="all">All users</Radio>
                <Radio value="user">Specific user</Radio>
              </Radio.Group>
            </div>

            {pdfScope === "user" && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Employee</div>
                <Select
                  showSearch
                  placeholder="Select employee"
                  style={{ width: "100%" }}
                  options={employeeOptions}
                  value={selectedEmployeeId ?? undefined}
                  onChange={(v) => setSelectedEmployeeId(Number(v))}
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </div>
            )}

            <Divider style={{ margin: "10px 0" }} />

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Filter</div>
              <Radio.Group
                value={pdfFilterType}
                onChange={(e) => setPdfFilterType(e.target.value)}
              >
                <Radio value="date">By date</Radio>
                <Radio value="month">By month</Radio>
                <Radio value="year">By year</Radio>
              </Radio.Group>
            </div>

            {pdfFilterType === "date" && (
              <DatePicker
                style={{ width: "100%" }}
                value={pdfDate}
                onChange={(d) => setPdfDate(d)}
              />
            )}

            {pdfFilterType === "month" && (
              <DatePicker
                picker="month"
                style={{ width: "100%" }}
                value={pdfMonth}
                onChange={(d) => setPdfMonth(d)}
              />
            )}

            {pdfFilterType === "year" && (
              <DatePicker
                picker="year"
                style={{ width: "100%" }}
                value={pdfYear}
                onChange={(d) => setPdfYear(d)}
              />
            )}
          </Space>
        </Modal>
      </Layout>
    </Layout>
  );
};

export default Attendance;