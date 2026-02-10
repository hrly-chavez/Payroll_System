"use client";

import React, { useEffect, useState } from "react";
import { Modal, Form, Select, Input, InputNumber, Button, message } from "antd";
import api from "../../../../api/axios";

type EligibleEmployee = {
  id: number;
  full_name: string;
};

type PayrollPeriod = {
  id: number;
};

type CommissionType = {
  id: number;
  name: string;
  code: string;
  is_taxable: boolean;
  is_active: boolean;
};

type Props = {
  open: boolean;
  employee: EligibleEmployee | null;
  period: PayrollPeriod | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddCommission({ open, employee, period, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<CommissionType[]>([]);

  const loadTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await api.get("/payroll/commission-types/");
      setTypes(res.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load commission types";
      message.error(msg);
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
      loadTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!employee || !period) return;

    try {
      const values = await form.validateFields();

      setSaving(true);
      const payload = {
        commission_type: values.commission_type, // id
        amount: values.amount,
        remarks: values.remarks || "",
      };

      const res = await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/commissions/`,
        payload
      );

      message.success(res?.data?.detail || "Commission saved.");
      onSaved();
      onClose();
    } catch (err: any) {
      // form validation errors shouldn't show API message
      if (err?.errorFields) return;

      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to save commission";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={employee ? `Add Commission: ${employee.full_name}` : "Add Commission"}
      width={520}
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          label="Commission Type"
          name="commission_type"
          rules={[{ required: true, message: "Please select a commission type." }]}
        >
          <Select
            loading={loadingTypes}
            placeholder="Select commission type"
            options={types.map((t) => ({
              value: t.id,
                label: t.name,
            }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[{ required: true, message: "Amount is required." }]}
        >
          <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
        </Form.Item>

        <Form.Item label="Remarks (optional)" name="remarks">
          <Input.TextArea rows={3} placeholder="Optional notes..." />
        </Form.Item>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} loading={saving} disabled={!employee || !period}>
            Save
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
