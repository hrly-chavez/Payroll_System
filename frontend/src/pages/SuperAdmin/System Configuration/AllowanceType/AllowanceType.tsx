import {Table,Button,Space,message,Spin,Tag,Tooltip,Input,} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api/axios";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";

import AddAllowanceType from "./AddAllowanceType";
import EditAllowanceType from "./EditAllowanceType";

type Props = {
  active: boolean;
};

export type AllowanceType = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

const toBool = (v: any) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }

  return Boolean(v);
};

const Allowance = ({ active }: Props) => {
  const [allowances, setAllowances] = useState<AllowanceType[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAllowance, setSelectedAllowance] =
    useState<AllowanceType | null>(null);

  const [search, setSearch] = useState("");

  const hasFetched = useRef(false);

  // ✅ FETCH (Newest First)
  const fetchAllowanceTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/allowance-type");

      const normalized = (res.data || [])
        .map((item: any) => ({
          ...item,
          is_active: toBool(item.is_active),
        }))
        .sort((a: AllowanceType, b: AllowanceType) => b.id - a.id); //  newest first

      setAllowances(normalized);
      hasFetched.current = true;
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch allowance types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    if (!hasFetched.current) {
      fetchAllowanceTypes();
    }
  }, [active]);

  const filteredAllowances = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allowances;

    return allowances
      .filter((a) => {
        const haystack = [a.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.id - a.id); //  keep newest on top
  }, [allowances, search]);

  const columns = [
    { title: "Name", dataIndex: "name" },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="red">Inactive</Tag>
        ),
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "Actions",
      render: (_: any, record: AllowanceType) => (
        <Space size="middle">
          <Tooltip title="Edit allowance type">
            <EditOutlined
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedAllowance(record);
                setEditOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!active) return null;

  return (  
    <>
      {/* Search + Add */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search allowance types..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={() => setAddOpen(true)}>
          Add Allowance Type
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          scroll={{ x: "max-content" }}
          dataSource={filteredAllowances}
        />
      )}

      <AddAllowanceType
        open={addOpen}
        onClose={() => setAddOpen(false)}
        refresh={fetchAllowanceTypes}
      />

      <EditAllowanceType
        open={editOpen}
        onClose={() => setEditOpen(false)}
        allowance={selectedAllowance}
        refresh={fetchAllowanceTypes}
      />
    </>
  );
};

export default Allowance;
