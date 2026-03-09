//src/pages/SuperAdmin/Dashboard/ExcessTimeDetailModal.tsx
import React from "react";
import { Modal, Button, Spin, Tag, Descriptions, Input, Row, Col, Space } from "antd";
import dayjs from "dayjs";
import type { ExcessTimeRequest } from "./types";

const { TextArea } = Input;

interface Props {
  visible: boolean;
  excessTime: ExcessTimeRequest | null;
  onClose: () => void;
  onApproveAsOvertime: () => void;
  onApproveAsOffset: () => void;
  onDecline: () => void;
}

const ExcessTimeDetailModal: React.FC<Props> = ({
  visible,
  excessTime,
  onClose,
  onApproveAsOvertime,
  onApproveAsOffset,
  onDecline,
}) => {
  const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "-");

  const statusTag = (status: ExcessTimeRequest["status"]) => {
    if (status === "Approved") return <Tag color="green">Approved</Tag>;
    if (status === "Declined") return <Tag color="red">Declined</Tag>;
    return <Tag color="gold">Pending</Tag>;
  };

  const resolutionTag = (resolutionType: ExcessTimeRequest["resolution_type"]) => {
    if (resolutionType === "Overtime") return <Tag color="blue">Overtime</Tag>;
    if (resolutionType === "Offset") return <Tag color="purple">Offset</Tag>;
    return <Tag>-</Tag>;
  };

  return (
    <Modal
      title="Excess Time Detail"
      open={visible}
      onCancel={onClose}
      width={720}
      centered
      getContainer={false}
      footer={
        excessTime?.status === "Pending"
          ? [
              <Button key="decline" danger onClick={onDecline}>
                Decline
              </Button>,
              <Button key="approve-offset" onClick={onApproveAsOffset}>
                Approve as Offset
              </Button>,
              <Button
                key="approve-overtime"
                type="primary"
                onClick={onApproveAsOvertime}
              >
                Approve as Overtime
              </Button>,
            ]
          : [
              <Button key="close" onClick={onClose}>
                Close
              </Button>,
            ]
      }
    >
      {!excessTime ? (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <Spin tip="Loading..." />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions
            bordered
            size="middle"
            column={2}
            labelStyle={{ width: 140, fontWeight: 600 }}
          >
            <Descriptions.Item label="Employee">
              {excessTime.name}
            </Descriptions.Item>

            <Descriptions.Item label="Date">
              {dayjs(excessTime.attendance_date).format("MMM DD, YYYY")}
            </Descriptions.Item>

            <Descriptions.Item label="Minutes">
              {excessTime.minutes} min
            </Descriptions.Item>

            <Descriptions.Item label="Start - End">
              {fmtTime(excessTime.start_time)} - {fmtTime(excessTime.end_time)}
            </Descriptions.Item>

            <Descriptions.Item label="Department">
              {excessTime.department_name ?? "-"}
            </Descriptions.Item>

            <Descriptions.Item label="Shift">
              {excessTime.shift_name ?? "-"}
            </Descriptions.Item>

            <Descriptions.Item label="Resolution">
              {resolutionTag(excessTime.resolution_type)}
            </Descriptions.Item>

            <Descriptions.Item label="Status">
              {statusTag(excessTime.status)}
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={[12, 12]}>
            <Col span={24}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {excessTime.status === "Declined" ? "Decline Reason" : "Remarks"}
              </div>
              <TextArea
                value={excessTime.remarks ?? ""}
                rows={5}
                readOnly
              />
            </Col>
          </Row>
        </Space>
      )}
    </Modal>
  );
};

export default ExcessTimeDetailModal;