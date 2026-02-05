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
  DatePicker,
  Checkbox,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import API from '../../../api/axios';
import './SystemConfiguration.css';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SystemConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'contribution' | 'payroll'>('contribution');

  // ================= DEDUCTIONS / CONTRIBUTIONS =================
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [amountType, setAmountType] = useState<'manual' | 'percent'>('manual');

  const [form] = Form.useForm();

  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/payroll/superadmin/deductions/');
      setContributions([...res.data].reverse());
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch contributions.');
    }
    setLoading(false);
  };

  // ================= PAYROLL RULES =================
  const [payRules, setPayRules] = useState<any[]>([]);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [payRuleEditMode, setPayRuleEditMode] = useState(false);
  const [editingPayRuleId, setEditingPayRuleId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [payrollForm] = Form.useForm();

  // Fetch Departments & Employees
  const fetchDepartments = async () => {
    try {
      const res = await API.get('/employees/departments/');
      setDepartments(res.data);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch departments.');
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/employees/employees/');
      setEmployees(res.data);
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch employees.');
    }
  };

  const fetchPayRules = async () => {
    setLoading(true);
    try {
      const res = await API.get('/payroll/superadmin/pay-rules/');
      setPayRules([...res.data].reverse());
    } catch (error) {
      console.error(error);
      message.error('Failed to fetch payroll rules.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'contribution') fetchContributions();
    if (activeTab === 'payroll') {
      fetchPayRules();
      fetchDepartments();
      fetchEmployees();
    }
  }, [activeTab]);

  // ================= CONTRIBUTION HANDLERS =================
  const openContributionModal = () => {
    setIsEditMode(false);
    form.resetFields();
    setAmountType('manual');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    form.resetFields();
    setIsEditMode(false);
    setEditingId(null);
    setAmountType('manual');
    setIsModalOpen(false);
  };

  const handleEditContribution = (record: any) => {
    const type = record.calculation_type === 'Percent' ? 'percent' : 'manual';
    setIsEditMode(true);
    setEditingId(record.id);
    setAmountType(type);
    form.setFieldsValue({
      name: record.code,
      salaryFrom: record.salary_range_from,
      salaryTo: record.salary_range_to,
      amountType: type,
      amount: record.amount,
    });
    setIsModalOpen(true);
  };

  const handleSaveContribution = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        code: values.name,
        salary_range_from: parseFloat(values.salaryFrom),
        salary_range_to: parseFloat(values.salaryTo),
        calculation_type: values.amountType === 'manual' ? 'Fixed' : 'Percent',
        amount: parseFloat(values.amount),
        is_active: true,
      };

      if (isEditMode && editingId) {
        await API.put(`/payroll/superadmin/deductions/${editingId}/`, payload);
        setContributions((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...payload } : item))
        );
        message.success('Contribution updated successfully');
      } else {
        const res = await API.post('/payroll/superadmin/deductions/', payload);
        setContributions((prev) => [res.data, ...prev]);
        message.success('Contribution added successfully');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      message.error('Failed to save contribution.');
    }
  };

  // ================= PAYROLL RULE HANDLERS =================
  const openPayrollModal = () => {
    setPayrollModalOpen(true);
    setPayRuleEditMode(false);
    payrollForm.resetFields();
  };

  const closePayrollModal = () => {
    setPayrollModalOpen(false);
    setPayRuleEditMode(false);
    setEditingPayRuleId(null);
    payrollForm.resetFields();
  };

  const handleEditPayRule = (rule: any) => {
    setPayRuleEditMode(true);
    setEditingPayRuleId(rule.id);
    payrollForm.setFieldsValue({
      name: rule.name,
      event_type: rule.event_type,
      category: rule.category,
      rate_type: rule.rate_type,
      rate_value: rule.rate_value,
      applies_to: rule.applies_to || '',
      employee: rule.employee || '',
      effective_dates: [
        rule.effective_from ? dayjs(rule.effective_from) : null,
        rule.effective_to ? dayjs(rule.effective_to) : null,
      ],
      is_active: rule.is_active,
    });
    setPayrollModalOpen(true);
  };

  const handleSavePayRule = async () => {
    try {
      const values = await payrollForm.validateFields();
      const [effective_from, effective_to] = values.effective_dates || [];
      const payload = {
        name: values.name,
        event_type: values.event_type,
        category: values.category,
        rate_type: values.rate_type,
        rate_value: parseFloat(values.rate_value),
        applies_to: values.applies_to || null,
        employee: values.employee || null,
        effective_from: effective_from ? effective_from.format('YYYY-MM-DD') : null,
        effective_to: effective_to ? effective_to.format('YYYY-MM-DD') : null,
        is_active: values.is_active,
      };

      if (payRuleEditMode && editingPayRuleId) {
        await API.put(`/payroll/superadmin/pay-rules/${editingPayRuleId}/`, payload);
        setPayRules((prev) =>
          prev.map((item) => (item.id === editingPayRuleId ? { ...item, ...payload } : item))
        );
        message.success('Payroll rule updated successfully');
      } else {
        const res = await API.post('/payroll/superadmin/pay-rules/', payload);
        setPayRules((prev) => [res.data, ...prev]);
        message.success('Payroll rule added successfully');
      }
      closePayrollModal();
    } catch (error) {
      console.error(error);
      message.error('Failed to save payroll rule.');
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
              <h3>{activeTab === 'contribution' ? 'Contribution Table' : 'Payroll Rules'}</h3>

              {activeTab === 'contribution' && (
                <Button type="primary" onClick={openContributionModal}>
                  Add New Contribution
                </Button>
              )}
              {activeTab === 'payroll' && (
                <Button type="primary" onClick={openPayrollModal}>
                  Add New Payroll Rule
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
                        <th style={{ textAlign: 'center' }}>Actions</th>
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
                            <EditOutlined onClick={() => handleEditContribution(c)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ================= Payroll Rules Table ================= */}
            {activeTab === 'payroll' && (
              <div className="table-wrapper">
                {loading ? (
                  <Spin />
                ) : (
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
                      {payRules.map((rule) => (
                        <tr key={rule.id}>
                          <td>{rule.name}</td>
                          <td>{rule.event_type}</td>
                          <td>{rule.category}</td>
                          <td>{rule.rate_type}</td>
                          <td>₱{rule.rate_value}</td>
                          <td>{rule.applies_to_name || 'All'}</td>
                          <td>{rule.effective_from}</td>
                          <td className="actions">
                            <EditOutlined onClick={() => handleEditPayRule(rule)} />
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
              title={isEditMode ? 'Edit Contribution' : 'Add Contribution'}
              open={isModalOpen}
              onCancel={closeModal}
              onOk={handleSaveContribution}
              okText="Save"
              centered
            >
              <Form form={form} layout="vertical">
                <Form.Item label="Deductions (Code)" name="name" rules={[{ required: true }]}>
                  <Input disabled={isEditMode} />
                </Form.Item>
                <Form.Item label="Salary Range (From)" name="salaryFrom" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Salary Range (To)" name="salaryTo" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Type" name="amountType" rules={[{ required: true }]}>
                  <Select onChange={(value) => setAmountType(value)}>
                    <Option value="manual">Fixed</Option>
                    <Option value="percent">Percent</Option>
                  </Select>
                </Form.Item>
                {amountType === 'manual' && (
                  <Form.Item label="Amount (₱)" name="amount" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                )}
                {amountType === 'percent' && (
                  <Form.Item
                    label="Percent (%)"
                    name="amount"
                    rules={[{ required: true }, { type: 'number', min: 0, max: 100, transform: Number }]}
                  >
                    <Input addonAfter="%" />
                  </Form.Item>
                )}
              </Form>
            </Modal>

            {/* ================= Payroll Rule Modal ================= */}
            {activeTab === 'payroll' && (
              <Modal
                title={payRuleEditMode ? 'Edit Payroll Rule' : 'Add Payroll Rule'}
                open={payrollModalOpen}
                onCancel={closePayrollModal}
                onOk={handleSavePayRule}
                okText="Save"
                centered
              >
                <Form form={payrollForm} layout="vertical">
                  <Form.Item label="Rule Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>

                  <Form.Item label="Event Type" name="event_type" rules={[{ required: true }]}>
                    <Select>
                      <Option value="Night Differential">Night Differential</Option>
                      <Option value="Late">Late</Option>
                      <Option value="Undertime">Undertime</Option>
                      <Option value="Overtime">Overtime</Option>
                      <Option value="Regular Holiday">Regular Holiday</Option>
                      <Option value="Special Holiday">Special Holiday</Option>
                      <Option value="Special Non Working Holiday">Special Non Working Holiday</Option>
                      <Option value="Company Holiday">Company Holiday</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Category" name="category" rules={[{ required: true }]}>
                    <Select>
                      <Option value="Earning">Earning</Option>
                      <Option value="Deduction">Deduction</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Rate Type" name="rate_type" rules={[{ required: true }]}>
                    <Select>
                      <Option value="PER_MINUTE">Per Minute</Option>
                      <Option value="MULTIPLIER">Multiplier</Option>
                      <Option value="FIXED">Fixed</Option>
                      <Option value="PER_DAY">Per Day</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Rate Value" name="rate_value" rules={[{ required: true }]}>
                    <Input type="number" step="0.01" />
                  </Form.Item>

                  <Form.Item label="Applies To (Department)" name="applies_to">
                    <Select allowClear placeholder="Select Department">
                      <Option value="">All Departments</Option>
                      {departments.map((dept) => (
                        <Option key={dept.id} value={dept.id}>
                          {dept.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item label="Employee" name="employee">
                    <Select allowClear placeholder="Select Employee">
                      <Option value="">All Employees</Option>
                      {employees.map((emp) => (
                        <Option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.department_name})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item label="Effective From / To" name="effective_dates">
                    <RangePicker
                      format="YYYY-MM-DD"
                      value={payrollForm.getFieldValue('effective_dates')}
                      onChange={(dates) =>
                        payrollForm.setFieldsValue({
                          effective_dates: dates,
                        })
                      }
                    />
                  </Form.Item>

                  <Form.Item name="is_active" valuePropName="checked">
                    <Checkbox>Is Active</Checkbox>
                  </Form.Item>
                </Form>
              </Modal>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;
