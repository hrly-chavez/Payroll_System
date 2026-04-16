import React, { useEffect, useState } from "react";
import { Modal, Form, Select, DatePicker, Input, Button, message } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";
import styles from "./LeaveRequest.module.css";

const { RangePicker } = DatePicker;

type LeaveRequestProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const LeaveRequest: React.FC<LeaveRequestProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedLeaveType, setSelectedLeaveType] = useState<any>(null);
  const [startDate, setStartDate] = useState<any>(null);

  const maxDays = selectedLeaveType?.max_days;

  /* Fetch leave types */
  useEffect(() => {
    if (open) {
      api
        .get("/approvals/superadmin/leave-types/")
        .then((res) => setLeaveTypes(res.data))
        .catch(() => message.error("Failed to load leave types"));
    }
  }, [open]);

  const onFinish = async (values: any) => {
    if (!values.date_range) return;

    setLoading(true);

    try {
      const payload = {
        leave_type_id: values.leave_type,
        date_range: [
          values.date_range[0].format("YYYY-MM-DD"),
          values.date_range[1].format("YYYY-MM-DD"),
        ],
        reason: values.reason || "",
      };

      await api.post("/approvals/leaves/", payload);

      message.success("Leave request submitted successfully");
      form.resetFields();
      setSelectedLeaveType(null);
      setStartDate(null);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      message.error(
        error.response?.data?.detail ||
          error.response?.data?.non_field_errors?.[0] ||
          "Failed to submit leave request"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Request Leave"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      centered
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        {/* Leave Type */}
        <Form.Item
          label="Leave Type"
          name="leave_type"
          rules={[{ required: true, message: "Please select leave type" }]}
        >
          <Select
            placeholder="Select leave type"
            loading={!leaveTypes.length}
            onChange={(value) => {
              const type = leaveTypes.find((t) => t.id === value);
              setSelectedLeaveType(type);
              setStartDate(null);
              form.setFieldsValue({ date_range: null });
            }}
          >
            {leaveTypes.map((type) => (
              <Select.Option key={type.id} value={type.id}>
                {type.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* Date Range */}
        <Form.Item
          label="Date Range"
          name="date_range"
          rules={[{ required: true, message: "Please select date range" }]}
        >
          <RangePicker
            style={{ width: "100%" }}
            onCalendarChange={(dates) => {
              if (dates?.[0]) setStartDate(dates[0]);
              else setStartDate(null);
            }}
            disabledDate={(current) => {
              if (!current) return false;

              const today = dayjs().startOf("day");

              // block past dates
              if (current < today) return true;

              if (!selectedLeaveType) return false;

              if (!startDate) return false;

              const start = dayjs(startDate).startOf("day");
              const diff = current.startOf("day").diff(start, "day");

              return diff < 0 || diff > (maxDays - 1);
            }}
            onChange={(dates) => {
              if (!dates) return;

              const [from, to] = dates;

              if (from && to && maxDays) {
                const diff = to.diff(from, "day") + 1;

                if (diff > maxDays) {
                  message.warning(
                    `Maximum ${maxDays} day(s) allowed for this leave type`
                  );

                  form.setFieldsValue({
                    date_range: [from, null],
                  });

                  setStartDate(from);
                }
              }
            }}
          />
        </Form.Item>

        {/* Reason */}
        <Form.Item label="Reason" name="reason">
          <Input.TextArea rows={4} />
        </Form.Item>

        <Button
          type="primary"
          block
          htmlType="submit"
          loading={loading}
          className={styles.submitBtn}
        >
          Submit Request
        </Button>
      </Form>
    </Modal>
  );
};

export default LeaveRequest;