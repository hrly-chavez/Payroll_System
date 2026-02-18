// src/pages/SuperAdmin/System Configuration/Pay Rules/PayRulesTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message, Tag, Switch, Tooltip, Modal } from "antd";
import { EditOutlined } from "@ant-design/icons";
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
      const sorted = [...res.data].sort((a: any, b: any) => b.id - a.id);
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
    // ✅ default for add
    payrollForm.setFieldsValue({ is_active: true });
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

    // ✅ remove "Active" checkbox in edit modal by forcing hidden state
    // (we will control status using the switch in Actions)
    payrollForm.setFieldsValue({ is_active: undefined });
  };

  // ✅ Confirm modal + status patch (same behavior as contributions)
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
          // 🔥 adjust if your endpoint differs
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

      // ✅ preserve existing active state on edit
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

        // ✅ on edit: keep existing is_active
        // ✅ on add: default true
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

  return (
    <div className="table-wrapper">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
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
            {payRules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.event_type}</td>
                <td>{rule.category}</td>
                <td>{formatRateType(rule.rate_type)}</td>
                <td>{formatRateValue(rule)}</td>
                <td>{rule.employee_name || rule.applies_to_name || "All"}</td>
                <td>{rule.effective_from}</td>
                {/* ✅ Actions: Switch + Edit */}
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
