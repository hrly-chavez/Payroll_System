import { Table, Button, Space, message, Spin, Tag, Tooltip } from "antd";
import { useEffect, useRef, useState } from "react";
import { EditOutlined } from "@ant-design/icons";
import api from "../../../../api/axios";
import AddHolidayPolicy from "./AddHolidayPolicy";
import EditHolidayPolicy from "./EditHolidayPolicy";
import styles from "./HolidayPolicy.module.css";

type Props = {
  active: boolean;
};

const HolidayPolicy = ({ active }: Props) => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);

  const hasFetched = useRef(false);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get("approvals/holiday-policy/");
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
      fetchPolicies();
    }
  }, [active]);

  const columns = [
    { title: "Department", dataIndex: "department" },
    { title: "Holiday Type", dataIndex: "holiday_type" },
    { title: "Requires Work", dataIndex: "requires_work" },

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
      title: "Actions",
      render: (_: any, record: any) => (
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
  ];

  if (!active) return null;

  return (
    <>
      <Space
        style={{
          width: "100%",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Button type="primary" onClick={() => setAddOpen(true)}>
          Add Holiday Policy
        </Button>
      </Space>

      {loading ? (
        <Spin style={{ marginTop: 16 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={policies}
          style={{ marginTop: 16 }}
        />
      )}

      {/* Add Modal */}
      <AddHolidayPolicy
        open={addOpen}
        onClose={() => setAddOpen(false)}
        refresh={fetchPolicies}
      />

      {/* Edit Modal */}
      <EditHolidayPolicy
        open={editOpen}
        onClose={() => setEditOpen(false)}
        policy={selectedPolicy}
        refresh={fetchPolicies}
      />
    </>
  );
};

export default HolidayPolicy;
