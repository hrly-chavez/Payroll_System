import React, { useEffect } from "react";
import { Modal, Form, Input, Switch, Row, Col, Tooltip } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

const AddCommissionType: React.FC<Props> = ({
  open,
  title,
  onCancel,
  onOk,
  form,
}) => {
  useEffect(() => {
    if (!open) form.resetFields();
  }, [open, form]);

  const confirmToggle = (fieldName: "is_taxable" | "is_active") => {
    const currentValue = !!form.getFieldValue(fieldName); // BLUE=true, GRAY=false
    const nextValue = !currentValue;

    const message =
      fieldName === "is_active"
        ? currentValue
          ? "Are you sure you want to deactivate the commission type?"
          : "Are you sure you want to activate the commission type?"
        : currentValue
        ? "Are you sure you want to deactivate taxable for this commission type?"
        : "Are you sure you want to activate taxable for this commission type?";

    Modal.confirm({
      title: "Confirm Change",
      content: message,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      onOk() {
        form.setFieldsValue({ [fieldName]: nextValue });
      },
    });
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onOk}
      okText="Save"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Commission Name"
          name="name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Code"
          name="code"
          rules={[{ required: true, message: "Code is required" }]}
        >
          <Input />
        </Form.Item>

        {/* ✅ keep these values in the form, but hidden (so Switch won't auto-toggle) */}
        <Form.Item name="is_taxable" initialValue={false} hidden>
          <Input />
        </Form.Item>

        <Form.Item name="is_active" initialValue={true} hidden>
          <Input />
        </Form.Item>

        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="Taxable">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_taxable");
                  return (
                    <Tooltip title={value ? "Deactivate" : "Activate"}>
                      <Switch
                        checked={value}
                        onClick={() => confirmToggle("is_taxable")}
                      />
                    </Tooltip>
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Active">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_active");
                  return (
                    <Tooltip title={value ? "Deactivate" : "Activate"}>
                      <Switch
                        checked={value}
                        onClick={() => confirmToggle("is_active")}
                      />
                    </Tooltip>
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default AddCommissionType;
