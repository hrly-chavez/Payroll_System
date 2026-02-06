// src/pages/SuperAdmin/System Configuration/Pay Rules/PayRulesTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message } from "antd";
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

  const fetchPayRules = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/pay-rules/");
      setPayRules([...res.data].reverse());
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
  };


  const handleSavePayRule = async () => {
    try {
      const values = await payrollForm.validateFields();
      const [effective_from, effective_to] = values.effective_dates || [];

      const payload = {
        name: values.name,
        event_type: values.event_type,
        category: values.category,
        rate_type: values.rate_type,
        rate_value: parseFloat(values.rate_value),
        applies_to: values.applies_to || null,
        employee: values.employee || null,
        effective_from: effective_from ? effective_from.format("YYYY-MM-DD") : null,
        effective_to: effective_to ? effective_to.format("YYYY-MM-DD") : null,
        is_active: values.is_active ?? true,
      };

      if (payRuleEditMode && editingPayRuleId) {
        await API.put(`/payroll/superadmin/pay-rules/${editingPayRuleId}/`, payload);
        setPayRules((prev) => prev.map((item) => (item.id === editingPayRuleId ? { ...item, ...payload } : item)));
        message.success("Payroll rule updated successfully");
      } else {
        const res = await API.post("/payroll/superadmin/pay-rules/", payload);
        setPayRules((prev) => [res.data, ...prev]);
        message.success("Payroll rule added successfully");
      }

      closePayrollModal();
    } catch (error) {
      console.error(error);
      message.error("Failed to save payroll rule.");
    }
  };

  return (
    <div className="table-wrapper">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
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
              <th>Rule Name</th>
              <th>Event Type</th>
              <th>Category</th>
              <th>Rate Type</th>
              <th>Rate Value</th>
              <th>Scope</th>
              <th>Effective From</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payRules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.event_type}</td>
                <td>{rule.category}</td>
                <td>{rule.rate_type}</td>
                <td>₱{rule.rate_value}</td>
                <td>{rule.applies_to_name || "All"}</td>
                <td>{rule.effective_from}</td>
                <td className="actions">
                  <EditOutlined onClick={() => handleEditPayRule(rule)} />
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
