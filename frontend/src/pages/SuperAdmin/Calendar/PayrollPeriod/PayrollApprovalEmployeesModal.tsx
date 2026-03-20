"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Table, Tag, message, Select, Input, Button, Space } from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";
import PayrollApprovalResultModal from "./PayrollApprovalResultModal";
import BulkDeclineModal from "./BulkDeclineModal";

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: string;
};

type ApprovalEmployeeRow = {
  employee_id: number;
  full_name: string;
  department_name?: string | null;

  ppe_status: string;

  payroll_id?: number | null;
  payroll_status?: string | null;
  run_no?: number | null;
  net_pay?: string | null;
};

type Props = {
  open: boolean;
  periodId: number | null;
  onClose: () => void;
};

type DeclinePayloadItem = {
  employee_id: number;
  declined_reason: string;
};

const ppeTag = (s?: string) => {
  const x = (s || "").toLowerCase();
  if (x === "approved") return <Tag color="green">Approved</Tag>;
  if (x === "declined") return <Tag color="red">Declined</Tag>;
  if (x === "processing") return <Tag color="gold">Processing</Tag>;
  if (x === "verified") return <Tag color="blue">Verified</Tag>;
  if (x === "pending") return <Tag color="default">Pending</Tag>;
  return <Tag>{s || "-"}</Tag>;
};

const payrollTag = (s?: string | null) => {
  const x = (s || "").toLowerCase();
  if (x === "approved") return <Tag color="green">Approved</Tag>;
  if (x === "disapproved") return <Tag color="red">Disapproved</Tag>;
  if (x === "paid") return <Tag color="blue">Paid</Tag>;
  if (x === "generated") return <Tag color="gold">Generated</Tag>;
  if (x === "void") return <Tag color="default">Void</Tag>;
  return <Tag>{s || "-"}</Tag>;
};

const isBulkDecisionEligible = (row: ApprovalEmployeeRow) =>
  row.ppe_status === "Processing" && row.payroll_status === "Generated";

