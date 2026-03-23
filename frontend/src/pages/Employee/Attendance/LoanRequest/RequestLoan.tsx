//src/pages/Employee/Attendance/LoanRequest/RequestLoan.tsx

"use client";

import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Alert,
} from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export default function RequestLoan({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        name: values.name,
        principal_amount: String(values.principal_amount),
        effective_from: values.effective_from
          ? values.effective_from.format("YYYY-MM-DD")
          : null,
        effective_to: values.effective_to
          ? values.effective_to.format("YYYY-MM-DD")
          : null,
        remarks: values.remarks || "",
      };

      await api.post("/approvals/loans/", payload);

      message.success("Loan request submitted successfully.");
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (error: any) {
      if (error?.errorFields) return;

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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request Loan"
      onCancel={handleClose}
      onOk={handleSubmit}
      okText="Submit Request"
      confirmLoading={submitting}
      centered
      destroyOnClose={false}
      maskClosable={false}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Your request will be submitted for SuperAdmin approval."
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Loan Name"
          rules={[{ required: true, message: "Please enter the loan name." }]}
        >
          <Input placeholder="e.g. Emergency Loan" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="principal_amount"
          label="Requested Amount"
          rules={[{ required: true, message: "Please enter the requested amount." }]}
        >
          <InputNumber
            min={0}
            style={{ width: "100%" }}
            placeholder="e.g. 5000"
            stringMode
          />
        </Form.Item>

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true, message: "Please select the effective date." }]}
          initialValue={dayjs()}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        {/* <Form.Item
          name="effective_to"
          label="Effective To (optional)"
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item> */}

        <Form.Item
          name="remarks"
          label="Remarks (optional)"
        >
          <Input.TextArea
            rows={4}
            placeholder="Add any notes for your loan request"
            maxLength={1000}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}