"use client";

import React, { useEffect, useState } from "react";
import { Modal, Form, Checkbox, Row, Col, InputNumber, Select } from "antd";
import API from "../../../../api/axios";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

export default function AddLeaveCreditMax({
  open,
  title,
  onCancel,
  onOk,
  form,
}: Props) {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  const fetchLeaveTypes = async () => {
    try {
      const res = await API.get("/approvals/superadmin/leave-types/");
      setLeaveTypes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLeaveTypes();
    }
  }, [open]);

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
        <Form.Item
          label="Leave Type"
          name="leave_type"
          rules={[{ required: true, message: "Please select leave type" }]}
        >
          <Select placeholder="Select leave type">
            {leaveTypes.map((leave) => (
              <Select.Option key={leave.id} value={leave.id}>
                {leave.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Max Credit"
          name="max_credit"
          rules={[{ required: true, message: "Please enter max credit" }]}
        >
          <InputNumber
            min={1}
            style={{ width: "100%" }}
            placeholder="Enter maximum leave credit"
          />
        </Form.Item>

        <Form.Item label="Options">
          <Row gutter={16}>
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