// src/pages/SuperAdmin/System Configuration/Contribution/ContributionTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddContribution from "./AddContribution";
import { editContribution } from "./EditContribution";

type Props = {
  active: boolean;
};

export default function ContributionTab({ active }: Props) {
  const [loading, setLoading] = useState(false);

  const [contributions, setContributions] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [amountType, setAmountType] = useState<"manual" | "percent">("manual");

  const [form] = Form.useForm();

  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payroll/superadmin/deductions/");
      setContributions([...res.data].reverse());
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch contributions.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchContributions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openContributionModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setAmountType("manual");
    form.resetFields();
    setIsModalOpen(true);
  };

  const closeContributionModal = () => {
    form.resetFields();
    setIsEditMode(false);
    setEditingId(null);
    setAmountType("manual");
    setIsModalOpen(false);
  };

  const handleEditContribution = (record: any) => {
    editContribution({
      record,
      setIsEditMode,
      setEditingId,
      setAmountType,
      setIsModalOpen,
      form,
    });
  };

  const handleSaveContribution = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        code: values.name,
         category: values.category,
        salary_range_from: parseFloat(values.salaryFrom),
        salary_range_to: parseFloat(values.salaryTo),
        calculation_type: values.amountType === "manual" ? "Fixed" : "Percent",
        amount: parseFloat(values.amount),
        is_active: true,
      };

      if (isEditMode && editingId) {
        await API.put(`/payroll/superadmin/deductions/${editingId}/`, payload);
        message.success("Contribution updated successfully");
      } else {
        await API.post("/payroll/superadmin/deductions/", payload);
        message.success("Contribution added successfully");
      }

      closeContributionModal();
      fetchContributions();
    } catch (error) {
      console.error(error);
      message.error("Failed to save contribution.");
    }
  };

  return (
    <div className="table-wrapper">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" onClick={openContributionModal}>
          Add New Contribution
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>Salary From</th>
              <th>Salary To</th>
              <th>Type</th>
              <th>Amount</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.category || "-"}</td>
                <td>₱{c.salary_range_from}</td>
                <td>₱{c.salary_range_to}</td>
                <td>{c.calculation_type}</td>
                <td>
                  {c.calculation_type === "Percent"
                    ? `${Number(c.amount)}%`
                    : `₱${Number(c.amount).toFixed(2)}`}
                </td>
                <td className="actions">
                  <EditOutlined onClick={() => handleEditContribution(c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddContribution
        open={isModalOpen}
        title={isEditMode ? "Edit Contribution" : "Add Contribution"}
        onCancel={closeContributionModal}
        onOk={handleSaveContribution}
        form={form}
        isEditMode={isEditMode}
        amountType={amountType}
        onAmountTypeChange={setAmountType}
      />
    </div>
  );
}
