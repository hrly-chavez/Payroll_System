"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Layout, Card, message } from "antd";
import dayjs from "dayjs";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import SharedCalendar from "../../../components/SharedCalendar/SharedCalendar";
import type { EventItem } from "../../../components/SharedCalendar/SharedCalendar";
import PayrollPeriodTab from "./PayrollPeriod/PayrollPeriodTab";
import api from "../../../api/axios";
import {
  HOLIDAY_LEGEND,
  PAYROLL_COLOR,
} from "../../../components/SharedCalendar/CalendarLegend";
import CalendarLegendDisplay from "../../../components/SharedCalendar/CalendarLegendDisplay";

const { Content } = Layout;

const SuperAdminCalendar: React.FC = () => {
  const [calendarValue, setCalendarValue] = useState(dayjs());

  type Holiday = {
    id: number;
    date: string;
    name: string;
    type: "Regular" | "Special Non-Working" | "Special Working" | "Company Holiday";
    base: "PH" | "US" | "COMPANY";
  };

  type PayrollPeriod = {
    id: number;
    start_date: string;
    end_date: string;
  };

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);

  useEffect(() => {
    api.get("/approvals/holidays/").then(res => setHolidays(res.data));
    api.get("/payroll/periods/").then(res => setPayrollPeriods(res.data));
  }, []);

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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Calendar" />
        <Content style={{ margin: 16 }}>

          <Card>
            <SharedCalendar
              events={events}
              value={calendarValue}
              onPanelChange={(val) => setCalendarValue(val)}
            />

            <div style={{ marginTop: 16 }}>
              <CalendarLegendDisplay />
            </div>
          </Card>

          <Card style={{ marginTop: 20 }}>
            <PayrollPeriodTab active searchText="" />
          </Card>

        </Content>
      </Layout>
    </Layout>
  );
};

export default SuperAdminCalendar;