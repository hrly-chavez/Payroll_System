// src/pages/SuperAdmin/System Configuration/Contribution/ContributionTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Spin, message, Switch, Tooltip, Modal, Input } from "antd";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddContribution from "./AddContribution";
import { editContribution } from "./EditContribution";

// ✅ ADD THIS IMPORT
import { showBackendError } from "./utils/drfErrors";

type Props = {
  active: boolean;
};

export default function ContributionTab({ active }: Props) {
  const [loading, setLoading] = useState(false);
  const [contributions, setContributions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [amountType, setAmountType] = useState<"manual" | "percent">("manual");

  // ✅ Search
  const [search, setSearch] = useState("");

  const [form] = Form.useForm();

  //  Map backend field names -> form field names
  const fieldMap: Record<string, string> = {
    code: "name",             
    name: "name",
    category: "category",
    salary_range_from: "salaryFrom",
    salary_range_to: "salaryTo",
    amount: "amount",
  };

  //  helper: "1,234.50" -> 1234.50
  const toNumber = (v: any) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  //  ALWAYS newest first (latest added on top)
  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/deductions/");
      const sorted = [...res.data].sort((a: any, b: any) => b.id - a.id);
      setContributions(sorted);
    } catch {
      message.error("Failed to fetch contributions.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchContributions();
  }, [active]);

  const openContributionModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setAmountType("manual");
    form.resetFields();
    // clear any previous server errors
    form.setFields([{ name: "nonFieldError", errors: [] }]);
    setIsModalOpen(true);
  };

  const closeContributionModal = () => {
    form.resetFields();
    setIsEditMode(false);
    setEditingId(null);
    setAmountType("manual");
    // clear any previous server errors
    form.setFields([{ name: "nonFieldError", errors: [] }]);
    setIsModalOpen(false);
  };

  const handleEditContribution = (record: any) => {
    editContribution({
      record,
      setIsEditMode,
      setEditingId,
      setAmountType,
      setIsModalOpen,
      form,
    });
  };

  //Confirm modal + status update
  const confirmToggleStatus = (record: any, nextStatus: boolean) => {
    const actionText = nextStatus ? "activate" : "deactivate";

    Modal.confirm({
      title: "Confirm Status Change",
      content: `Are you sure you want to ${actionText} this contribution?`,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      async onOk() {
        try {
          await API.patch(
            `/payroll/superadmin/deductions/${record.id}/status/`,
            { is_active: nextStatus }
          );

          message.success("Status updated");

          setContributions((prev) => {
            const updated = prev.map((item) =>
              item.id === record.id ? { ...item, is_active: nextStatus } : item
            );
            return updated.sort((a: any, b: any) => b.id - a.id);
          });
        } catch {
          message.error("Failed to update status");
        }
      },
    });
  };

  const handleSaveContribution = async () => {
    try {
      // clear server errors before validating/saving
      form.setFields([{ name: "nonFieldError", errors: [] }]);

      const values = await form.validateFields();

      const existing = contributions.find((c) => c.id === editingId);

      const salaryFromNum = toNumber(values.salaryFrom);
      const salaryToNum = toNumber(values.salaryTo);
      const amountNum = toNumber(values.amount);

      // extra safety: if somehow invalid format passes
      if (salaryFromNum === null) {
        form.setFields([{ name: "salaryFrom", errors: ["Invalid number format."] }]);
        return;
      }
      if (salaryToNum === null) {
        form.setFields([{ name: "salaryTo", errors: ["Invalid number format."] }]);
        return;
      }
      if (amountNum === null) {
        form.setFields([{ name: "amount", errors: ["Invalid number format."] }]);
        return;
      }

      const payload = {
        code: values.code,
        category: values.category,
        salary_range_from: salaryFromNum,
        salary_range_to: salaryToNum,
        calculation_type: values.amountType === "manual" ? "Fixed" : "Percent",
        amount: amountNum,

        //  PRESERVE active state during edit
        is_active: isEditMode ? existing?.is_active : true,
      };

      if (isEditMode && editingId) {
        await API.put(`/payroll/superadmin/deductions/${editingId}/`, payload);
        message.success("Contribution updated successfully");

        closeContributionModal();
        fetchContributions();
      } else {
        const res = await API.post("/payroll/superadmin/deductions/", payload);
        message.success("Contribution added successfully");

        setContributions((prev) => {
          const next = [res.data, ...prev];
          return next.sort((a: any, b: any) => b.id - a.id);
        });

        closeContributionModal();
      }
    } catch (error: any) {
      //  AntD validation error: already shown on the form fields
      if (error?.errorFields) return;

      //  Show backend real reason + highlight fields
      const res = showBackendError(error, form, fieldMap);

      message.error(res.toast);
    }
  };

  const filteredContributions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contributions;

    return contributions.filter((c) => {
      const haystack = [
        c.code,
        c.category,
        c.calculation_type,
        c.amount,
        c.salary_range_from,
        c.salary_range_to,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [contributions, search]);

  return (
    <div className="table-wrapper">
      {/* ✅ Search (left) + Add button (right) aligned in same row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contributions..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={openContributionModal}>
          Add New Contribution
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>Salary From</th>
              <th>Salary To</th>
              <th>Type</th>
              <th>Amount</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContributions.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.category || "-"}</td>
                <td>₱{c.salary_range_from}</td>
                <td>₱{c.salary_range_to}</td>
                <td>{c.calculation_type}</td>
                <td>
                  {c.calculation_type === "Percent"
                    ? `${Number(c.amount)}%`
                    : `₱${Number(c.amount).toFixed(2)}`}
                </td>

                <td
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Tooltip title={c.is_active ? "Deactivate" : "Activate"}>
                    <Switch
                      size="small"
                      checked={c.is_active}
                      onChange={(checked) => confirmToggleStatus(c, checked)}
                    />
                  </Tooltip>

                  <EditOutlined
                    onClick={() => handleEditContribution(c)}
                    style={{ cursor: "pointer" }}
                  />
                </td>
              </tr>
            ))}

            {filteredContributions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 16 }}>
                  No contributions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddContribution 
        open={isModalOpen}
        title={isEditMode ? "Edit Contribution" : "Add Contribution"}
        onCancel={closeContributionModal}
        onOk={handleSaveContribution}
        form={form}
        isEditMode={isEditMode}
        amountType={amountType}
        onAmountTypeChange={setAmountType}
      />
    </div>
  );
}
