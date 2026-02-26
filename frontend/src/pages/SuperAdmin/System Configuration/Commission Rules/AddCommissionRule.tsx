// src/pages/SuperAdmin/System Configuration/Commission Rules/AddCommissionRule.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Spin,
  InputNumber,
} from "antd";
import api from "../../../../api/axios";
import dayjs, { Dayjs } from "dayjs";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  okText?: string;
  form: any;

  departments: any[];
  employees: any[];
  commissionTypes: any[];
};

type Choice = { value: string; label: string };

export default function AddCommissionRule({
  open,
  title,
  onCancel,
  onOk,
  okText = "Save",
  form,
  departments,
  employees,
  commissionTypes,
}: Props) {
  const [rateTypes, setRateTypes] = useState<Choice[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(false);

  const rateType = Form.useWatch("rate_type", form);
  const isMultiplier = rateType === "MULTIPLIER";

  const rateLabel = isMultiplier ? "Multiplier" : "Rate Value";
  const rateHelp = isMultiplier
    ? "Example: 0.10 means 10% of commission amount, 0.05 means 5%"
    : "Enter exact peso amount to withhold for this bracket.";

  const isEditMode = title.toLowerCase().includes("edit");

  const today = dayjs().startOf("day");

  const disablePastDates = (current: Dayjs) => {
    return current && current.startOf("day").isBefore(today);
  };

  const disableEffectiveTo = (current: Dayjs) => {
    const from = form.getFieldValue("effective_from") as Dayjs | null;

    if (current && current.startOf("day").isBefore(today)) return true;
    if (from) return current.isBefore(from.startOf("day"));
    return false;
  };

  useEffect(() => {
    const fetchChoices = async () => {
      try {
        setLoadingChoices(true);
        const res = await api.get("/payroll/superadmin/commission-tax-rules/choices/");
        setRateTypes(res.data?.rate_type_choices || []);
      } finally {
        setLoadingChoices(false);
      }
    };

    if (open) fetchChoices();
  }, [open]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText}
      centered
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Rule Name"
          name="name"
          rules={[
            { required: true, message: "Rule name is required" },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                const valid = /^[A-Za-z0-9\s_-]+$/.test(value);
                if (!valid) {
                  return Promise.reject(
                    new Error("Only letters, numbers, spaces, underscore and dash are allowed.")
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="Enter rule name" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Commission Type"
              name="commission_type"
              rules={[{ required: true, message: "Commission type is required" }]}
            >
              <Select
                placeholder="Select commission type"
                options={commissionTypes.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Rate Type"
              name="rate_type"
              rules={[{ required: true, message: "Rate type is required" }]}
            >
              <Select
                placeholder="Select rate type"
                loading={loadingChoices}
                options={rateTypes}
                notFoundContent={loadingChoices ? <Spin size="small" /> : null}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Min Amount"
              name="min_amount"
              rules={[
                { required: true, message: "Min amount is required" },
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null || value === "") return Promise.resolve();
                    const n = Number(value);
                    if (isNaN(n)) return Promise.reject(new Error("Invalid number"));
                    if (n < 0) return Promise.reject(new Error("Min amount cannot be negative"));
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber<string>
                style={{ width: "100%" }}
                stringMode
                step="0.01"
                addonBefore="₱"
                placeholder="0.00"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Max Amount (Optional)"
              name="max_amount"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const min = getFieldValue("min_amount");
                    if (value === undefined || value === null || value === "") return Promise.resolve();
                    const a = Number(min);
                    const b = Number(value);
                    if (!isNaN(a) && !isNaN(b) && b < a) {
                      return Promise.reject(new Error("Max amount cannot be less than min amount."));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <InputNumber<string>
                style={{ width: "100%" }}
                stringMode
                step="0.01"
                addonBefore="₱"
                placeholder="Leave empty for open-ended"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={rateLabel}
          name="rate_value"
          help={rateHelp}
          validateTrigger="onChange"
          rules={[
            { required: true, message: isMultiplier ? "Multiplier is required" : "Rate value is required" },
            {
              validator: (_, value) => {
                if (value === undefined || value === null || value === "") return Promise.resolve();
                const n = Number(value);
                if (isNaN(n)) return Promise.reject(new Error("Only numbers are allowed."));
                if (n <= 0) return Promise.reject(new Error("Value must be greater than 0."));
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber<string>
            style={{ width: "100%" }}
            stringMode
            step={isMultiplier ? "0.0001" : "0.01"}
            addonBefore={isMultiplier ? "x" : "₱"}
            placeholder={isMultiplier ? "e.g. 0.05, 0.10" : "Enter amount"}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Applies To (Department)"
              name="applies_to"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value && getFieldValue("employee")) {
                      return Promise.reject(
                        new Error("Choose either Department or Employee, not both.")
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Select
                allowClear
                placeholder="All departments"
                onChange={(value) => {
                  if (value) form.setFieldsValue({ employee: null });
                }}
                options={departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Applies To (Employee)"
              name="employee"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value && getFieldValue("applies_to")) {
                      return Promise.reject(
                        new Error("Choose either Department or Employee, not both.")
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Select
                allowClear
                placeholder="All employees"
                onChange={(value) => {
                  if (value) form.setFieldsValue({ applies_to: null });
                }}
                options={employees.map((e) => ({
                  value: e.id,
                  label:
                    e.full_name ||
                    `${e.fname || ""} ${e.lname || ""}`.trim() ||
                    `Employee #${e.id}`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Effective From"
              name="effective_from"
              rules={[{ required: true, message: "Effective from is required" }]}
            >
              <DatePicker
                style={{ width: "100%" }}
                format="YYYY-MM-DD"
                disabledDate={disablePastDates}
                onChange={() => {
                  const from = form.getFieldValue("effective_from");
                  const to = form.getFieldValue("effective_to");
                  if (from && to && dayjs(to).isBefore(dayjs(from), "day")) {
                    form.setFieldsValue({ effective_to: null });
                  }
                }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Effective To (Optional)" name="effective_to">
              <DatePicker
                style={{ width: "100%" }}
                format="YYYY-MM-DD"
                disabledDate={disableEffectiveTo}
              />
            </Form.Item>
          </Col>
        </Row>

        {!isEditMode && (
          <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}