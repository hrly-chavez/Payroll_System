// src/pages/SuperAdmin/System Configuration/HolidayPolicy/HolidayPolicy.tsx
import { Table, Button, Space, message, Spin, Tag, Tooltip, Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import api from "../../../../api/axios";
import AddHolidayPolicy from "./AddHolidayPolicy";
import EditHolidayPolicy from "./EditHolidayPolicy";
import "./HolidayPolicy.css"; // ✅ use existing css file

type Props = {
  active: boolean;
};

type HolidayPolicyRow = {
  id: number;
  department: number;
  department_name: string;
  base: "PH" | "US" | "COMPANY";
  base_display: string;
  holiday_type: string;
  holiday_type_display: string;
  requires_work: boolean;
  created_at: string;
};

type DepartmentType = {
  id: number;
  name: string;
};

const HOLIDAY_TYPE_OPTIONS = [
  { value: "Regular", label: "Regular" },
  { value: "Special Non-Working", label: "Special Non-Working" },
  { value: "Special Working", label: "Special Working" },
  { value: "Company Holiday", label: "Company Holiday" },
];

const HolidayPolicy = ({ active }: Props) => {
  const [policies, setPolicies] = useState<HolidayPolicyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<HolidayPolicyRow | null>(null);

  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<number | undefined>(undefined);
  const [filterBase, setFilterBase] = useState<string | undefined>(undefined);
  const [filterHolidayType, setFilterHolidayType] = useState<string | undefined>(undefined);

  const hasFetched = useRef(false);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("employees/departments/");
      setDepartments(res.data || []);
    } catch {
      message.error("Failed to load departments");
    }
  };

  const fetchPolicies = async (params?: {
    department?: number;
    base?: string;
    holiday_type?: string;
  }) => {
    setLoading(true);
    try {
      const res = await api.get("approvals/holiday-policy/", { params });
      setPolicies(res.data || []);
      hasFetched.current = true;
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch holiday policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;

    if (!hasFetched.current) {
      fetchDepartments();
      fetchPolicies();
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (!hasFetched.current) return;

    fetchPolicies({
      department: filterDepartment,
      base: filterBase,
      holiday_type: filterHolidayType,
    });
  }, [filterDepartment, filterBase, filterHolidayType, active]);

  const handleEnsurePolicies = async () => {
    if (!filterDepartment) {
      message.warning("Select a department first to ensure policies.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("approvals/holiday-policy/ensure/", {
        department_id: filterDepartment,
        default_requires_work: true,
      });

      message.success(res.data?.detail || "Policies ensured.");

      fetchPolicies({
        department: filterDepartment,
        base: filterBase,
        holiday_type: filterHolidayType,
      });
    } catch (err: any) {
      console.error(err);
      const detail = err?.response?.data?.detail || "Failed to ensure policies";
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: "Department", dataIndex: "department_name", key: "department_name" },
      {
        title: "Base",
        dataIndex: "base_display",
        key: "base_display",
        render: (_: any, record: HolidayPolicyRow) => <Tag>{record.base}</Tag>,
      },
      { title: "Holiday Type", dataIndex: "holiday_type_display", key: "holiday_type_display" },
      {
        title: "Requires Work",
        dataIndex: "requires_work",
        key: "requires_work",
        align: "center" as const,
        render: (value: boolean) =>
          value ? <Tag color="blue">Required</Tag> : <Tag>Not Required</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        align: "center" as const,
        render: (_: any, record: HolidayPolicyRow) => (
          <Space size="middle">
            <Tooltip title="Edit policy">
              <EditOutlined
                style={{ cursor: "pointer", color: "black" }}
                onClick={() => {
                  setSelectedPolicy(record);
                  setEditOpen(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    []
  );

  if (!active) return null;

  return (
    <>
      <div className="controlsRow">
        <Space wrap>
          <Select
            style={{ minWidth: 220 }}
            placeholder="Filter Department"
            allowClear
            value={filterDepartment}
            onChange={(v) => setFilterDepartment(v)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />

          <Select
            style={{ minWidth: 160 }}
            placeholder="Filter Base"
            allowClear
            value={filterBase}
            onChange={(v) => setFilterBase(v)}
            options={[
              { value: "PH", label: "PH" },
              { value: "US", label: "US" },
              { value: "COMPANY", label: "COMPANY" },
            ]}
          />

          <Select
            style={{ minWidth: 220 }}
            placeholder="Filter Holiday Type"
            allowClear
            value={filterHolidayType}
            onChange={(v) => setFilterHolidayType(v)}
            options={HOLIDAY_TYPE_OPTIONS}
          />

          <Button icon={<ReloadOutlined />} onClick={handleEnsurePolicies}>
            Ensure Policies
          </Button>
        </Space>

        <Button type="primary" onClick={() => setAddOpen(true)}>
          Add Holiday Policy
        </Button>
      </div>

      {loading ? (
        <Spin style={{ marginTop: 16 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columns as any}
          dataSource={policies}
          style={{ marginTop: 16 }}
          pagination={{ pageSize: 10 }}
          scroll={{ x: "max-content" }}
        />
      )}

      <AddHolidayPolicy
        open={addOpen}
        onClose={() => setAddOpen(false)}
        refresh={() =>
          fetchPolicies({
            department: filterDepartment,
            base: filterBase,
            holiday_type: filterHolidayType,
          })
        }
      />

      <EditHolidayPolicy
        open={editOpen}
        onClose={() => setEditOpen(false)}
        policy={selectedPolicy}
        refresh={() =>
          fetchPolicies({
            department: filterDepartment,
            base: filterBase,
            holiday_type: filterHolidayType,
          })
        }
      />
    </>
  );
};

export default HolidayPolicy;