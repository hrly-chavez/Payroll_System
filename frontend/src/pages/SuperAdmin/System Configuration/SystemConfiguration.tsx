import React, { useState } from 'react';
import { Layout, Button } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Sidebar from '../../../components/Sidebar/Sidebar';
import Topbar from '../../../components/Topbar/Topbar';
import './SystemConfiguration.css';

const { Content } = Layout;

const SystemConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState('contribution');

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

              <button
                className={activeTab === 'cutoff' ? 'active' : ''}
                onClick={() => setActiveTab('cutoff')}
              >
                Cutoff Schedules
              </button>

            </div>

            {/* Section Header */}
            <div className="section-header">
              <h3>Contribution Table</h3>
              <Button type="primary">Add New Contributions</Button>
            </div>

            {/* Table */}
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
                    <td>₱10,000</td>
                    <td>March 16, 2026</td>
                    <td>Monthly</td>
                    <td className="actions">
                      <EyeOutlined />
                      <EditOutlined />
                    </td>
                  </tr>

                  <tr>
                    <td>PhilHealth</td>
                    <td>₱10,000 - ₱100,000</td>
                    <td>Percentage</td>
                    <td>5%</td>
                    <td>₱5,000</td>
                    <td>₱10,000</td>
                    <td>March 16, 2026</td>
                    <td>Per Pay Period</td>
                    <td className="actions">
                      <EyeOutlined />
                      <EditOutlined />
                    </td>
                  </tr>

                  <tr>
                    <td>Pag-ibig</td>
                    <td>₱1,500 - ₱100,000</td>
                    <td>Peso</td>
                    <td>200</td>
                    <td>₱5,000</td>
                    <td>₱10,000</td>
                    <td>March 16, 2026</td>
                    <td>Per Pay Period</td>
                    <td className="actions">
                      <EyeOutlined />
                      <EditOutlined />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SystemConfiguration;
