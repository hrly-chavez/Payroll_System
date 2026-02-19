"use client";
import { Modal, Form, DatePicker, Button, message } from "antd";
import api from "../../../../api/axios";
import styles from "./../calendar.module.css";
import React, { useState } from "react";


const { RangePicker } = DatePicker;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPayrollPeriodModal({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const period = values?.period;
      if (!period || period.length !== 2) {
        message.error("Please select a payroll period");
        return;
      }
      const [start, end] = period;

      await api.post("/payroll/periods/", {
        start_date: start.format("YYYY-MM-DD"),
        end_date: end.format("YYYY-MM-DD"),
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
    } finally {
    setLoading(false);
  }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Add Payroll Period"  centered>
         <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="period"
            label="Select Period"
            rules={[{ required: true, message: "Please select a payroll period" }]}
          >
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>

          <Button
            type="primary"
            block
            htmlType="submit"
            loading={loading}
            className={styles.submitBtn}
          >
              Save
          </Button>
        </Form>
      </Modal>
    );
  }
