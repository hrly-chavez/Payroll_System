// src/pages/SuperAdmin/System Configuration/Pay Rules/AddPayRules.tsx
"use client";

import React from "react";
import { Modal, Form, Input, Select, DatePicker, Checkbox, Row, Col } from "antd";

const { Option } = Select;
const { RangePicker } = DatePicker;

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
        <Form.Item label="Rule Name" name="name" rules={[{ required: true }]}>
          <Input placeholder="Enter rule name" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Event Type" name="event_type" rules={[{ required: true }]}>
              <Select placeholder="Select event type">
                <Option value="Late">Late</Option>
                <Option value="Overtime">Overtime</Option>
                <Option value="Undertime">Undertime</Option>
                <Option value="Allowance">Allowance</Option>
                <Option value="Deduction">Deduction</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Category" name="category" rules={[{ required: true }]}>
              <Select placeholder="Select category">
                <Option value="Earnings">Earnings</Option>
                <Option value="Deductions">Deductions</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Rate Type" name="rate_type" rules={[{ required: true }]}>
              <Select placeholder="Select rate type">
                <Option value="Fixed">Fixed</Option>
                <Option value="Percent">Percent</Option>
                <Option value="Multiplier">Multiplier</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Rate Value" name="rate_value" rules={[{ required: true }]}>
              <Input type="number" step="0.01" placeholder="Enter value" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Applies To (Department)" name="applies_to">
              <Select allowClear placeholder="All departments">
                {departments.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Employee (Optional)" name="employee">
              <Select allowClear placeholder="All employees">
                {employees.map((e) => (
                  <Option key={e.id} value={e.id}>
                    {e.full_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Effective Dates" name="effective_dates">
          <RangePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
          <Checkbox>Active</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