export default function PayrollApprovalEmployeesModal({ open, periodId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [rows, setRows] = useState<ApprovalEmployeeRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<"Processing" | "Approved" | "Declined" | "All">("Processing");
  const [searchText, setSearchText] = useState("");

  const [openResult, setOpenResult] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [bulkDeclineOpen, setBulkDeclineOpen] = useState(false);
  const [declineQueue, setDeclineQueue] = useState<ApprovalEmployeeRow[]>([]);
  const [declineIndex, setDeclineIndex] = useState(0);
  const [declineReasonsMap, setDeclineReasonsMap] = useState<Record<number, string>>({});
  const [approveIdsPending, setApproveIdsPending] = useState<number[]>([]);

  const loadQueue = async () => {
    if (!open || !periodId) return;

    setLoading(true);
    try {
      const res = await api.get(`/payroll/periods/${periodId}/approval-queue/`, {
        params: { status: statusFilter },
      });

      setPeriod(res.data?.period || null);
      setRows(res.data?.employees || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load approval queue";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && periodId) {
      loadQueue();
    } else if (!open) {
      setPeriod(null);
      setRows([]);
      setSelectedEmployeeId(null);
      setOpenResult(false);
      setStatusFilter("Processing");
      setSearchText("");
      setSelectedRowKeys([]);
      setBulkDeclineOpen(false);
      setDeclineQueue([]);
      setDeclineIndex(0);
      setDeclineReasonsMap({});
      setApproveIdsPending([]);
    }
  }, [open, periodId]);

  useEffect(() => {
    if (open && periodId) {
      loadQueue();
    }
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) =>
      [r.full_name, r.department_name, r.ppe_status, r.payroll_status, String(r.run_no ?? "")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchText]);

  const eligibleRows = useMemo(() => {
    return filtered.filter(isBulkDecisionEligible);
  }, [filtered]);

  const currentDeclineEmployee = declineQueue[declineIndex] || null;

  const resetBulkFlow = () => {
    setBulkDeclineOpen(false);
    setDeclineQueue([]);
    setDeclineIndex(0);
    setDeclineReasonsMap({});
    setApproveIdsPending([]);
  };

  const submitBulkDecision = async (approveIds: number[], declineItems: DeclinePayloadItem[]) => {
    if (!periodId) return;

    setActing(true);
    try {
      const res = await api.post(`/payroll/periods/${periodId}/bulk-decision/`, {
        approve_employee_ids: approveIds,
        declines: declineItems,
      });

      const detail = res?.data?.detail || "Bulk payroll decision completed.";
      message.success(detail);

      resetBulkFlow();
      setSelectedRowKeys([]);
      await loadQueue();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Bulk payroll decision failed";
      message.error(msg);
    } finally {
      setActing(false);
    }
  };

  const startBulkApproveFlow = () => {
    const eligibleIds = eligibleRows.map((r) => r.employee_id);

    if (!eligibleIds.length) {
      message.warning("No eligible employees found for bulk decision.");
      return;
    }

    const selectedIds = selectedRowKeys.map(Number).filter((id) => eligibleIds.includes(id));
    if (!selectedIds.length) {
      message.warning("Please select at least one employee to approve.");
      return;
    }

    const declineTargets = eligibleRows.filter((r) => !selectedIds.includes(r.employee_id));

    setApproveIdsPending(selectedIds);

    if (!declineTargets.length) {
      submitBulkDecision(selectedIds, []);
      return;
    }

    setDeclineQueue(declineTargets);
    setDeclineIndex(0);
    setDeclineReasonsMap({});
    setBulkDeclineOpen(true);
  };

  const handleBulkDeclineSubmit = async (reason: string) => {
    const current = declineQueue[declineIndex];
    if (!current) return;

    const nextMap = {
      ...declineReasonsMap,
      [current.employee_id]: reason,
    };
    setDeclineReasonsMap(nextMap);

    const isLast = declineIndex >= declineQueue.length - 1;

    if (!isLast) {
      setDeclineIndex((prev) => prev + 1);
      return;
    }

    const declineItems: DeclinePayloadItem[] = declineQueue.map((emp) => ({
      employee_id: emp.employee_id,
      declined_reason: nextMap[emp.employee_id] || "",
    }));

    await submitBulkDecision(approveIdsPending, declineItems);
  };

  const columns = [
    { title: "Employee", dataIndex: "full_name" },
    {
      title: "Department",
      dataIndex: "department_name",
      render: (v: string) => v || "-",
    },
    {
      title: "PPE Status",
      dataIndex: "ppe_status",
      width: 130,
      render: (v: string) => ppeTag(v),
    },
    {
      title: "Payroll Status",
      dataIndex: "payroll_status",
      width: 140,
      render: (v: string) => payrollTag(v),
    },
    {
      title: "Run",
      dataIndex: "run_no",
      width: 80,
      align: "right" as const,
      render: (v: number | null) => v ?? "-",
    },
    {
      title: "Net Pay",
      dataIndex: "net_pay",
      width: 120,
      align: "right" as const,
      render: (v: string | null) => (v ? v : "-"),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: any, row: ApprovalEmployeeRow) => (
        <Button
          size="small"
          disabled={!row.employee_id}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEmployeeId(row.employee_id);
            setOpenResult(true);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys);
    },
    getCheckboxProps: (record: ApprovalEmployeeRow) => ({
      disabled: !isBulkDecisionEligible(record),
    }),
  };

  const title = period
    ? `Approval Queue: ${dayjs(period.start_date).format("MM/DD/YYYY")} - ${dayjs(period.end_date).format("MM/DD/YYYY")}`
    : "Approval Queue";

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={980}
        title={title}
        style={{ top: 30 }}
        destroyOnClose
        styles={{
          body: {
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
            overflowX: "hidden",
          },
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <Space wrap>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Period Status: <b>{period?.status || "-"}</b>
            </div>

            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 160 }}
              options={[
                { value: "Processing", label: "Processing" },
                { value: "Approved", label: "Approved" },
                { value: "Declined", label: "Declined" },
                { value: "All", label: "All" },
              ]}
            />

            <Input
              placeholder="Search employee / department / status..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 320 }}
              allowClear
            />
          </Space>

          <Space>
            <Button onClick={loadQueue} loading={loading}>
              Refresh
            </Button>

            <Button
              type="primary"
              onClick={startBulkApproveFlow}
              disabled={acting || !eligibleRows.length}
              loading={acting}
            >
              Bulk Decide
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.75 }}>
          Eligible for bulk decision: <b>{eligibleRows.length}</b> | Selected to approve: <b>{selectedRowKeys.length}</b>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns as any}
          dataSource={filtered}
          rowKey="employee_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "50"],
            showTotal: (total) => `Total ${total} items`,
          }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedEmployeeId(record.employee_id);
              setOpenResult(true);
            },
          })}
          rowClassName={() => "clickable-row"}
        />

        <PayrollApprovalResultModal
          open={openResult}
          periodId={periodId}
          employeeId={selectedEmployeeId}
          onClose={() => {
            setOpenResult(false);
            setSelectedEmployeeId(null);
            loadQueue();
          }}
        />
      </Modal>

      <BulkDeclineModal
        open={bulkDeclineOpen}
        employee={currentDeclineEmployee}
        loading={acting}
        initialReason={
          currentDeclineEmployee ? declineReasonsMap[currentDeclineEmployee.employee_id] || "" : ""
        }
        currentIndex={declineIndex}
        totalCount={declineQueue.length}
        onCancel={() => {
          resetBulkFlow();
        }}
        onSubmit={handleBulkDeclineSubmit}
      />
    </>
  );
}