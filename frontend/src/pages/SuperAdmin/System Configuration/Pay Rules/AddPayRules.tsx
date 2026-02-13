//src/pages/SuperAdmin/System Configuration/Pay Rules/AddPayRules.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, DatePicker, Checkbox, Row, Col, Spin, InputNumber } from "antd";
import api from "../../../../api/axios";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  okText?: string;
  form: any;

  departments: any[];
  employees: any[];
};

type Choice = { value: string; label: string };

export default function AddPayRules({open,title,onCancel,onOk,okText = "Save",form,departments,employees,}: Props) {

  const [eventTypes, setEventTypes] = useState<Choice[]>([]);
  const [categories, setCategories] = useState<Choice[]>([]);
  const [rateTypes, setRateTypes] = useState<Choice[]>([]);
  const [loadingChoices, setLoadingChoices] = useState(false);

  const rateType = Form.useWatch("rate_type", form);
  const isMultiplier = rateType === "MULTIPLIER";

  const rateLabel = isMultiplier ? "Multiplier" : "Rate Value";
  const rateHelp = isMultiplier
    ? "Example: 1 = 100% of base (daily_rate/hourly_rate), 1.5 = 150%"
    : "Enter exact peso amount based on rate type (e.g., ₱10 per minute).";


  useEffect(() => {
    const fetchChoices = async () => {
      try {
        setLoadingChoices(true);
        const res = await api.get("/payroll/superadmin/pay-rules/choices/");

        setEventTypes(res.data?.event_type_choices || []);
        setCategories(res.data?.category_choices || []);
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
      width={650}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Rule Name" name="name" rules={[{ required: true, message: "Rule name is required" }]}>
          <Input placeholder="Enter rule name" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Event Type"
              name="event_type"
              rules={[{ required: true, message: "Event type is required" }]}
            >
              <Select
                placeholder="Select event type"
                loading={loadingChoices}
                options={eventTypes}
                notFoundContent={loadingChoices ? <Spin size="small" /> : null}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Category" name="category" rules={[{ required: true, message: "Category is required" }]}>
              <Select
                placeholder="Select category"
                loading={loadingChoices}
                options={categories}
                notFoundContent={loadingChoices ? <Spin size="small" /> : null}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Rate Type" name="rate_type" rules={[{ required: true, message: "Rate type is required" }]}>
              <Select
                placeholder="Select rate type"
                loading={loadingChoices}
                options={rateTypes}
                notFoundContent={loadingChoices ? <Spin size="small" /> : null}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={rateLabel}
              name="rate_value"
              help={rateHelp}
              rules={[{ required: true, message: isMultiplier ? "Multiplier is required" : "Rate value is required" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                step={isMultiplier ? 0.0001 : 0.01}
                stringMode
                addonBefore={isMultiplier ? "x" : "₱"}
                placeholder={isMultiplier ? "e.g. 1, 1.5, 2" : "Enter amount"}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Applies To (Department)"name="applies_to"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value && getFieldValue("employee")) {
                        return Promise.reject(new Error("Choose either Department or Employee, not both."));
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
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Applies To (Employee)"name="employee"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value && getFieldValue("applies_to")) {
                      return Promise.reject(new Error("Choose either Department or Employee, not both."));
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
                label: e.full_name || `${e.fname || ""} ${e.lname || ""}`.trim() || `Employee #${e.id}`,
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
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />

            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Effective To (Optional)" name="effective_to">
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
          <Checkbox>Active</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
