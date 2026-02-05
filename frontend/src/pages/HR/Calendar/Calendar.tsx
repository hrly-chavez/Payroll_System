"use client";
//frontend/src/pages/HR/Calendar/Calendar.tsx
import React, { useState, useEffect } from "react";
import { Layout, Button, Table, Input, message, Card } from "antd";
import PayrollPeriodTab from "./PayrollPeriodTab";
import HolidayTab from "./HolidayTab";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import dayjs from "dayjs";
import styles from "./calendar.module.css";
import AddHolidayModal from "./AddHolidayModal";
import AddPayrollPeriodModal from "./AddPayrollPeriodModal";
import api from "../../../api/axios";

const { Content } = Layout;


const CalendarPage: React.FC = () => {
  const [periodModal, setPeriodModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [currentMonth] = useState(dayjs());

  const [holidays, setHolidays] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"holiday" | "payroll">("payroll");
  const [searchText, setSearchText] = useState("");
  const [payrollRefreshKey, setPayrollRefreshKey] = useState(0);
  const [holidayRefreshKey, setHolidayRefreshKey] = useState(0);

  const loadHolidays = async () => {
    try {
      const res = await api.get("/approvals/holidays/");
      setHolidays(res.data);
    } catch (err) {
      message.error("Failed to load holidays");
    }
  };

 

  
  
  useEffect(() => {
    loadHolidays();
  }, []);


  
  
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf("month").day();

  const cells = Array(startDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const holidayColumns = [
  { title: "Holiday Name", dataIndex: "name" },

  {
    title: "Holiday Date",
    dataIndex: "date",
    render: (date: string) => dayjs(date).format("MM/DD/YYYY"),
  },

  { title: "Holiday Type", dataIndex: "type" },
  { title: "Holiday Base", dataIndex: "base" },

  {
    title: "Action",
    dataIndex: "status",
    render: (status: string) => (
      <Button>
        {status} ▼
      </Button>
    ),
  },
];


  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Calendar" />

        <Content className={styles.content}>

          {/* CALENDAR CARD */}
          <Card className={styles.card}>
            <div className={styles.headerRow}>
              <div className={styles.monthTitle}>
                {currentMonth.format("MMMM YYYY")}
              </div>

              <div className={styles.actions}>
                <Button className={styles.payrollBtn} onClick={() => setPeriodModal(true)}>
                  + Add Payroll Period
                </Button>

                <Button className={styles.holidayBtn} onClick={() => setHolidayModal(true)}>
                  + Add Holiday
                </Button>
              </div>
            </div>

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

            <div className={styles.legendRow}>
              <div><span className={`${styles.box} ${styles.ph}`} /> PH Holidays</div>
              <div><span className={`${styles.box} ${styles.us}`} /> U.S Holidays</div>
              <div><span className={`${styles.box} ${styles.work}`} /> Work</div>
              <div><span className={`${styles.box} ${styles.nonWork}`} /> Non-Work</div>
              <div><span className={`${styles.box} ${styles.open}`} /> Open Cutoffs</div>
              <div><span className={`${styles.box} ${styles.close}`} /> Close Cutoffs</div>
              <div><span className={`${styles.box} ${styles.lock}`} /> Locked</div>
            </div>
          </Card>


          {/* REQUESTS CARD */}
          <Card className={styles.card}>  
            {/* HEADER ROW */}
            <div className={styles.requestHeader}>
              <div className={styles.tabSwitch}>
                <Button
                  type={activeTab === "payroll" ? "primary" : "default"}
                  onClick={() => setActiveTab("payroll")}>
                  Payroll Period
                </Button>
                <Button
                  type={activeTab === "holiday" ? "primary" : "default"}
                  onClick={() => setActiveTab("holiday")}>
                  Holiday Request
                </Button>    
              </div>
              <Input.Search
                placeholder="Search"
                className={styles.searchRight}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            {/* TABLE */}
            {activeTab === "holiday" && (
            <HolidayTab
              active={activeTab === "holiday"}
              searchText={searchText}
              refreshKey={holidayRefreshKey}
            />
          )}
            {activeTab === "payroll" && (
            <PayrollPeriodTab
              active={activeTab === "payroll"}
              searchText={searchText}
              refreshKey={payrollRefreshKey}
            />
          )}
          </Card>


        </Content>
      </Layout>

      {/* PAYROLL MODAL */}
      <AddPayrollPeriodModal
        open={periodModal}
        onClose={() => setPeriodModal(false)}
        onSuccess={() => {
          message.success("Payroll period created");
          setPeriodModal(false);
          setPayrollRefreshKey((k) => k + 1);
        }}
      />

      {/* HOLIDAY MODAL */}
      <AddHolidayModal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        onSuccess={() => {
          message.success("Holiday request submitted");
          setHolidayRefreshKey((k) => k + 1);
        }}
      />
    </Layout>
  );
};

export default CalendarPage;
