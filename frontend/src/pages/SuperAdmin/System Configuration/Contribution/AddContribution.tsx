"use client";

import React from "react";
import { Modal, Form, Input, Select } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
  isEditMode: boolean;
  amountType: "manual" | "percent";
  onAmountTypeChange: (val: "manual" | "percent") => void;
};

const sanitizeNumeric = (value: string) => {
  // ✅ allow only digits, comma, dot
  return value.replace(/[^\d.,]/g, "");
};

const numericValidator = (_: any, value: string) => {
  if (value === undefined || value === null || value === "") {
    return Promise.resolve(); // required rule handles empties
  }

  // ✅ must contain at least 1 digit, and only digits/comma/dot
  const ok = /^(?=.*\d)[0-9.,]+$/.test(value);
  if (!ok) {
    return Promise.reject(
      new Error("Numbers only. Allowed: digits, comma (,), dot (.)")
    );
  }

  return Promise.resolve();
};

export default function AddContribution({
  open,
  title,
  onCancel,
  onOk,
  form,
  isEditMode,
  amountType,
  onAmountTypeChange,
}: Props) {
  const bindNumericInput = (fieldName: string) => ({
    inputMode: "decimal" as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = sanitizeNumeric(e.target.value);
      form.setFieldsValue({ [fieldName]: cleaned });
    },
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      const cleaned = sanitizeNumeric(pasted);
      const current = form.getFieldValue(fieldName) || "";
      form.setFieldsValue({ [fieldName]: current + cleaned });
    },
  });

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Save"
      centered
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Deductions (Code)"
          name="name"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input disabled={isEditMode} />
        </Form.Item>

        <Form.Item
          label="Category"
          name="category"
          rules={[{ required: true, message: "Required" }]}
        >
          <Select placeholder="Select category">
            <Select.Option value="TAX">Tax / Government Mandatory</Select.Option>
            <Select.Option value="OTHER">Other Deduction</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Salary Range (From)"
          name="salaryFrom"
          rules={[
            { required: true, message: "Required" },
            { validator: numericValidator },
          ]}
        >
          <Input {...bindNumericInput("salaryFrom")} />
        </Form.Item>

        <Form.Item
          label="Salary Range (To)"
          name="salaryTo"
          rules={[
            { required: true, message: "Required" },
            { validator: numericValidator },
          ]}
        >
          <Input {...bindNumericInput("salaryTo")} />
        </Form.Item>

        <Form.Item
          label="Type"
          name="amountType"
          rules={[{ required: true, message: "Required" }]}
        >
          <Select onChange={(value) => onAmountTypeChange(value)}>
            <Select.Option value="manual">Fixed</Select.Option>
            <Select.Option value="percent">Percent</Select.Option>
          </Select>
        </Form.Item>

        {amountType === "manual" && (
          <Form.Item
            label="Amount (₱)"
            name="amount"
            rules={[
              { required: true, message: "Required" },
              { validator: numericValidator },
            ]}
          >
            <Input {...bindNumericInput("amount")} />
          </Form.Item>
        )}

        {amountType === "percent" && (
          <Form.Item
            label="Percent (%)"
            name="amount"
            rules={[
              { required: true, message: "Required" },
              { validator: numericValidator },
            ]}
          >
            <Input addonAfter="%" {...bindNumericInput("amount")} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
