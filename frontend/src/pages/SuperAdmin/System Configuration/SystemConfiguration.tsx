import React, { useState } from 'react';
import {
  Layout,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import './SystemConfiguration.css';

const { Content } = Layout;
const { Option } = Select;

const SystemConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState('contribution');

  // Contribution Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Payroll Rules Modal
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollForm] = Form.useForm();

  /* ---------------- Contribution Handlers ---------------- */
  const openModal = () => setIsModalOpen(true);

  const closeModal = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      console.log('New Contribution:', values);
      closeModal();
    });
  };

  /* ---------------- Payroll Handlers ---------------- */
  const openPayrollModal = () => setIsPayrollModalOpen(true);

  const closePayrollModal = () => {
    payrollForm.resetFields();
    setIsPayrollModalOpen(false);
  };

  const handlePayrollSave = () => {
    payrollForm.validateFields().then(values => {
      console.log('New Payroll Rule:', values);
      closePayrollModal();
    });
  };

  return (
    <Layout className="system-layout">
      <Sidebar />

      <Layout>
        <Topbar title="System Configuration" />

        <Content className="system-content">
          <div className="config-container">

            {/* Header Buttons */}
            <div className="config-actions">
              <Button type="primary">Apply Configurations</Button>
              <Button>Reset Configurations</Button>
            </div>

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
                {activeTab === 'cutoff' && 'Cutoff Schedules'}
              </h3>

              {activeTab === 'contribution' && (
                <Button type="primary" onClick={openModal}>
                  Add New Contributions
                </Button>
              )}

              {activeTab === 'payroll' && (
                <Button type="primary" onClick={openPayrollModal}>
                  Add New Rule
                </Button>
              )}
            </div>

            {/* ================= Contribution Table ================= */}
            {activeTab === 'contribution' && (
              <div className="table-wrapper">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>Deductions (Benefits)</th>
                      <th>Salary Range</th>
                      <th>Amount Type</th>
                      <th>Amount</th>
                      <th>Salary Range (From)</th>
                      <th>Salary Range (To)</th>
                      <th>Effective Date</th>
                      <th>Frequency</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>SSS</td>
                      <td>₱5,000 - ₱35,000</td>
                      <td>Percentage</td>
                      <td>5%</td>
                      <td>₱5,000</td>
                      <td>₱35,000</td>
                      <td>March 16, 2026</td>
                      <td>Monthly</td>
                      <td className="actions">
                        <EyeOutlined />
                        <EditOutlined />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ================= Payroll Rules Table ================= */}
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

                    <tr>
                      <td>Regular Holiday Pay</td>
                      <td>Holiday</td>
                      <td>Earning</td>
                      <td>Multiplier</td>
                      <td>₱1.30</td>
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

            {/* ================= Contribution Modal ================= */}
            <Modal
              title="Add Contribution"
              open={isModalOpen}
              onCancel={closeModal}
              onOk={handleSave}
              okText="Save"
            >
              <Form form={form} layout="vertical">
                <Form.Item label="Deductions (Benefits)" name="name" rules={[{ required: true }]}>
                  <Input placeholder="SSS, PhilHealth, Pag-IBIG" />
                </Form.Item>

                <Form.Item label="Amount Type" name="amountType" rules={[{ required: true }]}>
                  <Select placeholder="Select type">
                    <Option value="percentage">Percentage</Option>
                    <Option value="peso">Peso</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Amount" name="amount" rules={[{ required: true }]}>
                  <Input placeholder="Ex: 5 or 200" />
                </Form.Item>

                <Form.Item label="Salary Range (From)" name="salaryFrom" rules={[{ required: true }]}>
                  <Input placeholder="₱5,000" />
                </Form.Item>

                <Form.Item label="Salary Range (To)" name="salaryTo" rules={[{ required: true }]}>
                  <Input placeholder="₱35,000" />
                </Form.Item>

                <Form.Item label="Effective Date" name="effectiveDate" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="Frequency" name="frequency" rules={[{ required: true }]}>
                  <Select placeholder="Select frequency">
                    <Option value="monthly">Monthly</Option>
                    <Option value="per_pay_period">Per Pay Period</Option>
                  </Select>
                </Form.Item>
              </Form>
            </Modal>

            {/* ================= Payroll Rule Modal ================= */}
            <Modal
              title="Add Payroll Rule"
              open={isPayrollModalOpen}
              onCancel={closePayrollModal}
              onOk={handlePayrollSave}
              okText="Save"
            >
              <Form form={payrollForm} layout="vertical">
                <Form.Item label="Rule Name" name="ruleName" rules={[{ required: true }]}>
                  <Input placeholder="Late Deduction" />
                </Form.Item>

                <Form.Item label="Event Type" name="eventType" rules={[{ required: true }]}>
                  <Select placeholder="Select event">
                    <Option value="late">Late</Option>
                    <Option value="undertime">Undertime</Option>
                    <Option value="holiday">Holiday</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Category" name="category" rules={[{ required: true }]}>
                  <Select placeholder="Select category">
                    <Option value="deduction">Deduction</Option>
                    <Option value="earning">Earning</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Rate Type" name="rateType" rules={[{ required: true }]}>
                  <Select placeholder="Select rate type">
                    <Option value="per_minute">Per Minute</Option>
                    <Option value="multiplier">Multiplier</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Rate Value" name="rateValue" rules={[{ required: true }]}>
                  <Input placeholder="₱5.00 or 1.30" />
                </Form.Item>

                <Form.Item label="Scope" name="scope" rules={[{ required: true }]}>
                  <Select>
                    <Option value="all">All</Option>
                    <Option value="department">By Department</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Effective From" name="effectiveFrom" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;
