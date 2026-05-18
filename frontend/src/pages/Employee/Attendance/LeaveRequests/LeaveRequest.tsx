"use client";

import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  message,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
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

  // ✅ USE REMAINING CREDIT
  const maxDays =
    selectedLeaveType?.remaining_credit ??
    selectedLeaveType?.max_days ??
    0;

  // ✅ FETCH LEAVE TYPES WITH CREDIT
  useEffect(() => {
    if (open) {
      api
        .get("/approvals/leave-types-with-credit/")
        .then((res) => setLeaveTypes(res.data))
        .catch(() => {
          message.error("Failed to load leave types");
        });
    }
  }, [open]);

  const normFile = (e: any) => {
    if (Array.isArray(e)) return e;
    return e?.fileList;
  };

  const onFinish = async (values: any) => {
    if (!selectedLeaveType) {
      message.error("Please select leave type");
      return;
    }

    if (maxDays <= 0) {
      message.error("No remaining leave credit.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("leave_type_id", values.leave_type);

      formData.append(
        "date_range",
        values.date_range[0].format("YYYY-MM-DD")
      );

      formData.append(
        "date_range",
        values.date_range[1].format("YYYY-MM-DD")
      );

      formData.append("reason", values.reason || "");

      if (values.attachment_proof?.[0]?.originFileObj) {
        formData.append(
          "attachment_proof",
          values.attachment_proof[0].originFileObj
        );
      }

      await api.post("/approvals/leaves/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      message.success("Leave request submitted successfully");

      form.resetFields();
      setSelectedLeaveType(null);
      setStartDate(null);

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error(error);

      message.error(
        error?.response?.data?.detail ||
          error?.response?.data?.non_field_errors?.[0] ||
          "Cannot approve. One or more dates already have a leave day for this employee."
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
        {/* ✅ LEAVE TYPE */}
        <Form.Item
          label="Leave Type"
          name="leave_type"
          rules={[
            {
              required: true,
              message: "Please select leave type",
            },
          ]}
        >
          <Select
            placeholder="Select leave type"
            loading={!leaveTypes.length}
            onChange={(value) => {
              const type = leaveTypes.find((t) => t.id === value);

              setSelectedLeaveType(type);

              setStartDate(null);

              form.setFieldsValue({
                date_range: null,
              });
            }}
          >
            {leaveTypes.map((type) => (
              <Select.Option
                key={type.id}
                value={type.id}
                disabled={
                  (type.remaining_credit ?? type.max_days ?? 0) <= 0
                }
              >
                {type.name} - Remaining Credit:{" "}
                {type.remaining_credit ?? type.max_days ?? 0}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* ✅ CREDIT DISPLAY */}
        {selectedLeaveType && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              background: "#f5f5f5",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <div>
              <strong>Credit Limit:</strong>{" "}
              {selectedLeaveType.credit_limit ??
                selectedLeaveType.max_days}
            </div>

            <div>
              <strong>Used Credit:</strong>{" "}
              {selectedLeaveType.used_credit ?? 0}
            </div>

            <div>
              <strong>Remaining Credit:</strong>{" "}
              {selectedLeaveType.remaining_credit ??
                selectedLeaveType.max_days}
            </div>
          </div>
        )}

        {/* ✅ DATE RANGE */}
        <Form.Item
          label="Date Range"
          name="date_range"
          rules={[
            {
              required: true,
              message: "Please select date range",
            },
          ]}
        >
          <RangePicker
            style={{ width: "100%" }}
            onCalendarChange={(dates) => {
              if (dates?.[0]) {
                setStartDate(dates[0]);
              } else {
                setStartDate(null);
              }
            }}
            disabledDate={(current) => {
              if (!current) return false;

              const today = dayjs().startOf("day");

              const isSickLeave =
                selectedLeaveType?.name?.toLowerCase() ===
                "sick leave";

              // ✅ Sick leave can backdate 5 days
              if (isSickLeave) {
                const minDate = today.subtract(5, "day");

                if (current < minDate || current > today) {
                  return true;
                }

                return false;
              }

              // ✅ Other leave cannot backdate
              if (current < today) {
                return true;
              }

              return false;
            }}
            onChange={(dates) => {
              if (!dates) return;

              const [from, to] = dates;

              const isSickLeave =
                selectedLeaveType?.name?.toLowerCase() ===
                "sick leave";

              const today = dayjs().startOf("day");
              const yesterday = today.subtract(1, "day");

              if (!from) return;

              // ✅ SICK LEAVE LOGIC
              if (isSickLeave) {
                const isBackdated = from.isBefore(today);

                // BACKDATED
                if (isBackdated) {
                  const cappedEnd = yesterday;

                  if (!to) return;

                  if (to.isAfter(cappedEnd)) {
                    form.setFieldsValue({
                      date_range: [from, cappedEnd],
                    });

                    message.warning(
                      "Backdated sick leave can only go up to yesterday"
                    );
                  } else {
                    form.setFieldsValue({
                      date_range: [from, to],
                    });
                  }

                  return;
                }

                // TODAY FORWARD
                if (from.isSame(today, "day")) {
                  const maxEnd = from.add(maxDays - 1, "day");

                  if (to && to.isAfter(maxEnd)) {
                    message.warning(
                      `Only ${maxDays} remaining leave credit(s) available`
                    );
                  }

                  form.setFieldsValue({
                    date_range: [
                      from,
                      to && to.isAfter(maxEnd)
                        ? maxEnd
                        : to,
                    ],
                  });

                  return;
                }

                return;
              }

              // ✅ NORMAL LEAVE CREDIT LIMIT
              if (!to) return;

              const diff = to.diff(from, "day") + 1;

              if (diff > maxDays) {
                message.warning(
                  `Only ${maxDays} remaining leave credit(s) available`
                );

                form.setFieldsValue({
                  date_range: [from, null],
                });

                setStartDate(from);
              }
            }}
          />
        </Form.Item>

        {/* ✅ REASON */}
        <Form.Item
          label="Reason"
          name="reason"
          rules={[
            {
              required: true,
              message: "Please enter a reason",
            },
          ]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        {/* ✅ ATTACHMENT */}
        <Form.Item
          label="Attachment Proof"
          name="attachment_proof"
          valuePropName="fileList"
          getValueFromEvent={normFile}
          rules={[
            {
              required: true,
              message: "Please upload attachment proof",
            },
          ]}
        >
          <Upload beforeUpload={() => false} maxCount={1}>
            <Button icon={<UploadOutlined />}>
              Upload Proof
            </Button>
          </Upload>
        </Form.Item>

        {/* ✅ SUBMIT */}
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