// src/pages/SuperAdmin/System Configuration/Leave/AddLeaveType.tsx
"use client";

import React from "react";
import { Modal, Form, Input, Checkbox, Row, Col } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

export default function AddLeaveType({ open, title, onCancel, onOk, form }: Props) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Save"
      centered
      width={500}
      bodyStyle={{ padding: "20px 20px" }}
      okButtonProps={{ style: { backgroundColor: "#1890ff", borderColor: "#1890ff" } }}
    >
      <Form
        form={form}
        layout="vertical"
        colon={false}
        labelAlign="left"
        wrapperCol={{ span: 24 }}
        style={{ maxWidth: "100%" }}
      >
        <Form.Item label="Leave Name" name="name" rules={[{ required: true, message: "Please enter leave name" }]}>
          <Input placeholder="Enter leave name" />
        </Form.Item>

        <Form.Item label="Pay Rate" name="pay_rate" rules={[{ required: true, message: "Please enter pay rate" }]}>
          <Input type="number" step="0.01" placeholder="Enter pay rate" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Options">
          <Row gutter={16}>
            <Col>
              <Form.Item name="is_paid" valuePropName="checked" noStyle>
                <Checkbox>Paid Leave</Checkbox>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="requires_approval" valuePropName="checked" noStyle>
                <Checkbox>Requires Approval</Checkbox>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="is_active" valuePropName="checked" noStyle>
                <Checkbox>Active</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>
      </Form>
    </Modal>
  );
}
