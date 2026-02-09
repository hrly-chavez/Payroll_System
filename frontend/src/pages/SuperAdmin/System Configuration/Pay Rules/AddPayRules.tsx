// src/pages/SuperAdmin/System Configuration/Pay Rules/AddPayRules.tsx
"use client";

import React from "react";
import { Modal, Form, Input, Select, DatePicker, Checkbox, Row, Col } from "antd";

const { Option } = Select;

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

export default function AddPayRules({
  open,
  title,
  onCancel,
  onOk,
  okText = "Save",
  form,
  departments,
  employees,
}: Props) {
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
              <Select placeholder="Select event type">
                <Option value="Late">Late</Option>
                <Option value="Undertime">Undertime</Option>
                <Option value="Overtime">Overtime</Option>
                <Option value="Night Differential">Night Differential</Option>
                <Option value="Regular Holiday">Regular Holiday</Option>
                <Option value="Special Holiday">Special Holiday</Option>
                <Option value="Special Non Working Holiday">Special Non Working Holiday</Option>
                <Option value="Company Holiday">Company Holiday</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Category"
              name="category"
              rules={[{ required: true, message: "Category is required" }]}
            >
              <Select placeholder="Select category">
                <Option value="Earning">Earning</Option>
                <Option value="Deduction">Deduction</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="Rate Type"
              name="rate_type"
              rules={[{ required: true, message: "Rate type is required" }]}
            >
              <Select placeholder="Select rate type">
                <Option value="FIXED">Fixed</Option>
                <Option value="PER_MINUTE">Per Minute</Option>
                <Option value="PER_DAY">Per Day</Option>
                <Option value="MULTIPLIER">Multiplier</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Rate Value"
              name="rate_value"
              rules={[{ required: true, message: "Rate value is required" }]}
            >
              <Input type="number" step="0.01" placeholder="Enter value" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Applies To (Department)" name="applies_to">
              <Select
                allowClear
                placeholder="All departments"
                onChange={(value) => {
                  if (value) form.setFieldsValue({ employee: null });
                }}
              >
                {departments.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Applies To (Employee)" name="employee">
              <Select
                allowClear
                placeholder="All employees"
                onChange={(value) => {
                  if (value) form.setFieldsValue({ applies_to: null });
                }}
              >
                {employees.map((e) => (
                  <Option key={e.id} value={e.id}>
                    {e.full_name}
                  </Option>
                ))}
              </Select>
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
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Effective To (Optional)" name="effective_to">
              <DatePicker style={{ width: "100%" }} />
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
