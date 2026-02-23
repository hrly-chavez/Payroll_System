import React, { useEffect } from "react";
import { Modal, Form, Input, Switch, Row, Col, Tooltip } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

const NAME_MAX = 50;

// allow letters, numbers, spaces, and common punctuation: . , & - ( )
const NAME_PATTERN = /^[a-zA-Z0-9\s.,&()\-]+$/;

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
    const currentValue = !!form.getFieldValue(fieldName);
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
      onOk={() => form.submit()} // submit form to ensure validators run
      okText="Save"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          // normalize before sending
          const payload = {
            ...values,
            name: values.name?.trim(),
          };

          // set normalized values back (optional)
          form.setFieldsValue(payload);

          // call parent onOk (your parent should read form values / submit via axios)
          onOk();
        }}
      >
        <Form.Item
          label="Commission Name"
          name="name"
          normalize={(val: string) => (typeof val === "string" ? val.replace(/\s+/g, " ") : val)} // collapse multiple spaces
          rules={[
            { required: true, message: "Name is required" },
            { max: NAME_MAX, message: `Name must be at most ${NAME_MAX} characters.` },
            {
            validator: async (_, value) => {
              const v = (value ?? "").trim();
              if (!v) return;

              if (!NAME_PATTERN.test(v)) {
                throw new Error(
                  "Name must contain letters only. Numbers and special characters are not allowed."
                );
              }
            },
          }
          ]}
        >
          <Input
            maxLength={NAME_MAX}
            placeholder="e.g. Sales Commission"
            autoComplete="off"
          />
        </Form.Item>

        {/* hidden fields */}
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