import { Table, Button, Space, Popconfirm, message, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import api from "../../../../api/axios";
import AddShift from "./AddShift";
import EditShift from "./EditShift";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";

type Props = {
  active: boolean;
};

const ShiftTab = ({ active }: Props) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);

  // prevents refetching every time tab toggles
  const hasFetched = useRef(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await api.get("attendance/shifts/");
      setShifts(res.data);
      hasFetched.current = true;
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;

    if (!hasFetched.current) {
      fetchShifts();
    }
  }, [active]);

  const deleteShift = async (id: number) => {
    await api.delete(`/attendance/shifts/${id}/`);
    message.success("Shift deleted");
    fetchShifts();
  };

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Start", dataIndex: "start_time" },
    { title: "End", dataIndex: "end_time" },
    { title: "Break (min)", dataIndex: "break_minutes" },
    { title: "Grace (min)", dataIndex: "grace_minutes" },
    {
      title: "Actions",
      render: (_: any, record: any) => (
        <Space size="middle">
          <EditOutlined
            style={{ cursor: "pointer", color: "#bla" }}
            onClick={() => {
              setSelectedShift(record);
              setEditOpen(true);
            }}
          />
          <Popconfirm
            title="Delete this shift?"
            onConfirm={() => deleteShift(record.id)}
          >
            <DeleteOutlined
              style={{ cursor: "pointer", color: "#ff4d4f" }}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!active) return null;

  return (
    <>
      <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" onClick={() => setAddOpen(true)}>
          Add Shift
        </Button>
      </Space>

      {loading ? (
        <Spin style={{ marginTop: 16 }} />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={shifts}
          style={{ marginTop: 16 }}
        />
      )}

      <AddShift
        open={addOpen}
        onClose={() => setAddOpen(false)}
        refresh={fetchShifts}
      />

      <EditShift
        open={editOpen}
        onClose={() => setEditOpen(false)}
        shift={selectedShift}
        refresh={fetchShifts}
      />
    </>
  );
};

export default ShiftTab;
