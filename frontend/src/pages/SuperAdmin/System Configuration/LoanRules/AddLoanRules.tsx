//src/pages/SuperAdmin/System Configuration/LoanRules/AddLoanRules.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Form, Input, Select, InputNumber, DatePicker, Divider } from "antd";

type Choice = { value: string; label: string };

type Props = {
  open: boolean;
  title: string;
  okText?: string;
  onCancel: () => void;
  onOk: () => void;

  form: any;

  departments: any[];
  employees: any[];

  deductionModeChoices: Choice[];
  applyToCutoffChoices: Choice[];

  editMode: boolean;
};

export default function AddLoanRules({
  open,
  title,
  okText = "Save",
  onCancel,
  onOk,
  form,
  departments,
  employees,
  deductionModeChoices,
  applyToCutoffChoices,
  editMode,
}: Props) {
  const [scopeType, setScopeType] = useState<"ALL" | "DEPARTMENT" | "EMPLOYEE">("ALL");

  const deductionMode = Form.useWatch("deduction_mode", form);

  useEffect(() => {
    if (!open) return;

    const dep = form.getFieldValue("department");
    const emp = form.getFieldValue("employee");

    if (emp) setScopeType("EMPLOYEE");
    else if (dep) setScopeType("DEPARTMENT");
    else setScopeType("ALL");
  }, [open, form]);

  const departmentOptions = useMemo(() => {
    return (departments || []).map((d: any) => ({
      value: d.id,
      label: d.name,
    }));
  }, [departments]);

  const employeeOptions = useMemo(() => {
    return (employees || []).map((e: any) => ({
      value: e.id,
      label: e.full_name || `${e.fname ?? ""} ${e.lname ?? ""}`.trim(),
    }));
  }, [employees]);

  const onScopeChange = (val: "ALL" | "DEPARTMENT" | "EMPLOYEE") => {
    setScopeType(val);

    if (val === "ALL") {
      form.setFieldsValue({ department: null, employee: null });
    }

    if (val === "DEPARTMENT") {
      form.setFieldsValue({ employee: null });
    }

    if (val === "EMPLOYEE") {
      form.setFieldsValue({ department: null });
    }
  };

  const deductionHint =
    deductionMode === "PERCENT"
      ? "Enter 30 to mean 30%.Backend stores 0.30"
      : "Fixed amount is stored as peso value.";

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText}
      centered
      destroyOnClose={false}
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Loan Rule Name"
          rules={[{ required: true, message: "Please enter a loan rule name." }]}
        >
          <Input placeholder="e.g. Standard Employee Loan Rule" />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item label="Scope">
          <Select
            value={scopeType}
            onChange={onScopeChange}
            options={[
              { value: "ALL", label: "All" },
              { value: "DEPARTMENT", label: "Department" },
              { value: "EMPLOYEE", label: "Employee" },
            ]}
          />
        </Form.Item>

        {scopeType === "DEPARTMENT" && (
          <Form.Item
            name="department"
            label="Department"
            rules={[{ required: true, message: "Please select a department." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={departmentOptions}
              placeholder="Select department"
            />
          </Form.Item>
        )}

        {scopeType === "EMPLOYEE" && (
          <Form.Item
            name="employee"
            label="Employee"
            rules={[{ required: true, message: "Please select an employee." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={employeeOptions}
              placeholder="Select employee"
            />
          </Form.Item>
        )}

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item
          name="deduction_mode"
          label="Deduction Mode"
          rules={[{ required: true, message: "Please select deduction mode." }]}
        >
          <Select
            options={(deductionModeChoices || []).map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            placeholder="Select deduction mode"
          />
        </Form.Item>

        <Form.Item
          name="deduction_value"
          label={deductionMode === "PERCENT" ? "Deduction Value (%)" : "Deduction Value (₱)"}
          rules={[{ required: true, message: "Please enter deduction value." }]}
          extra={deductionHint}
        >
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            placeholder={
              deductionMode === "PERCENT"
                ? "e.g. 15"
                : "e.g. 1000"
            }
            stringMode
          />
        </Form.Item>

        <Form.Item
          name="apply_to_cutoff"
          label="Apply To Cutoff"
          rules={[{ required: true, message: "Please select cutoff rule." }]}
        >
          <Select
            options={(applyToCutoffChoices || []).map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            placeholder="Select cutoff"
          />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true, message: "Effective from is required." }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="effective_to" label="Effective To (optional)">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}