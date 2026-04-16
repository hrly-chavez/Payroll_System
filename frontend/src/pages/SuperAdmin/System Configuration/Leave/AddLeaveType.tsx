"use client";

import React from "react";
import { Modal, Form, Input, Checkbox, Row, Col, InputNumber } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

// ✅ Allow only letters and spaces
const sanitizeLeaveName = (value: string) => {
  return value
    .replace(/[^A-Za-z ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\s+/g, "");
};

const leaveNameValidator = (_: any, value: string) => {
  if (!value) return Promise.resolve();

  const pattern = /^[A-Za-z ]+$/;

  if (!pattern.test(value)) {
    return Promise.reject(
      new Error("Leave name must contain letters and spaces only")
    );
  }

  return Promise.resolve();
};

export default function AddLeaveType({
  open,
  title,
  onCancel,
  onOk,
  form,
}: Props) {
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
      okButtonProps={{
        style: { backgroundColor: "#1890ff", borderColor: "#1890ff" },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        colon={false}
        labelAlign="left"
        wrapperCol={{ span: 24 }}
      >
        {/* ✅ Leave Name */}
        <Form.Item
          label="Leave Name"
          name="name"
          rules={[
            { required: true, message: "Please enter leave name" },
            { validator: leaveNameValidator },
          ]}
        >
          <Input
            placeholder="Enter leave name"
            maxLength={50}
            onChange={(e) => {
              const cleaned = sanitizeLeaveName(e.target.value);
              form.setFieldsValue({ name: cleaned });
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text");
              const cleaned = sanitizeLeaveName(pasted);
              const current = form.getFieldValue("name") || "";
              form.setFieldsValue({
                name: sanitizeLeaveName(current + cleaned),
              });
            }}
          />
        </Form.Item>

        {/* ✅ NEW: Max Days */}
        <Form.Item
          label="Max Days"
          name="max_days"
          rules={[{ required: true, message: "Please enter max days" }]}
        >
          <InputNumber
            min={1}
            style={{ width: "100%" }}
            placeholder="Enter maximum leave days"
          />
        </Form.Item>

        {/* ✅ Options */}
        <Form.Item label="Options">
          <Row gutter={16}>
            <Col>
              <Form.Item
                name="is_paid"
                valuePropName="checked"
                noStyle
                initialValue={true}
              >
                <Checkbox>Paid Leave</Checkbox>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name="requires_approval"
                valuePropName="checked"
                noStyle
                initialValue={true}
              >
                <Checkbox>Requires Approval</Checkbox>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name="is_active"
                valuePropName="checked"
                noStyle
                initialValue={true}
              >
                <Checkbox>Active</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>
      </Form>
    </Modal>
  );
}