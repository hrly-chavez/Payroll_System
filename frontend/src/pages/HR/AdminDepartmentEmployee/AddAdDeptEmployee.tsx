import React from "react";
import { Modal, Form, Input, Select, Button } from "antd";
import styles from "./AddAdDeptEmployee.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddAddDeptEmployee: React.FC<Props> = ({ open, onClose }) => {
  return (
    <Modal
      title="Employee Details"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className={styles.modal}
    >
      <Form layout="vertical" className={styles.form}>
        <Form.Item label="Employee Number" name="empno">
          <Input placeholder="Employee Number" />
        </Form.Item>

        <Form.Item label="First Name" name="fname">
          <Input placeholder="First Name" />
        </Form.Item>

        <Form.Item label="Middle Name" name="mname">
          <Input placeholder="Middle Name" />
        </Form.Item>

        <Form.Item label="Last Name" name="lname">
          <Input placeholder="Last Name" />
        </Form.Item>

        <Form.Item label="Address" name="address">
          <Input placeholder="address" />
        </Form.Item>

        <Form.Item label="Contact Number" name="contactno">
          <Input placeholder="Contact Number" />
        </Form.Item>

        <div className={styles.actions}>
          <Button type="primary" className={styles.saveBtn}>
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddAddDeptEmployee;
