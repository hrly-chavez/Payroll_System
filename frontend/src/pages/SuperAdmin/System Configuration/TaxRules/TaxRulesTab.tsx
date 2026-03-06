// src/pages/SuperAdmin/System Configuration/TaxRules/TaxRulesTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Spin, message, Switch, Tooltip, Modal, Input } from "antd";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";
import { editTaxRule } from "./EditTaxRules";
import AddTaxRules from "./AddTaxRules";

type Props = {
  active: boolean;
};

type Choice = { value: string; label: string };

type TaxBracketRow = {
  id: number;
  name: string;

  min_amount: string;
  max_amount: string | null;

  rate_type: "PERCENT" | "FIXED";
  rate_value: string;

  apply_mode: "EXCESS_ONLY" | "ALWAYS";

  effective_from: string;
  effective_to: string | null;

  is_active: boolean;

  applies_to: number | null;
  applies_to_name?: string | null;

  employee: number | null;
  employee_name?: string | null;

  created_at?: string | null;
};

//  Extract exact DRF error message (and field errors)
const extractDRFError = (
  err: any
): { text: string; fieldErrors?: Record<string, string[]> } => {
  const data = err?.response?.data;

  if (!data) return { text: err?.message || "Unknown error" };

  if (typeof data === "string") return { text: data };

  if (Array.isArray(data)) return { text: data.map(String).join(" ") };

  if (typeof data?.detail === "string") return { text: data.detail };

  if (typeof data === "object") {
    const fieldErrors: Record<string, string[]> = {};
    const parts: string[] = [];

    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        fieldErrors[key] = val.map(String);
        parts.push(`${key}: ${val.map(String).join(" ")}`);
      } else if (typeof val === "string") {
        fieldErrors[key] = [val];
        parts.push(`${key}: ${val}`);
      } else {
        parts.push(`${key}: ${JSON.stringify(val)}`);
      }
    }

    return {
      text: parts.join(" | ") || "Validation error",
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
  }

  return { text: "Unknown error format" };
};

