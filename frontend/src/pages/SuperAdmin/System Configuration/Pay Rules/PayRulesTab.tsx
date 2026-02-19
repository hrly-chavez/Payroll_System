// src/pages/SuperAdmin/System Configuration/Pay Rules/PayRulesTab.tsx
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

import AddPayRules from "./AddPayRules";
import { editPayRule } from "./EditPayRules";

type Props = {
  active: boolean;
};

export default function PayRulesTab({ active }: Props) {
  const [loading, setLoading] = useState(false);

  const [payRules, setPayRules] = useState<any[]>([]);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [payRuleEditMode, setPayRuleEditMode] = useState(false);
  const [editingPayRuleId, setEditingPayRuleId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // ✅ Search
  const [search, setSearch] = useState("");

  const [payrollForm] = Form.useForm();

  const fetchDepartments = async () => {
    try {
      const res = await API.get("/employees/departments/");
      setDepartments(res.data);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch departments.");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/employees/employees/");
      setEmployees(res.data);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch employees.");
    }
  };

  // ✅ newest first (latest on top)
  const fetchPayRules = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/pay-rules/");
      const sorted = [...(res.data || [])].sort((a: any, b: any) => b.id - a.id);
      setPayRules(sorted);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch payroll rules.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchPayRules();
    fetchDepartments();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openPayrollModal = () => {
    setPayrollModalOpen(true);
    setPayRuleEditMode(false);
    setEditingPayRuleId(null);
    payrollForm.resetFields();
    payrollForm.setFieldsValue({ is_active: true }); // default for add
  };

  const closePayrollModal = () => {
    setPayrollModalOpen(false);
    setPayRuleEditMode(false);
    setEditingPayRuleId(null);
    payrollForm.resetFields();
  };

  const handleEditPayRule = (rule: any) => {
    editPayRule({
      rule,
      setPayRuleEditMode,
      setEditingPayRuleId,
      setPayrollModalOpen,
      payrollForm,
    });

    // remove "Active" checkbox in edit modal
    payrollForm.setFieldsValue({ is_active: undefined });
  };

  // ✅ Confirm modal + status patch
  const confirmToggleStatus = (rule: any, nextStatus: boolean) => {
    const actionText = nextStatus ? "activate" : "deactivate";

    Modal.confirm({
      title: "Confirm Status Change",
      content: `Are you sure you want to ${actionText} this payroll rule?`,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      async onOk() {
        try {
          await API.patch(`/payroll/superadmin/pay-rules/${rule.id}/`, {
            is_active: nextStatus,
          });

          message.success("Status updated");

          setPayRules((prev) => {
            const updated = prev.map((item) =>
              item.id === rule.id ? { ...item, is_active: nextStatus } : item
            );
            return updated.sort((a: any, b: any) => b.id - a.id);
          });
        } catch (error) {
          console.error(error);
          message.error("Failed to update status");
        }
      },
    });
  };

  const handleSavePayRule = async () => {
    try {
      const values = await payrollForm.validateFields();

      const existing = payRules.find((r) => r.id === editingPayRuleId);

      const payload = {
        name: values.name,
        event_type: values.event_type,
        category: values.category,
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

        // preserve existing active state on edit, default true on add
        is_active: payRuleEditMode ? existing?.is_active : true,
      };

      if (payRuleEditMode && editingPayRuleId) {
        const res = await API.put(
          `/payroll/superadmin/pay-rules/${editingPayRuleId}/`,
          payload
        );

        setPayRules((prev) => {
          const updated = prev.map((item) =>
            item.id === editingPayRuleId ? res.data : item
          );
          return updated.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Payroll rule updated successfully");
        closePayrollModal();
      } else {
        const res = await API.post("/payroll/superadmin/pay-rules/", payload);

        setPayRules((prev) => {
          const next = [res.data, ...prev];
          return next.sort((a: any, b: any) => b.id - a.id);
        });

        message.success("Payroll rule added successfully");
        closePayrollModal();
      }
    } catch (error) {
      console.error(error);
      message.error("Failed to save payroll rule.");
    }
  };

  const formatRateValue = (rule: any) => {
    const raw = rule?.rate_value ?? 0;
    const num = Number(raw);

    if (rule.rate_type === "MULTIPLIER") {
      return `x${Number.isFinite(num) ? num.toFixed(4) : raw}`;
    }

    const peso = `₱${Number.isFinite(num) ? num.toFixed(2) : raw}`;

    if (rule.rate_type === "PER_MINUTE") return `${peso}/min`;
    if (rule.rate_type === "PER_DAY") return `${peso}/day`;
    return peso;
  };

  const formatRateType = (value: string) => {
    if (!value) return "";
    if (value === "PER_MINUTE") return "Per Minute";
    if (value === "PER_DAY") return "Per Day";
    if (value === "FIXED") return "Fixed";
    if (value === "MULTIPLIER") return "Multiplier";
    return value;
  };

  // ✅ Search filter (keeps newest-first)
  const filteredPayRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payRules;

    return payRules
      .filter((rule) => {
        const haystack = [
          rule.name,
          rule.event_type,
          rule.category,
          formatRateType(rule.rate_type),
          formatRateValue(rule),
          rule.employee_name || rule.applies_to_name || "All",
          rule.effective_from,
          rule.effective_to,
          rule.is_active ? "active yes" : "inactive no",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a: any, b: any) => b.id - a.id);
  }, [payRules, search]);

  return (
    <div className="table-wrapper">
      {/* ✅ Search (left) + Add button (right) */}
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
          placeholder="Search payroll rules..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

        <Button type="primary" onClick={openPayrollModal}>
          Add New Payroll Rule
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Event Type</th>
              <th>Category</th>
              <th>Rate Type</th>
              <th>Rate Value</th>
              <th>Scope</th>
              <th>Effective From</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredPayRules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.event_type}</td>
                <td>{rule.category}</td>
                <td>{formatRateType(rule.rate_type)}</td>
                <td>{formatRateValue(rule)}</td>
                <td>{rule.employee_name || rule.applies_to_name || "All"}</td>
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
                    onClick={() => handleEditPayRule(rule)}
                    style={{ cursor: "pointer" }}
                  />
                </td>
              </tr>
            ))}

            {filteredPayRules.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 16 }}>
                  No payroll rules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddPayRules
        open={payrollModalOpen}
        title={payRuleEditMode ? "Edit Payroll Rule" : "Add Payroll Rule"}
        onCancel={closePayrollModal}
        onOk={handleSavePayRule}
        okText="Save"
        form={payrollForm}
        departments={departments}
        employees={employees}
      />
    </div>
  );
}
