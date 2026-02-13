"use client";

import React from "react";
import { Modal, Form, DatePicker, ColorPicker, Button, message } from "antd";
import api from "../../../../api/axios";

const { RangePicker } = DatePicker;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPayrollPeriodModal({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    try {
      const period = values?.period;
      if (!period || period.length !== 2) {
        message.error("Please select a payroll period");
        return;
      }
      const [start, end] = period;

      await api.post("/payroll/periods/", {
        start_date: start.format("YYYY-MM-DD"),
        end_date: end.format("YYYY-MM-DD"),
        color: values.color?.toHexString?.() || "#ff4d4f",
      });

      message.success("Payroll period created");
      form.resetFields();
      onClose();
      onSuccess();
    } catch (err: any) {
      console.error("SERVER ERROR:", err?.response?.data || err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to create payroll period";
      message.error(msg);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Add Payroll Period">
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="period"
          label="Select Period"
          rules={[{ required: true, message: "Please select a payroll period" }]}
        >
          <RangePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="color" label="Color">
          <ColorPicker />
        </Form.Item>

        <Button type="primary" htmlType="submit" block>
          Save
        </Button>
      </Form>
    </Modal>
  );
}
