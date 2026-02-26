// src/pages/SuperAdmin/System Configuration/Commission Rules/CommissionRuleTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Spin,
  message,
  Switch,
  Tooltip,
  Modal,
  Input,
} from "antd";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddCommissionRule from "./AddCommissionRule";
import { editCommissionRule } from "./EditCommissionRule";

type Props = {
  active: boolean;
};

// same DRF error extractor pattern
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

export default function CommissionRuleTab({ active }: Props) {
  const [loading, setLoading] = useState(false);

  const [rules, setRules] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [commissionTypes, setCommissionTypes] = useState<any[]>([]);

  const [search, setSearch] = useState("");

  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    try {
      const res = await API.get("/employees/departments/");
      setDepartments(res.data || []);
    } catch (error: any) {
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/employees/employees/");
      setEmployees(res.data || []);
    } catch (error: any) {
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchCommissionTypes = async () => {
    try {
      const res = await API.get("/payroll/commission-types/active/");
      setCommissionTypes(res.data || []);
    } catch (error: any) {
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/commission-tax-rules/");
      const sorted = [...(res.data || [])].sort((a: any, b: any) => b.id - a.id);
      setRules(sorted);
    } catch (error: any) {
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchRules();
    fetchDepartments();
    fetchEmployees();
    fetchCommissionTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openModal = () => {
    setModalOpen(true);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleEdit = (rule: any) => {
    editCommissionRule({
      rule,
      setEditMode,
      setEditingId,
      setModalOpen,
      form,
    });

    // hide Active checkbox on edit like PayRulesTab
    form.setFieldsValue({ is_active: undefined });
  };

  const confirmToggleStatus = (rule: any, nextStatus: boolean) => {
    const actionText = nextStatus ? "activate" : "deactivate";

    Modal.confirm({
      title: "Confirm Status Change",
      content: `Are you sure you want to ${actionText} this commission rule?`,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      async onOk() {
        try {
          await API.patch(`/payroll/superadmin/commission-tax-rules/${rule.id}/`, {
            is_active: nextStatus,
          });

          message.success("Status updated");

          setRules((prev) => {
            const updated = prev.map((item) =>
              item.id === rule.id ? { ...item, is_active: nextStatus } : item
            );
            return updated.sort((a: any, b: any) => b.id - a.id);
          });
        } catch (error: any) {
          const parsed = extractDRFError(error);
          message.error(parsed.text);
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const existing = rules.find((r) => r.id === editingId);

      const payload = {
        name: values.name,
        commission_type: values.commission_type,

        min_amount: String(values.min_amount ?? "0.00"),
        max_amount:
          values.max_amount === undefined || values.max_amount === null || values.max_amount === ""
            ? null
            : String(values.max_amount),

        rate_type: values.rate_type,
        rate_value: String(values.rate_value),

        applies_to: values.applies_to || null,
        employee: values.employee || null,

        effective_from: values.effective_from
          ? values.effective_from.format("YYYY-MM-DD")
          : null,
        effective_to: values.effective_to
          ? values.effective_to.format("YYYY-MM-DD")
          : null,

        // preserve active on edit
        is_active: editMode ? existing?.is_active : true,
      };

      if (editMode && editingId) {
        const res = await API.put(
          `/payroll/superadmin/commission-tax-rules/${editingId}/`,
          payload
        );

        setRules((prev) => {
          const updated = prev.map((item) => (item.id === editingId ? res.data : item));
          return updated.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Commission rule updated successfully");
        closeModal();
      } else {
        const res = await API.post("/payroll/superadmin/commission-tax-rules/", payload);

        setRules((prev) => {
          const next = [res.data, ...prev];
          return next.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Commission rule added successfully");
        closeModal();
      }
    } catch (error: any) {
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

  const getCommissionTypeName = (rule: any) => {
    return rule.commission_type_name || rule.commission_type?.name || `#${rule.commission_type}`;
  };

  const formatBracket = (rule: any) => {
    const min = rule.min_amount ?? "0.00";
    const max = rule.max_amount ? rule.max_amount : "∞";
    return `${min} - ${max}`;
  };

  const formatRateType = (value: string) => {
    if (!value) return "";
    if (value === "MULTIPLIER") return "Multiplier";
    if (value === "FIXED") return "Fixed";
    return value;
  };

  const formatRateValue = (rule: any) => {
    const raw = rule?.rate_value ?? 0;
    const num = Number(raw);

    if (rule.rate_type === "MULTIPLIER") {
      return `x${Number.isFinite(num) ? num.toFixed(4) : raw}`;
    }

    return `₱${Number.isFinite(num) ? num.toFixed(2) : raw}`;
  };

  const formatScope = (rule: any) => {
    return rule.employee_name || rule.applies_to_name || "All";
  };

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;

    return rules
      .filter((r) => {
        const haystack = [
          r.name,
          getCommissionTypeName(r),
          formatBracket(r),
          formatRateType(r.rate_type),
          formatRateValue(r),
          formatScope(r),
          r.effective_from,
          r.effective_to,
          r.is_active ? "active yes" : "inactive no",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a: any, b: any) => b.id - a.id);
  }, [rules, search]);

  return (
    <div className="table-wrapper">
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
          placeholder="Search commission rules..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={openModal}>
          Add New Commission Rule
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Commission Type</th>
              <th>Bracket</th>
              <th>Rate Type</th>
              <th>Rate Value</th>
              <th>Scope</th>
              <th>Effective From</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{getCommissionTypeName(rule)}</td>
                <td>{formatBracket(rule)}</td>
                <td>{formatRateType(rule.rate_type)}</td>
                <td>{formatRateValue(rule)}</td>
                <td>{formatScope(rule)}</td>
                <td>{rule.effective_from}</td>

                <td
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Tooltip title={rule.is_active ? "Deactivate" : "Activate"}>
                    <Switch
                      size="small"
                      checked={rule.is_active}
                      onChange={(checked) => confirmToggleStatus(rule, checked)}
                    />
                  </Tooltip>

                  <EditOutlined
                    onClick={() => handleEdit(rule)}
                    style={{ cursor: "pointer" }}
                  />
                </td>
              </tr>
            ))}

            {filteredRules.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 16 }}>
                  No commission rules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddCommissionRule
        open={modalOpen}
        title={editMode ? "Edit Commission Rule" : "Add Commission Rule"}
        onCancel={closeModal}
        onOk={handleSave}
        okText="Save"
        form={form}
        departments={departments}
        employees={employees}
        commissionTypes={commissionTypes}
      />
    </div>
  );
}