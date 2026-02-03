"use client";

import React, { useState } from "react";
import { Layout, Button, Table, Tabs, Input, Modal, DatePicker, Form, ColorPicker } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import dayjs, { Dayjs } from "dayjs";
import styles from "./calendar.module.css";

const { Content } = Layout;
const { RangePicker } = DatePicker;

const CalendarPage: React.FC = () => {
  const [periodModal, setPeriodModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(dayjs());

  const [form] = Form.useForm();

  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf("month").day();

  const cells = Array(startDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const holidayColumns = [
    { title: "Holiday Name", dataIndex: "name" },
    { title: "Holiday Date", dataIndex: "date" },
    { title: "Holiday Type", dataIndex: "type" },
    { title: "Holiday Base", dataIndex: "base" },
    { title: "Action", dataIndex: "action" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Calendar" />

        <Content className={styles.content}>
          {/* HEADER */}
          <div className={styles.headerRow}>
            <div className={styles.monthTitle}>
              {currentMonth.format("MMMM YYYY")}
            </div>

            <div className={styles.actions}>
              <Button
                className={styles.payrollBtn}
                onClick={() => setPeriodModal(true)}
              >
                + Add Payroll Period
              </Button>

              <Button
                className={styles.holidayBtn}
                onClick={() => setHolidayModal(true)}
              >
                + Add Holiday
              </Button>
            </div>
          </div>

          {/* CALENDAR GRID */}
          <div className={styles.calendarGrid}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => (
              <div key={day} className={styles.dayHeader}>{day}</div>
            ))}

            {cells.map((day, i) => (
              <div key={i} className={styles.dayCell}>
                {day && <span>{day}</span>}
              </div>
            ))}
          </div>

          {/* LEGEND */}
          <div className={styles.legendRow}>
            <div><span className={`${styles.box} ${styles.ph}`} /> PH Holidays</div>
            <div><span className={`${styles.box} ${styles.us}`} /> U.S Holidays</div>
            <div><span className={`${styles.box} ${styles.work}`} /> Work</div>
            <div><span className={`${styles.box} ${styles.nonWork}`} /> Non-Work</div>
            <div><span className={`${styles.box} ${styles.open}`} /> Open Cutoffs</div>
            <div><span className={`${styles.box} ${styles.close}`} /> Close Cutoffs</div>
            <div><span className={`${styles.box} ${styles.lock}`} /> Locked</div>
          </div>

          {/* TABS + TABLE */}
          <div className={styles.tableSection}>
            <Tabs
              items={[
                {
                  label: "Holiday Request",
                  key: "1",
                  children: (
                    <>
                      <Input.Search placeholder="Search" className={styles.search} />
                      <Table columns={holidayColumns} dataSource={[]} />
                    </>
                  ),
                },
                { label: "Payroll Period", key: "2", children: "Payroll Period Table" },
              ]}
            />
          </div>
        </Content>
      </Layout>

      {/* PAYROLL PERIOD MODAL */}
      <Modal open={periodModal} onCancel={() => setPeriodModal(false)} footer={null} title="Add Payroll Period">
        <Form layout="vertical">
          <Form.Item label="Select Period">
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Color">
            <ColorPicker />
          </Form.Item>
          <Button type="primary" block>Save</Button>
        </Form>
      </Modal>

      {/* HOLIDAY MODAL */}
      <Modal open={holidayModal} onCancel={() => setHolidayModal(false)} footer={null} title="Add Holiday">
        <Form layout="vertical">
          <Form.Item label="Holiday Name">
            <Input />
          </Form.Item>
          <Form.Item label="Date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" block>Submit</Button>
        </Form>
      </Modal>
    </Layout>
  );
};

export default CalendarPage;
