import { Modal, Descriptions, Button } from "antd";

interface Props {
  open: boolean;
  credentials: {
    username: string;
    password: string;
  };
  onClose: () => void;
}

const EmployeeCredentialsModal: React.FC<Props> = ({ open, credentials, onClose }) => {
  return (
    <Modal open={open} title="Employee Credentials" footer={null} onCancel={onClose}>
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Username">
          {credentials.username}
        </Descriptions.Item>
        <Descriptions.Item label="Temporary Password">
          {credentials.password}
        </Descriptions.Item>
      </Descriptions>

      <Button type="primary" block style={{ marginTop: 16 }} onClick={onClose}>
        Finish
      </Button>
    </Modal>
  );
};

export default EmployeeCredentialsModal;
