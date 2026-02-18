import {
  Modal,
  Form,
  Input,
  TimePicker,
  InputNumber,
  Switch,
  message,
  Row,
  Col,
  Tooltip,
} from "antd";
import api from "../../../../api/axios";
import { useEffect } from "react";
import dayjs from "dayjs";

const EditShift = ({ open, onClose, shift, refresh }: any) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (shift) {
      form.setFieldsValue({
        ...shift,
        start_time: dayjs(shift.start_time, "HH:mm"),
        end_time: dayjs(shift.end_time, "HH:mm"),
        // ensure booleans exist (avoid undefined issues)
        is_overnight: !!shift.is_overnight,
        is_active: shift.is_active ?? true,
      });
    }
  }, [shift, form]);

  const confirmToggle = (fieldName: "is_overnight" | "is_active") => {
    const currentValue = !!form.getFieldValue(fieldName);
    const nextValue = !currentValue;

    const messageText =
      fieldName === "is_active"
        ? currentValue
          ? "Are you sure you want to deactivate this shift?"
          : "Are you sure you want to activate this shift?"
        : currentValue
        ? "Are you sure you want to remove overnight from this shift?"
        : "Are you sure you want to mark this shift as overnight?";

    Modal.confirm({
      title: "Confirm Change",
      content: messageText,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      onOk() {
        form.setFieldsValue({ [fieldName]: nextValue });
      },
    });
  };

  const onFinish = async (values: any) => {
    await api.put(`attendance/shifts/${shift.id}/`, {
      ...values,
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),
    });

    message.success("Shift updated");
    onClose();
    refresh();
  };

  return (
    <Modal
      title="Edit Shift"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label="Shift Name" required>
          <Input />
        </Form.Item>

        <Form.Item name="start_time" label="Start Time" required>
          <TimePicker format="HH:mm" />
        </Form.Item>

        <Form.Item name="end_time" label="End Time" required>
          <TimePicker format="HH:mm" />
        </Form.Item>

        <Form.Item name="break_minutes" label="Break Minutes">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="grace_minutes" label="Grace Minutes">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        {/* ✅ Keep values in form, but NOT bind switches directly (prevents toggle lock) */}
        <Form.Item name="is_overnight" initialValue={false} hidden>
          <Input />
        </Form.Item>

        <Form.Item name="is_active" initialValue={true} hidden>
          <Input />
        </Form.Item>

        {/* ✅ Overnight + Active side by side with hover + confirm */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Overnight">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_overnight");

                  return (
                    <Tooltip title={value ? "Remove Overnight" : "Mark as Overnight"}>
                      <Switch checked={value} onClick={() => confirmToggle("is_overnight")} />
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
                      <Switch checked={value} onClick={() => confirmToggle("is_active")} />
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

export default EditShift;
