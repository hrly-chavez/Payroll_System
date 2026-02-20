import { Table, Input, Tag, Space, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import styles from "./PayrollPeriod.module.css";

const { Search } = Input;

type PayrollPeriodType = {
  id: number;
  month: string;
  start_date: string;
  end_date: string;
  status: string;
};

const PayrollPeriod = () => {
  const [data, setData] = useState<PayrollPeriodType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filteredData = data.filter((item) =>
    item.month.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: "Payroll Period",
      dataIndex: "month",
    },
    {
      title: "Date",
      render: (_: any, record: PayrollPeriodType) =>
        `${record.start_date} - ${record.end_date}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) =>
        status === "Locked" ? (
          <Tag color="red">Locked</Tag>
        ) : (
          <Tag color="blue">Processing</Tag>
        ),
    },
    {
      title: "Action",
      render: () => (
        <Space>
          <Tooltip title="View details">
            <EyeOutlined style={{ cursor: "pointer" }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Search
          placeholder="Search"
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};

export default PayrollPeriod;