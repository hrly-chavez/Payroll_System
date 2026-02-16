"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Layout, Button, message, Card, Select } from "antd";
import type { Dayjs } from "dayjs";
import PayrollPeriodTab from "./Payroll/PayrollPeriodTab";
import HolidayTab from "./HolidayTab";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import dayjs from "dayjs";
import styles from "./calendar.module.css";
import AddHolidayModal from "./AddHolidayModal";
import AddPayrollPeriodModal from "./Payroll/AddPayrollPeriodModal";
import api from "../../../api/axios";
import {
  HOLIDAY_LEGEND,
  PAYROLL_COLOR,
} from "../../../components/SharedCalendar/CalendarLegend";
import SharedCalendar from "../../../components/SharedCalendar/SharedCalendar";
import type { EventItem } from "../../../components/SharedCalendar/SharedCalendar";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";

const { Content } = Layout;

const CalendarPage: React.FC = () => {
  type PayrollPeriod = {
    id: number;
    code?: string;
    start_date: string;
    end_date: string;
    status?: string;
  };

  type Holiday = {
    id: number;
    date: string;
    name: string;
    type:
      | "Regular"
      | "Special Non-Working"
      | "Special Working"
      | "Company Holiday";
    base: "PH" | "US" | "COMPANY";
  };

  const [periodModal, setPeriodModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [calendarValue, setCalendarValue] = useState<Dayjs>(dayjs());

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [activeTab, setActiveTab] = useState<"holiday" | "payroll">("payroll");
  const [searchText] = useState("");
  const [payrollRefreshKey, setPayrollRefreshKey] = useState(0);
  const [holidayRefreshKey, setHolidayRefreshKey] = useState(0);

  const loadHolidays = async () => {
    try {
      const res = await api.get("/approvals/holidays/");
      setHolidays(res.data);
    } catch {
      message.error("Failed to load holidays");
    }
  };

  const loadPayrollPeriods = async () => {
    try {
      const res = await api.get("/payroll/periods/");
      setPayrollPeriods(res.data);
    } catch {
      message.error("Failed to load payroll periods");
    }
  };

  const events = useMemo<EventItem[]>(() => {
    return [
      ...holidays.map<EventItem>((h) => ({
        type: "holiday",
        start_date: h.date,
        title: h.name,
        color: HOLIDAY_LEGEND[h.base][h.type].bgColor,
      })),
      ...payrollPeriods.map<EventItem>((p) => ({
        type: "payroll",
        start_date: p.start_date,
        end_date: p.end_date,
        title: "Payroll Period",
        color: PAYROLL_COLOR.bgColor,
      })),
    ];
  }, [holidays, payrollPeriods]);

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
  const years = Array.from({ length: 10 }, (_, i) => year - 5 + i);

  const setMonth = (m: number) =>
    setCalendarValue((v) => v.month(m));
  const setYear = (y: number) =>
    setCalendarValue((v) => v.year(y));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Calendar" />

        <Content className={styles.content}>
          {/* ACTION BUTTONS */}
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

          {/* ================= CALENDAR CARD ================= */}
          <Card className={styles.card}>
            {/* Header Controls */}
             <div className={styles.calLeftTitle}>
              {calendarValue.format("MMMM YYYY")}
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

            {/* Calendar */}
            <div className={styles.calendarWrap}>
              <SharedCalendar
                events={events}
                value={calendarValue}
                onPanelChange={(val) =>
                  setCalendarValue(val)
                }
              />
            </div>

            {/* Legend BELOW calendar */}
            <div style={{ marginTop: 16 }}>
              <CalendarLegendDisplay />
            </div>
          </Card>

          {/* ================= REQUESTS CARD ================= */}
          <Card className={styles.card}>
            <div className={styles.requestHeader}>
              <div className={styles.tabSwitch}>
                <button
                  className={`${styles.pillTab} ${
                    activeTab === "payroll"
                      ? styles.pillActive
                      : ""
                  }`}
                  onClick={() => setActiveTab("payroll")}
                  type="button"
                >
                  Payroll Period
                </button>

                <button
                  className={`${styles.pillTab} ${
                    activeTab === "holiday"
                      ? styles.pillActive
                      : ""
                  }`}
                  onClick={() => setActiveTab("holiday")}
                  type="button"
                >
                  Holiday Request
                </button>
              </div>
            </div>

            {activeTab === "holiday" && (
              <HolidayTab
                active
                searchText={searchText}
                refreshKey={holidayRefreshKey}
              />
            )}

            {activeTab === "payroll" && (
              <PayrollPeriodTab
                active
                searchText={searchText}
                refreshKey={payrollRefreshKey}
              />
            )}
          </Card>
        </Content>
      </Layout>

      {/* ================= MODALS ================= */}

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

      <AddHolidayModal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        onSuccess={() => {
          message.success("Holiday request submitted");
          setHolidayRefreshKey((k) => k + 1);
          loadHolidays();
        }}
      />
    </Layout>
  );
};

export default CalendarPage;
