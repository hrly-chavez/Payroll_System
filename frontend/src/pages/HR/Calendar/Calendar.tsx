"use client";
//frontend/src/pages/HR/Calendar/Calendar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Layout, Button, Input, message, Card, Calendar, Badge, Select } from "antd";
import type { Dayjs } from "dayjs";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import PayrollPeriodTab from "./Payroll/PayrollPeriodTab";
import HolidayTab from "./HolidayTab";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import dayjs from "dayjs";
import styles from "./calendar.module.css";
import AddHolidayModal from "./AddHolidayModal";
import AddPayrollPeriodModal from "./Payroll/AddPayrollPeriodModal";
import api from "../../../api/axios";

const { Content } = Layout;


const CalendarPage: React.FC = () => {

  type PayrollPeriod = {
    id: number;
    code?: string;
    start_date: string;
    end_date: string;
    status?: string;
  };

  const [periodModal, setPeriodModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());

  const [holidays, setHolidays] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
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
  const loadPayrollPeriods = async () => {
    try {
      // Change endpoint if yours is different
      const res = await api.get("/payroll/periods/");
      setPayrollPeriods(res.data);
    } catch (err) {
      message.error("Failed to load payroll periods");
    }
  };
  
 
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const h of holidays) {
      const key = dayjs(h.date).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return map;
  }, [holidays]);

  const payrollByDate = useMemo(() => {
    // key: YYYY-MM-DD -> PayrollPeriod[]
    const map = new Map<string, PayrollPeriod[]>();

    for (const p of payrollPeriods) {
      const start = dayjs(p.start_date).startOf("day");
      const end = dayjs(p.end_date).startOf("day");

      // guard: skip invalid ranges
      if (!start.isValid() || !end.isValid() || end.isBefore(start)) continue;

      let cur = start.clone();
      while (cur.isSame(end) || cur.isBefore(end)) {
        const key = cur.format("YYYY-MM-DD");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
        cur = cur.add(1, "day");
      }
    }

    return map;
  }, [payrollPeriods]);


  const dateCellRender = (value: Dayjs) => {
    const key = value.format("YYYY-MM-DD");

    const dayHolidays = holidaysByDate.get(key) || [];
    const dayPeriods = payrollByDate.get(key) || [];

    if (!dayHolidays.length && !dayPeriods.length) return null;

    // For styling "start/mid/end" of the payroll range, use the first period
    const period = dayPeriods[0];
    let rangeClass = "";

    if (period) {
      const startKey = dayjs(period.start_date).format("YYYY-MM-DD");
      const endKey = dayjs(period.end_date).format("YYYY-MM-DD");

      if (key === startKey && key === endKey) rangeClass = styles.ppSingle;
      else if (key === startKey) rangeClass = styles.ppStart;
      else if (key === endKey) rangeClass = styles.ppEnd;
      else rangeClass = styles.ppMid;
    }

    return (
      <div className={styles.cellStack}>
        {/* Payroll Period Range (background strip) */}
        {period && (
          <div
            className={`${styles.ppBar} ${rangeClass}`}
            title={`Payroll Period: ${dayjs(period.start_date).format("MMM D")} - ${dayjs(period.end_date).format("MMM D")}`}
          />
        )}


        {/* Holiday marker */}
        {dayHolidays.length > 0 && (
          <div className={styles.cellNote}>
            <Badge status="processing" />
            <span className={styles.cellText}>{dayHolidays[0].name}</span>
            {dayHolidays.length > 1 && (
              <span className={styles.cellMore}>+{dayHolidays.length - 1}</span>
            )}
          </div>
        )}
      </div>
    );
  };



  useEffect(() => {
    loadHolidays();
    loadPayrollPeriods();
  }, []);

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    label: dayjs().month(i).format("MMMM"),
    value: i,
  }));

  const year = calendarValue.year();
  const month = calendarValue.month();

  const years = Array.from({ length: 10 }, (_, i) => year - 5 + i); // 5 years back + 4 forward

  const goPrevMonth = () => setCalendarValue((v) => v.subtract(1, "month"));
  const goNextMonth = () => setCalendarValue((v) => v.add(1, "month"));
  const setMonth = (m: number) => setCalendarValue((v) => v.month(m));
  const setYear = (y: number) => setCalendarValue((v) => v.year(y));

  



  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Calendar" />
          
        <Content className={styles.content}>
                <div className={styles.actions}>
                <Button className={styles.payrollBtn} onClick={() => setPeriodModal(true)}>
                  + Add Payroll Period
                </Button>

                <Button className={styles.holidayBtn} onClick={() => setHolidayModal(true)}>
                  + Add Holiday
                </Button>
              </div>
          {/* CALENDAR CARD */}
          <Card className={styles.card}>
            <div className={styles.calHeader}>
              <div className={styles.calLeft}>
                <Button size="small" onClick={goPrevMonth} icon={<LeftOutlined />} />
                <div className={styles.calTitle}>
                  {calendarValue.format("MMMM YYYY")}
                </div>
                <Button size="small" onClick={goNextMonth} icon={<RightOutlined />} />
              </div>

              <div className={styles.calRight}>
                <Select
                  size="small"
                  value={month}
                  options={monthOptions}
                  onChange={setMonth}
                  style={{ width: 120 }}
                />
                <Select
                  size="small"
                  value={year}
                  options={years.map((y) => ({ label: y, value: y }))}
                  onChange={setYear}
                  style={{ width: 90 }}
                />
              </div>
            </div>

            <div className={styles.calendarWrap}>
              <Calendar
                value={calendarValue}
                onSelect={(val) => setCalendarValue(val)}
                headerRender={() => null}          // removes redundant month/year header
                fullscreen={false}                 // compact size
                cellRender={(value) => dateCellRender(value)}
              />
            </div>
          </Card>




          {/* REQUESTS CARD */}
          <Card className={styles.card}>  
            {/* HEADER ROW */}
            <div className={styles.requestHeader}>
              <div className={styles.tabSwitch}>
                <button
                  className={`${styles.pillTab} ${
                    activeTab === "payroll" ? styles.pillActive : ""
                  }`}
                  onClick={() => setActiveTab("payroll")}
                  type="button"
                >
                  Payroll Period
                </button>

                <button
                  className={`${styles.pillTab} ${
                    activeTab === "holiday" ? styles.pillActive : ""
                  }`}
                  onClick={() => setActiveTab("holiday")}
                  type="button"
                >
                  Holiday Request
                </button>
              </div>
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
          loadPayrollPeriods();
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
