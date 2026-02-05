import React, { useState, useEffect } from 'react';
import {
  Layout,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
} from 'antd';
import { EyeOutlined, EditOutlined } from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import API from '../../../api/axios';
import './SystemConfiguration.css';

const { Content } = Layout;
const { Option } = Select;

const SystemConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState('contribution');

  // Contribution state
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [amountType, setAmountType] = useState<'manual' | 'percent'>('manual');

  // Fetch contributions
    const fetchContributions = async () => {
      setLoading(true);
      try {
        const res = await API.get('/payroll/superadmin/deductions/');
        setContributions([...res.data].reverse()); // LATEST FIRST
      } catch (error) {
        console.error(error);
        message.error('Failed to fetch contributions.');
      }
      setLoading(false);
    };


  useEffect(() => {
    if (activeTab === 'contribution') {
      fetchContributions();
    }
  }, [activeTab]);

  // Modal handlers
  const openModal = () => setIsModalOpen(true);

  const closeModal = () => {
    form.resetFields();
    setAmountType('manual');
    setIsModalOpen(false);
  };

  // Save contribution
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        code: values.name,
        salary_range_from: parseFloat(values.salaryFrom),
        salary_range_to: parseFloat(values.salaryTo),
        calculation_type:
          values.amountType === 'manual' ? 'Fixed' : 'Percent',
        amount: parseFloat(values.amount), // FIXED OR PERCENT VALUE
        is_active: true,
      };

      const res = await API.post('/payroll/superadmin/deductions/', payload);

      setContributions((prev) => [res.data, ...prev]); // NEW ITEM ON TOP

      message.success('Contribution added successfully');
      closeModal();

    } catch (error) {
      console.error(error);
      message.error('Failed to add contribution.');
    }
  };

  return (
    <Layout className="system-layout">
      <Sidebar />
      <Layout>
        <Topbar title="System Configuration" />
        <Content className="system-content">
          <div className="config-container">

            {/* Tabs */}
            <div className="config-tabs">
              <button
                className={activeTab === 'contribution' ? 'active' : ''}
                onClick={() => setActiveTab('contribution')}
              >
                Contribution Table
              </button>
              <button
                className={activeTab === 'payroll' ? 'active' : ''}
                onClick={() => setActiveTab('payroll')}
              >
                Payroll Rules
              </button>
            </div>

            {/* Section Header */}
            <div className="section-header">
              <h3>
                {activeTab === 'contribution' && 'Contribution Table'}
                {activeTab === 'payroll' && 'Payroll Rules'}
              </h3>

              {activeTab === 'contribution' && (
                <Button type="primary" onClick={openModal}>
                  Add New Contribution
                </Button>
              )}
            </div>

            {/* ================= Contribution Table ================= */}
            {activeTab === 'contribution' && (
              <div className="table-wrapper">
                {loading ? (
                  <Spin />
                ) : (
                  <table className="config-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Salary From</th>
                        <th>Salary To</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.map((c) => (
                        <tr key={c.id}>
                          <td>{c.code}</td>
                          <td>₱{c.salary_range_from}</td>
                          <td>₱{c.salary_range_to}</td>
                          <td>{c.calculation_type}</td>
                          <td>
                            {c.calculation_type === 'Percent'
                              ? `${Number(c.amount)}%`
                              : `₱${Number(c.amount).toFixed(2)}`}
                          </td>

                          <td className="actions">
                            <EyeOutlined />
                            <EditOutlined />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ================= Contribution Modal ================= */}
            <Modal
              title="Add Contribution"
              open={isModalOpen}
              onCancel={closeModal}
              onOk={handleSave}
              okText="Save"
            >
              <Form form={form} layout="vertical">
                <Form.Item
                  label="Deductions (Code)"
                  name="name"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="SSS, PhilHealth, Pag-IBIG" />
                </Form.Item>

                <Form.Item
                  label="Salary Range (From)"
                  name="salaryFrom"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="5000" />
                </Form.Item>

                <Form.Item
                  label="Salary Range (To)"
                  name="salaryTo"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="35000" />
                </Form.Item>

                <Form.Item
                  label="Type"
                  name="amountType"
                  rules={[{ required: true }]}
                >
                  <Select onChange={(value) => setAmountType(value)}>
                    <Option value="manual">Fixed</Option>
                    <Option value="percent">Percent</Option>
                  </Select>
                </Form.Item>

                {/* Fixed Amount */}
                {amountType === 'manual' && (
                  <Form.Item
                    label="Amount (₱)"
                    name="amount"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Amount in pesos" />
                  </Form.Item>
                )}

                {/* Percent Based */}
                {amountType === 'percent' && (
                  <Form.Item
                    label="Percent (%)"
                    name="amount"
                    rules={[
                      { required: true },
                      { type: 'number', min: 0, max: 100, transform: Number },
                    ]}
                  >
                    <Input addonAfter="%" placeholder="Ex: 5" />
                  </Form.Item>
                )}
              </Form>
            </Modal>

            {/* ================= Payroll Rules ================= */}
            {activeTab === 'payroll' && (
              <div className="table-wrapper">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>Rule Name</th>
                      <th>Event Type</th>
                      <th>Category</th>
                      <th>Rate Type</th>
                      <th>Rate Value</th>
                      <th>Scope</th>
                      <th>Effective From</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Late Deduction</td>
                      <td>Late</td>
                      <td>Deduction</td>
                      <td>Per Minute</td>
                      <td>₱5.00</td>
                      <td>All</td>
                      <td>March 1, 2026</td>
                      <td className="actions">
                        <EyeOutlined />
                        <EditOutlined />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;
