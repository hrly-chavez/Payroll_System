import {
  Table,
  Button,
  Space,
  Popconfirm,
  message,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import { useEffect, useRef, useState } from "react";
import api from "../../../../api/axios";
import { EditOutlined } from "@ant-design/icons";

import AddAllowanceType from "./AddAllowanceType";
import EditAllowanceType from "./EditAllowanceType";

type Props = {
  active: boolean;
};

export type AllowanceType = {
  id: number;
  name: string;
  code: string;
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

  const hasFetched = useRef(false);

  // FETCH
  const fetchAllowanceTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/allowance-type");

      // ✅ normalize is_active so Tag display is accurate
      const normalized = (res.data || []).map((item: any) => ({
        ...item,
        is_active: toBool(item.is_active),
      }));

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

  // TABLE COLUMNS
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
    },
    {
      title: "Code",
      dataIndex: "code",
    },
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
            style={{ cursor: "pointer", color: "black" }}
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
      {/* ADD BUTTON */}
      <Space
        style={{
          width: "100%",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Button type="primary" onClick={() => setAddOpen(true)}>
          Add Allowance Type
        </Button>
      </Space>

      {/* TABLE */}
      {loading ? (
        <Spin style={{ marginTop: 16 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={allowances}
          style={{ marginTop: 16 }}
        />
      )}

      {/* MODALS */}
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
