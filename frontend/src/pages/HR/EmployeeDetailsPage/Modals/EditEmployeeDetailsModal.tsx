//src/pages/HR/EmployeeDetailPage/Modals/EditEmployeeDetailsModal.tsx
import React, { useEffect } from "react";
import { Modal, Form, Input, DatePicker, Select, message } from "antd";
import dayjs from "dayjs";
import api from "api/axios";

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

      const payload = {
        fname: values.fname,
        lname: values.lname,
        initial: values.initial || null,
        suffix: values.suffix || null,
        status: values.status,
        contact_no: values.contact_no,
        email: values.email,
        hired_date: values.hired_date ? values.hired_date.format("YYYY-MM-DD") : null,
        position: values.position,
        bank_info: values.bank_info,
      };

      await api.put(`/employees/employees/${employee.id}/update/`, payload);
      onSuccess(); // notify parent component to update state
      onClose();   // close the modal

    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.detail || "Failed to update employee");
    }
  };

  return (
    <Modal
      open={open}
      title="Edit Employee Details"
      onCancel={onClose}
      onOk={handleSave}
      okText="Save Changes"
      destroyOnClose
    >
      <Form layout="vertical" form={form}>

        {/* BASIC INFO */}
        <Form.Item label="First Name" name="fname">
          <Input />
        </Form.Item>

        <Form.Item label="Last Name" name="lname">
          <Input />
        </Form.Item>

        <Form.Item label="Initial" name="initial">
          <Input />
        </Form.Item>

        <Form.Item label="Suffix" name="suffix">
          <Input />
        </Form.Item>

        <Form.Item label="Civil Status" name="status">
          <Select>
            <Option value="SINGLE">Single</Option>
            <Option value="MARRIED">Married</Option>
            <Option value="WIDOWED">Widowed</Option>
            <Option value="SEPARATED">Separated</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Contact No" name="contact_no">
          <Input />
        </Form.Item>

        <Form.Item label="Email" name="email">
          <Input />
        </Form.Item>

        <Form.Item label="Position" name="position">
          <Input />
        </Form.Item>

        <Form.Item label="Bank Info" name="bank_info">
          <Input />
        </Form.Item>

        <Form.Item label="Hired Date" name="hired_date">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default EditEmployeeDetailsModal;
