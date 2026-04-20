//src/pages/HR/EmployeeDetailPage/Modals/EditEmployeeDetailsModal.tsx
import React, { useEffect } from "react";
import { Modal, Form, Input, DatePicker, Select, message, Row, Col, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../../../api/axios";
const { TextArea } = Input;


type Props = {
  open: boolean;
  employee: any;
  onClose: () => void;
  onSuccess: () => void;
};

const { Option } = Select;

const EditEmployeeDetailsModal: React.FC<Props> = ({
  open,
  employee,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  // -----------------------------
  // Populate form values
  // -----------------------------
  useEffect(() => {
    if (open && employee) {
      form.setFieldsValue({
        fname: employee.fname,
        lname: employee.lname,
        initial: employee.initial,
        suffix: employee.suffix,
        status: employee.status,
        contact_no: employee.contact_no,
        email: employee.email,
        hired_date: employee.hired_date ? dayjs(employee.hired_date) : null,
        position: employee.position,
        bank_info: employee.bank_info,
      });
    }
  }, [open, employee, form]);

  // -----------------------------
  // Save handler
  // -----------------------------
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // CHECK EMAIL FIRST
      const checkResponse = await api.get(
        `/employees/employees/check-email/?email=${values.email}&employee_id=${employee.id}`
      );

      if (checkResponse.data.exists) {
        message.error("An employee with this email already exists.");
        return; // STOP UPDATE
      }

      const formData = new FormData();

      Object.keys(values).forEach((key) => {
        if (key === "profile_picture") {
          if (values.profile_picture?.[0]?.originFileObj) {
            formData.append("profile_picture", values.profile_picture[0].originFileObj);
          }
        } else if (key === "hired_date") {
          formData.append(
            "hired_date",
            values.hired_date ? values.hired_date.format("YYYY-MM-DD") : ""
          );
        } else {
          formData.append(key, values[key] ?? "");
        }
      });

      await api.put(
        `/employees/employees/${employee.id}/update/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error(err);
      message.error(
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        "Failed to update employee"
      );
    }
  };
  // from .env
  const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace("/api", "");

  return (
    <Modal
      open={open}
      title="Edit Employee Details"
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Changes"
      destroyOnClose
      width={900}          // Wider modal
      centered={false}     // Disable vertical centering
      style={{ top: 50 }}  // Push modal higher
    >

      <img
        src={`${BASE_URL}${employee.profile_picture}`}
        alt="Profile"
        style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }}
      />
      <Form layout="vertical" form={form}>
        <Row gutter={16}>

          <Col xs={24} md={12}>
            <Form.Item label="Profile Picture" name="profile_picture" valuePropName="fileList" getValueFromEvent={(e) => e.fileList}>
              <Upload
                beforeUpload={() => false} // prevent auto upload
                maxCount={1}
                accept=".jpeg,.jpg,.png"
                listType="picture"
              >
                <button type="button">
                  <UploadOutlined /> Change Picture
                </button>
              </Upload>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="First Name" name="fname">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Last Name" name="lname">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Initial" name="initial">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Suffix" name="suffix">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Civil Status" name="status">
              <Select>
                <Option value="SINGLE">Single</Option>
                <Option value="MARRIED">Married</Option>
                <Option value="WIDOWED">Widowed</Option>
                <Option value="SEPARATED">Separated</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Contact No" name="contact_no">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Email" name="email">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Position" name="position">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Bank Info" name="bank_info">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Hired Date" name="hired_date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          {/* Full width reason field */}
          <Col span={24}>
            <Form.Item
              label="Reason for Change"
              name="reason"
              rules={[
                { required: true, message: "Please provide a reason for this change" }
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="Why are you making these changes?"
              />
            </Form.Item>
          </Col>

        </Row>
      </Form>
    </Modal>
  );
};

export default EditEmployeeDetailsModal;
