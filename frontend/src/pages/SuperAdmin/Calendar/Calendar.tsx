import React from "react";
import { Card } from "antd";
import CalendarPage from "pages/HR/Calendar/Calendar";
import PayrollPeriod from "pages/SuperAdmin/Calendar/PayrollPeriod/PayrollPeriodTab";
import "./Calendar.css";
import PayrollPeriodTab from "pages/SuperAdmin/Calendar/PayrollPeriod/PayrollPeriodTab";

const Calendar: React.FC = () => {
  return (
    <>
      {/* CalendarPage already contains Layout + Content */}
      <CalendarPage showRequests={false} />

      {/* Add PayrollPeriod INSIDE same visual context */}
      <div className="wrapper">
        <Card className="card">
          <PayrollPeriodTab active={true} searchText="" />
        </Card>
      </div>
    </>
  );
};

export default Calendar;