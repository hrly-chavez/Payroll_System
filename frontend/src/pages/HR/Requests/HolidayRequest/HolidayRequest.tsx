"use client";

import React, { useEffect, useState } from "react";
import { Table, Tag, Button, Space, message, Modal, Input, Select } from "antd";
import api from "../../../../api/axios";
import styles from "./HolidayRequest.module.css";
import type { ColumnsType } from "antd/es/table";

const { TextArea } = Input;

interface HolidayRequest {
  id: number;

  employee?: string;
  details?: string;
  reason?: string;

  name: string;
  date: string;
  type: string;
  base: string;
  remarks?: string;

  status: string;
  created_at: string;
}

const HolidayRequests: React.FC = () => {
  const [dataSource, setDataSource] = useState<HolidayRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HolidayRequest | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    date: "",
    type: "",
    base: "",
    remarks: "",
  });

  // FETCH ONLY HOLIDAY REQUESTS
  const fetchHolidayRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/all-requests/");
      
      
      const holidayRequests = res.data.filter(
        (r: any) => r.model === "holiday"
      );

      setDataSource(holidayRequests);
    } catch (err) {
      message.error("Failed to fetch holiday requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidayRequests();
  }, []);

  const columns: ColumnsType<HolidayRequest> = [
    {
      title: "Employee",
      dataIndex: "employee",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Request Type",
      dataIndex: "type",
      responsive: ["xs", "sm", "md", "lg"],
      render: () => <Tag color="purple">Holiday</Tag>,
    },
    {
      title: "Details",
      dataIndex: "details",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Reason",
      dataIndex: "reason",
      responsive: ["xs", "sm", "md", "lg"],
    },
    {
      title: "Status",
      dataIndex: "status",
      responsive: ["xs", "sm", "md", "lg"],
      render: (status: string) => {
        const color =
          status === "Pending"
            ? "gold"
            : status === "Approved"
            ? "green"
            : "red";

        return <Tag color={color}>{status}</Tag>;
      },
    },

    // SHOW ACTION COLUMN ONLY IF THERE IS AN APPROVED RECORD
    ...(dataSource.some((item) => item.status === "Approved")
      ? [
          {
            title: "Action",
            width: 160,
            render: (_: any, record: any) => {
              // ONLY SHOW BUTTONS IF APPROVED
              if (record.status !== "Approved") return null;

              return (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <Button
                    type="primary"
                    size="small"
                    onClick={async (e) => {
                      e.stopPropagation();

                      try {
                        // FETCH ACTUAL HOLIDAY DATA
                        const res = await api.get(
                          `/approvals/superadmin/holidays/${record.id}/`
                        );

                        const holiday = res.data;

                        setSelectedRecord(holiday);

                        // POPULATE MODAL
                        setEditForm({
                          name: holiday.name || "",
                          date: holiday.date || "",
                          type: holiday.type || "",
                          base: holiday.base || "",
                          remarks: holiday.remarks || "",
                        });

                        setEditModalOpen(true);

                      } catch (err) {
                        console.log(err);

                        message.error("Failed to fetch holiday data");
                      }
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    danger
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();

                      Modal.confirm({
                        title: "Delete Holiday Request",
                        content:
                          "Are you sure you want to delete this request?",
                        okText: "Delete",
                        okButtonProps: { danger: true },

                        onOk: async () => {
                          try {
                            await api.delete(
                              `/approvals/superadmin/holidays/${record.id}/`
                            );

                            message.success("Deleted successfully");

                            fetchHolidayRequests();
                          } catch {
                            message.error("Delete failed");
                          }
                        },
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];


  const sortedData = [...dataSource].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  const handleEditSubmit = async () => {
    try {
      await api.patch(
        `/approvals/superadmin/holidays/${selectedRecord?.id}/`,
        editForm
      );

      message.success("Holiday updated successfully");

      setEditModalOpen(false);

      fetchHolidayRequests();

    } catch (err: any) {
      console.log(err);

      message.error("Update failed");
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* GENERATE HOLIDAYS BUTTON */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <Button
          type="primary"
          onClick={() => {
            Modal.confirm({
              title: "Generate Holidays",
              content:
                "Generate holidays for next year?",

              okText: "Generate",

              onOk: async () => {
                try {

                  const nextYear =
                    new Date().getFullYear() + 1;

                  const res = await api.post(
                    "/approvals/generate-holidays/",
                    {
                      year: nextYear,
                    }
                  );

                  message.success(
                    res.data.message ||
                    "Holidays generated successfully"
                  );

                  fetchHolidayRequests();

                } catch (err) {
                  console.log(err);

                  message.error(
                    "Failed to generate holidays"
                  );
                }
              },
            });
          }}
        >
          Generate Next Year Holidays
        </Button>
      </div>

      <Table
        columns={columns}        
        rowKey={(record) => `holiday-${record.id}`}
        loading={loading}
        dataSource={sortedData}
        onRow={(record) => ({
          onClick: () => {
            setSelectedRecord(record);
            setViewModalOpen(true); // open modal
          },
          style: { cursor: "pointer" },
        })}
        scroll={{ x: "max-content" }}

        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
      />

      <Modal
        title="Holiday Request Details"
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setSelectedRecord(null);
        }}
        footer={null}
        centered
        destroyOnClose
      >
        {selectedRecord && (
          <div className={styles.modalGrid}>
            <div>
              <strong>Employee:</strong> {selectedRecord.employee}
            </div>
            <div>
              <strong>Details:</strong> {selectedRecord.details}
            </div>
            <div>
              <strong>Reason:</strong> {selectedRecord.reason}
            </div>
            <div>
              <strong>Status:</strong> {selectedRecord.status}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Edit Holiday"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        okText="Save"
        centered
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* HOLIDAY NAME */}
          <Input
            placeholder="Holiday Name"
            value={editForm.name}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                name: e.target.value,
              })
            }
          />

          {/* DATE */}
          <Input
            type="date"
            value={editForm.date}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                date: e.target.value,
              })
            }
          />

          {/* TYPE */}
          <Select
            placeholder="Select Holiday Type"
            value={editForm.type}
            onChange={(value) =>
              setEditForm({
                ...editForm,
                type: value,
              })
            }
            options={[
              { value: "Regular", label: "Regular" },
              {
                value: "Special Non-Working",
                label: "Special Non-Working",
              },
              {
                value: "Special Working",
                label: "Special Working",
              },
              {
                value: "Company Holiday",
                label: "Company Holiday",
              },
            ]}
          />

          {/* BASE */}
          <Select
            placeholder="Select Base"
            value={editForm.base}
            onChange={(value) =>
              setEditForm({
                ...editForm,
                base: value,
              })
            }
            options={[
              { value: "PH", label: "Philippines" },
              { value: "US", label: "United States" },
              { value: "COMPANY", label: "Company" },
            ]}
          />

          {/* REMARKS */}
          <Input.TextArea
            rows={4}
            placeholder="Remarks"
            value={editForm.remarks}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                remarks: e.target.value,
              })
            }
          />

        </div>
      </Modal>

  
    </div>
  );
};

export default HolidayRequests;