//src/pages/HR/Calendar/Payroll/AdditionalAllowanceModal.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Modal, Form, Select, InputNumber, DatePicker, Input, Button, message, Space } from "antd";
import api from "../../../../api/axios";
import dayjs, { Dayjs } from "dayjs";

const { TextArea } = Input;

type EligibleEmployee = {
  id: number;
  full_name: string;
  department_name?: string;
  status: "Pending" | "Verified" | "Processing" | "Approved" | "Declined";
};

type PayrollPeriod = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  pay_date?: string | null;
  status: string;
};

type AllowanceTypeOption = {
  id: number;
  name: string;
};

type Props = {
  open: boolean;
  employee: EligibleEmployee | null;
  period: PayrollPeriod | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormValues = {
  allowance_type: number;
  allowance_date: Dayjs;
  amount: number;
  remarks?: string;
};

export default function AdditionalAllowanceModal({
  open,
  employee,
  period,
  onClose,
  onSaved,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceTypeOption[]>([]);

  const loadAllowanceTypes = async () => {
    setLoadingTypes(true);
    try {
      // Reuses your existing allowance type endpoint from shared model side
      const res = await api.get("/approvals/allowance-type/");
      const rows = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAllowanceTypes(rows);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load allowance types";
      message.error(msg);
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAllowanceTypes();

      if (period?.start_date) {
        form.setFieldsValue({
          allowance_date: dayjs(period.start_date),
        });
      }
    } else {
      form.resetFields();
    }
  }, [open, period?.start_date, form]);

  const handleSubmit = async () => {
    if (!employee || !period) return;

    try {
      const values = await form.validateFields();

      setSaving(true);

      const payload = {
        allowance_type: values.allowance_type,
        allowance_date: values.allowance_date.format("YYYY-MM-DD"),
        amount: values.amount,
        remarks: values.remarks || "",
      };

      const res = await api.post(
        `/payroll/periods/${period.id}/employees/${employee.id}/allowances/`,
        payload
      );

      message.success(res?.data?.detail || "Additional allowance saved successfully.");
      form.resetFields();
      onSaved();
      onClose();
    } catch (err: any) {
      if (err?.errorFields) {
        return;
      }

      const data = err?.response?.data;
      let msg =
        data?.detail ||
        data?.message ||
        "Failed to save additional allowance";

      if (!msg && typeof data === "object" && data !== null) {
        const firstKey = Object.keys(data)[0];
        const firstVal = data[firstKey];
        if (Array.isArray(firstVal)) {
          msg = firstVal[0];
        } else if (typeof firstVal === "string") {
          msg = firstVal;
        }
      }

      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={employee ? `Add Additional Allowance: ${employee.full_name}` : "Add Additional Allowance"}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Allowance Type"
          name="allowance_type"
          rules={[{ required: true, message: "Please select an allowance type." }]}
        >
          <Select
            placeholder="Select allowance type"
            loading={loadingTypes}
            options={allowanceTypes.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          label="Allowance Date"
          name="allowance_date"
          rules={[{ required: true, message: "Please select the allowance date." }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            disabledDate={(current) => {
              if (!period) return false;

              const start = dayjs(period.start_date).startOf("day");
              const end = dayjs(period.end_date).endOf("day");

              return current.isBefore(start, "day") || current.isAfter(end, "day");
            }}
          />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[
            { required: true, message: "Please enter the amount." },
            {
              validator: async (_, value) => {
                if (value === undefined || value === null || value === "") {
                  return Promise.resolve();
                }
                if (Number(value) <= 0) {
                  return Promise.reject(new Error("Amount must be greater than 0."));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0.01}
            step={0.01}
            precision={2}
            placeholder="Enter amount"
          />
        </Form.Item>

        <Form.Item label="Remarks" name="remarks">
          <TextArea
            rows={3}
            placeholder="Optional remarks"
            maxLength={255}
          />
        </Form.Item>

        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            Save
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}