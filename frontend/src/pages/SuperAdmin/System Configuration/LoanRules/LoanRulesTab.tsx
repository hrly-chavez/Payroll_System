//src/pages/SuperAdmin/System Configuration/LoanRules/LoanRulesTab.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Spin, message, Switch, Tooltip, Modal, Input } from "antd";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";
import AddLoanRules from "./AddLoanRules";
import { editLoanRule } from "./EditLoanRules";

type Props = {
  active: boolean;
};

type Choice = { value: string; label: string };

type LoanRuleRow = {
  id: number;
  name: string;

  department: number | null;
  department_name?: string | null;

  employee: number | null;
  employee_name?: string | null;

  deduction_mode: "FIXED" | "PERCENT";
  deduction_value: string;

  apply_to_cutoff: "FIRST" | "SECOND" | "BOTH";

  effective_from: string;
  effective_to: string | null;

  is_active: boolean;
  created_at?: string | null;
};

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

export default function LoanRulesTab({ active }: Props) {
  const [loading, setLoading] = useState(false);

  const [loanRules, setLoanRules] = useState<LoanRuleRow[]>([]);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [deductionModeChoices, setDeductionModeChoices] = useState<Choice[]>([]);
  const [applyToCutoffChoices, setApplyToCutoffChoices] = useState<Choice[]>([]);

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
      const res = await API.get("/payroll/superadmin/loan-rules/choices/");
      setDeductionModeChoices(res.data?.deduction_mode_choices || []);
      setApplyToCutoffChoices(res.data?.apply_to_cutoff_choices || []);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
  };

  const fetchLoanRules = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/loan-rules/");
      const sorted = [...(res.data || [])].sort((a: any, b: any) => b.id - a.id);
      setLoanRules(sorted);
    } catch (error: any) {
      console.error(error);
      const parsed = extractDRFError(error);
      message.error(parsed.text);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchLoanRules();
    fetchDepartments();
    fetchEmployees();
    fetchChoices();
  }, [active]);

  const openModal = () => {
    setLoanModalOpen(true);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();

    form.setFieldsValue({
      is_active: true,
      deduction_mode: "FIXED",
      deduction_value: 0,
      apply_to_cutoff: "BOTH",
      department: null,
      employee: null,
    });
  };

  const closeModal = () => {
    setLoanModalOpen(false);
    setEditMode(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleEdit = (row: LoanRuleRow) => {
    editLoanRule({
      rule: row,
      setEditMode,
      setEditingId,
      setLoanModalOpen,
      form,
    });
  };

  const confirmToggleStatus = (row: LoanRuleRow, nextStatus: boolean) => {
    const actionText = nextStatus ? "activate" : "deactivate";

    Modal.confirm({
      title: "Confirm Status Change",
      content: `Are you sure you want to ${actionText} this loan rule?`,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      async onOk() {
        try {
          await API.patch(`/payroll/superadmin/loan-rules/${row.id}/status/`, {
            is_active: nextStatus,
          });

          message.success("Status updated");

          setLoanRules((prev) => {
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

      const existing = loanRules.find((r) => r.id === editingId);

      const payload = {
        name: values.name,
        department: values.department || null,
        employee: values.employee || null,
        deduction_mode: values.deduction_mode,
        deduction_value:
        values.deduction_mode === "PERCENT"
            ? String(Number(values.deduction_value) / 100) // UI 15 -> backend 0.15
            : String(values.deduction_value),
        apply_to_cutoff: values.apply_to_cutoff,
        effective_from: values.effective_from
          ? values.effective_from.format("YYYY-MM-DD")
          : null,
        effective_to: values.effective_to
          ? values.effective_to.format("YYYY-MM-DD")
          : null,
        is_active: editMode ? existing?.is_active : true,
      };

      if (editMode && editingId) {
        const res = await API.put(
          `/payroll/superadmin/loan-rules/${editingId}/`,
          payload
        );

        setLoanRules((prev) => {
          const updated = prev.map((item) => (item.id === editingId ? res.data : item));
          return updated.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Loan rule updated successfully");
        closeModal();
      } else {
        const res = await API.post("/payroll/superadmin/loan-rules/", payload);

        setLoanRules((prev) => {
          const next = [res.data, ...prev];
          return next.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Loan rule added successfully");
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

  const formatDeductionMode = (value: string) => {
    if (value === "FIXED") return "Fixed";
    if (value === "PERCENT") return "Percent";
    return value;
  };

  const formatDeductionValue = (row: LoanRuleRow) => {
    const num = Number(row.deduction_value ?? 0);
    if (!Number.isFinite(num)) return String(row.deduction_value ?? "");

    if (row.deduction_mode === "PERCENT") {
        return `${(num * 100).toFixed(2)}%`;
    }

    return formatMoney(num);
    };

  const formatApplyToCutoff = (value: string) => {
    if (value === "FIRST") return "First Cutoff";
    if (value === "SECOND") return "Second Cutoff";
    if (value === "BOTH") return "Both";
    return value;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loanRules;

    return loanRules
      .filter((row) => {
        const haystack = [
          row.name,
          formatDeductionMode(row.deduction_mode),
          formatDeductionValue(row),
          formatApplyToCutoff(row.apply_to_cutoff),
          row.employee_name || row.department_name || "All",
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
  }, [loanRules, search]);

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
          placeholder="Search loan rules..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={openModal}>
          Add New Loan Rule
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Deduction Mode</th>
              <th>Deduction Value</th>
              <th>Apply To Cutoff</th>
              <th>Scope</th>
              <th>Effective From</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatDeductionMode(row.deduction_mode)}</td>
                <td>{formatDeductionValue(row)}</td>
                <td>{formatApplyToCutoff(row.apply_to_cutoff)}</td>
                <td>{row.employee_name || row.department_name || "All"}</td>
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
                <td colSpan={7} style={{ textAlign: "center", padding: 16 }}>
                  No loan rules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddLoanRules
        open={loanModalOpen}
        title={editMode ? "Edit Loan Rule" : "Add Loan Rule"}
        onCancel={closeModal}
        onOk={handleSave}
        okText="Save"
        form={form}
        departments={departments}
        employees={employees}
        deductionModeChoices={deductionModeChoices}
        applyToCutoffChoices={applyToCutoffChoices}
        editMode={editMode}
      />
    </div>
  );
}