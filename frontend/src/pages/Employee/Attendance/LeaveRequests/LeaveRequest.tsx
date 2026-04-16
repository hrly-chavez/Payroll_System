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
            const isSickLeave =
              selectedLeaveType?.name?.toLowerCase() === "sick leave";

            if (isSickLeave) {
              const minDate = today.subtract(5, "day");

              // allow only last 5 days + today
              if (current < minDate || current > today) return true;
              return false;
            }

            // normal leave: no past dates
            if (current < today) return true;

            return false;
          }}
          onChange={(dates) => {
            if (!dates) return;

            const [from, to] = dates;

            const isSickLeave =
              selectedLeaveType?.name?.toLowerCase() === "sick leave";

            const today = dayjs().startOf("day");
            const yesterday = today.subtract(1, "day");

            if (!from) return;

            // =========================
            // 🟢 SICK LEAVE LOGIC
            // =========================
            if (isSickLeave) {
              const isBackdated = from.isBefore(today);

              // =========================
              // 🟢 BACKDATED SICK LEAVE
              // =========================
              if (isBackdated) {
                const cappedEnd = yesterday;

                // If user hasn't selected end date yet → don't force anything
                if (!to) return;

                // Only adjust if invalid
                if (to.isAfter(cappedEnd)) {
                  form.setFieldsValue({
                    date_range: [from, cappedEnd],
                  });

                  message.warning(
                    "Backdated sick leave can only go up to yesterday"
                  );
                } else {
                  // ✅ keep user's selected end date
                  form.setFieldsValue({
                    date_range: [from, to],
                  });
                }

                return;
              }
              // =========================
              // 🟢 TODAY SICK LEAVE → APPLY maxDays FORWARD
              // =========================
              if (from.isSame(today, "day")) {
                if (!maxDays) return;

                const maxEnd = from.add(maxDays - 1, "day"); 
                // example: maxDays = 3 → today + 2 days

                if (to && to.isAfter(maxEnd)) {
                  message.warning(
                    `Sick leave allows up to ${maxDays} day(s) starting today`
                  );
                }

                form.setFieldsValue({
                  date_range: [from, to && to.isAfter(maxEnd) ? maxEnd : to],
                });

                return;
              }

              return;
            }

            // =========================
            // 🟡 NORMAL LEAVE
            // =========================
            if (!to || !maxDays) return;

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
          }}
        />
        </Form.Item>

        {/* Reason */}
        <Form.Item label="Reason" name="reason"
        rules={[{ required: true, message: "Please enter a reason" }]}>
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