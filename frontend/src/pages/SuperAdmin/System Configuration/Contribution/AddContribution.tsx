// src/pages/SuperAdmin/System Configuration/Contribution/AddContribution.tsx
"use client";

import React from "react";
import { Modal, Form, Input, Select, Checkbox } from "antd";

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
          rules={[{ required: true }]}
        >
          <Input disabled={isEditMode} />
        </Form.Item>

        <Form.Item
          label="Category"
          name="category"
          rules={[{ required: true }]}
        >
          <Select placeholder="Select category">
            <Select.Option value="TAX">
              Tax / Government Mandatory
            </Select.Option>
            <Select.Option value="OTHER">
              Other Deduction
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Salary Range (From)"
          name="salaryFrom"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Salary Range (To)"
          name="salaryTo"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Type"
          name="amountType"
          rules={[{ required: true }]}
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
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
        )}

        {amountType === "percent" && (
          <Form.Item
            label="Percent (%)"
            name="amount"
            rules={[
              { required: true },
              { type: "number", min: 0, max: 100, transform: Number },
            ]}
          >
            <Input addonAfter="%" />
          </Form.Item>
        )}


      </Form>
    </Modal>
  );
}
