// src/pages/SuperAdmin/System Configuration/TaxRules/AddTaxRules.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Form, Input, Select, InputNumber, DatePicker, Divider, Alert } from "antd";

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

  rateTypeChoices: Choice[];
  applyModeChoices: Choice[];

  editMode: boolean;
};

export default function AddTaxRules({
  open,
  title,
  okText = "Save",
  onCancel,
  onOk,
  form,
  departments,
  employees,
  rateTypeChoices,
  applyModeChoices,
  editMode,
}: Props) {
  const [scopeType, setScopeType] = useState<"ALL" | "DEPARTMENT" | "EMPLOYEE">("ALL");

  const rateType = Form.useWatch("rate_type", form);

  // Detect scope from form values when opening (esp. for edit)
  useEffect(() => {
    if (!open) return;

    const dep = form.getFieldValue("applies_to");
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
      form.setFieldsValue({ applies_to: null, employee: null });
    }

    if (val === "DEPARTMENT") {
      form.setFieldsValue({ employee: null });
    }

    if (val === "EMPLOYEE") {
      form.setFieldsValue({ applies_to: null });
    }
  };

  const rateHint =
    rateType === "PERCENT"
        ? "Enter 15 to mean 15%. Backend stores 0.15."
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
          label="Bracket Name"
          rules={[{ required: true, message: "Please enter a bracket name." }]}
        >
          <Input placeholder="e.g. Net Pay Bracket A" />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item label="Range (Net Before Excess Tax)">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Form.Item
              name="min_amount"
              rules={[{ required: true, message: "Min amount is required." }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="Min (e.g. 50000)"
                stringMode
              />
            </Form.Item>

            <span style={{ marginTop: -22 }}>to</span>

            <Form.Item name="max_amount" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="Max (leave empty for no limit)"
                stringMode
              />
            </Form.Item>
          </div>
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item
          name="rate_type"
          label="Rate Type"
          rules={[{ required: true, message: "Please select rate type." }]}
        >
          <Select
            options={(rateTypeChoices || []).map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            placeholder="Select rate type"
          />
        </Form.Item>

        <Form.Item
          name="rate_value"
          label={rateType === "PERCENT" ? "Rate Value (%)" : "Rate Value (₱)"}
          rules={[{ required: true, message: "Please enter rate value." }]}
          extra={rateHint}
        >
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            placeholder={rateType === "PERCENT" ? "e.g. 15 (means 15%)" : "e.g. 500"}
            stringMode
          />
        </Form.Item>

        <Form.Item
          name="apply_mode"
          label="Apply Mode"
          rules={[{ required: true, message: "Please select apply mode." }]}
        >
          <Select
            options={(applyModeChoices || []).map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            placeholder="Select apply mode"
          />
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
            name="applies_to"
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