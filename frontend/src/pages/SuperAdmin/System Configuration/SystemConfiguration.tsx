import React, { useState, useEffect } from 'react';
import {
  Layout,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
  Spin,
} from 'antd';
import { EyeOutlined, EditOutlined } from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import API from '../../../api/axios'; // Axios instance pointing to your backend
import './SystemConfiguration.css';

const { Content } = Layout;
const { Option } = Select;

const SystemConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState('contribution');

  // Contribution state
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Contribution Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [amountType, setAmountType] = useState<'manual' | 'percent'>('manual');

  const baseSalary = 30000; // Replace with dynamic salary if needed

  // Fetch contributions from backend
  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/payroll/superadmin/deductions/');
      setContributions(res.data);
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

  // Calculate amount from percent
  const handlePercentChange = (value: string) => {
    const percent = parseFloat(value);
    if (!isNaN(percent)) {
      const calculatedAmount = (baseSalary * percent) / 100;
      form.setFieldsValue({ amount: calculatedAmount.toFixed(2) });
    } else {
      form.setFieldsValue({ amount: '' });
    }
  };

  // Save contribution to backend
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        code: values.name, // using name as code
        salary_range_from: parseFloat(values.salaryFrom),
        salary_range_to: parseFloat(values.salaryTo),
        calculation_type: values.amountType === 'manual' ? 'Fixed' : 'Percent',
        amount: parseFloat(values.amount),
        is_active: true,
      };

      await API.post('payroll/superadmin/deductions/', payload);
      message.success('Contribution added successfully');
      fetchContributions();
      closeModal();
    } catch (error: any) {
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
                          <td>₱{c.amount}</td>
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

                {amountType === 'manual' && (
                  <Form.Item
                    label="Amount"
                    name="amount"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Amount" />
                  </Form.Item>
                )}

                {amountType === 'percent' && (
                  <>
                    <Form.Item
                      label="Percent (%)"
                      name="percent"
                      rules={[{ required: true }]}
                    >
                      <Input
                        placeholder="Ex: 5"
                        onChange={(e) => handlePercentChange(e.target.value)}
                      />
                    </Form.Item>

                    <Form.Item label="Amount" name="amount">
                      <Input placeholder="Auto calculated" disabled />
                    </Form.Item>
                  </>
                )}
              </Form>
            </Modal>

            {/* ================= Payroll Rules Table & Modal ================= */}
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