export default function TaxRulesTab({ active }: Props) {
  const [loading, setLoading] = useState(false);

  const [taxBrackets, setTaxBrackets] = useState<TaxBracketRow[]>([]);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [rateTypeChoices, setRateTypeChoices] = useState<Choice[]>([]);
  const [applyModeChoices, setApplyModeChoices] = useState<Choice[]>([]);

  const [search, setSearch] = useState("");

  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    try {
      const res = await API.get("/employees/departments/");
      setDepartments(res.data || []);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/employees/employees/");
      setEmployees(res.data || []);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchChoices = async () => {
    try {
      const res = await API.get("/payroll/superadmin/payroll-tax-brackets/choices/");
      setRateTypeChoices(res.data?.rate_type_choices || []);
      setApplyModeChoices(res.data?.apply_mode_choices || []);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchTaxBrackets = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/payroll-tax-brackets/");
      const sorted = [...(res.data || [])].sort((a: any, b: any) => b.id - a.id);
      setTaxBrackets(sorted);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchTaxBrackets();
    fetchDepartments();
    fetchEmployees();
    fetchChoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openModal = () => {
    setTaxModalOpen(true);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();

    // defaults for Add
    form.setFieldsValue({
      is_active: true,
      apply_mode: "EXCESS_ONLY",
      rate_type: "PERCENT",
      rate_value: 0,
      min_amount: 0,
      max_amount: null,
    });
  };

  const closeModal = () => {
    setTaxModalOpen(false);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleEdit = (row: TaxBracketRow) => {
    editTaxRule({
        rule: row,
        setEditMode,
        setEditingId,
        setTaxModalOpen,
        form,
    });
    };

  const confirmToggleStatus = (row: TaxBracketRow, nextStatus: boolean) => {
    const actionText = nextStatus ? "activate" : "deactivate";

    Modal.confirm({
      title: "Confirm Status Change",
      content: `Are you sure you want to ${actionText} this tax bracket?`,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      async onOk() {
        try {
          await API.patch(`/payroll/superadmin/payroll-tax-brackets/${row.id}/`, {
            is_active: nextStatus,
          });

          message.success("Status updated");

          setTaxBrackets((prev) => {
            const updated = prev.map((item) =>
              item.id === row.id ? { ...item, is_active: nextStatus } : item
            );
            return updated.sort((a: any, b: any) => b.id - a.id);
          });
        } catch (error: any) {
          console.error(error);
          const parsed = extractDRFError(error);
          message.error(parsed.text);
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const existing = taxBrackets.find((r) => r.id === editingId);

      const payload = {
        name: values.name,

        min_amount: String(values.min_amount),
        max_amount: values.max_amount === null || values.max_amount === undefined || values.max_amount === ""
          ? null
          : String(values.max_amount),

        rate_type: values.rate_type,
        rate_value:
        values.rate_type === "PERCENT"
            ? String(Number(values.rate_value) / 100) // UI 15 -> backend 0.15
            : String(values.rate_value),

        apply_mode: values.apply_mode,

        applies_to: values.applies_to || null,
        employee: values.employee || null,

        effective_from: values.effective_from
          ? values.effective_from.format("YYYY-MM-DD")
          : null,
        effective_to: values.effective_to
          ? values.effective_to.format("YYYY-MM-DD")
          : null,

        // preserve existing active state on edit, default true on add
        is_active: editMode ? existing?.is_active : true,
      };

      if (editMode && editingId) {
        const res = await API.put(
          `/payroll/superadmin/payroll-tax-brackets/${editingId}/`,
          payload
        );

        setTaxBrackets((prev) => {
          const updated = prev.map((item) => (item.id === editingId ? res.data : item));
          return updated.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Tax bracket updated successfully");
        closeModal();
      } else {
        const res = await API.post("/payroll/superadmin/payroll-tax-brackets/", payload);

        setTaxBrackets((prev) => {
          const next = [res.data, ...prev];
          return next.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Tax bracket added successfully");
        closeModal();
      }
    } catch (error: any) {
      console.error(error);

      const parsed = extractDRFError(error);
      message.error(parsed.text);

      if (parsed.fieldErrors) {
        const fields = Object.entries(parsed.fieldErrors).map(([name, errors]) => ({
          name,
          errors,
        }));
        form.setFields(fields);
      }
    }
  };

  const formatMoney = (val: any) => {
    const num = Number(val ?? 0);
    if (!Number.isFinite(num)) return String(val ?? "");
    return `₱${num.toFixed(2)}`;
  };

  const formatRange = (row: TaxBracketRow) => {
    const min = formatMoney(row.min_amount);
    const max = row.max_amount ? formatMoney(row.max_amount) : "∞";
    return `${min} - ${max}`;
  };

  const formatRate = (row: TaxBracketRow) => {
    const num = Number(row.rate_value ?? 0);
    if (!Number.isFinite(num)) return String(row.rate_value ?? "");

    if (row.rate_type === "PERCENT") {
    // stored as 0.15 for 15%
    return `${(num * 100).toFixed(2)}%`;
    }
    return formatMoney(num);
  };

  const formatApplyMode = (value: string) => {
    if (value === "EXCESS_ONLY") return "Excess Only";
    if (value === "ALWAYS") return "Always";
    return value;
  };

  const formatRateType = (value: string) => {
    if (value === "PERCENT") return "Percent";
    if (value === "FIXED") return "Fixed";
    return value;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taxBrackets;

    return taxBrackets
      .filter((row) => {
        const haystack = [
          row.name,
          formatRange(row),
          formatRateType(row.rate_type),
          formatRate(row),
          formatApplyMode(row.apply_mode),
          row.employee_name || row.applies_to_name || "All",
          row.effective_from,
          row.effective_to || "",
          row.is_active ? "active yes" : "inactive no",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a: any, b: any) => b.id - a.id);
  }, [taxBrackets, search]);

  return (
    <div className="table-wrapper">
      {/* Search + Add */}
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
          placeholder="Search tax brackets..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={openModal}>
          Add New Tax Bracket
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Bracket Name</th>
              <th>Range</th>
              <th>Rate Type</th>
              <th>Rate</th>
              <th>Apply Mode</th>
              <th>Scope</th>
              <th>Effective From</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatRange(row)}</td>
                <td>{formatRateType(row.rate_type)}</td>
                <td>{formatRate(row)}</td>
                <td>{formatApplyMode(row.apply_mode)}</td>
                <td>{row.employee_name || row.applies_to_name || "All"}</td>
                <td>{row.effective_from}</td>

                <td
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Tooltip title={row.is_active ? "Deactivate" : "Activate"}>
                    <Switch
                      size="small"
                      checked={row.is_active}
                      onChange={(checked) => confirmToggleStatus(row, checked)}
                    />
                  </Tooltip>

                  <EditOutlined
                    onClick={() => handleEdit(row)}
                    style={{ cursor: "pointer" }}
                  />
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 16 }}>
                  No tax brackets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddTaxRules
        open={taxModalOpen}
        title={editMode ? "Edit Tax Bracket" : "Add Tax Bracket"}
        onCancel={closeModal}
        onOk={handleSave}
        okText="Save"
        form={form}
        departments={departments}
        employees={employees}
        rateTypeChoices={rateTypeChoices}
        applyModeChoices={applyModeChoices}
        editMode={editMode}
      />
    </div>
  );
}