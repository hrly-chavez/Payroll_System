import { Calendar, Tooltip } from "antd";
import dayjs, { Dayjs } from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import styles from "./SharedCalendar.module.css";
import localeData from "dayjs/plugin/localeData";


dayjs.extend(isBetween);
dayjs.extend(localeData);

interface EventItem {
  type: "holiday" | "payroll";
  start_date: string;
  end_date?: string;
  title: string;
  color: string;
}

interface Props {
  events: EventItem[];
}

export default function SharedCalendar({ events }: Props) {

  const cellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");

    const dayEvents = events.filter((e) => {
      if (e.type === "holiday") {
        return e.start_date === dateStr;
      }

      if (e.type === "payroll" && e.end_date) {
        const start = dayjs(e.start_date);
        const end = dayjs(e.end_date);

        return (
          value.isSame(start, "day") ||
          value.isSame(end, "day") ||
          value.isBetween(start, end, "day", "[]")
        );
      }

      return false;
    });

    if (!dayEvents.length) return null;

    const primary = dayEvents[0];
    const holidayEvent = dayEvents.find(e => e.type === "holiday");
    const payrollEvent = dayEvents.find(e => e.type === "payroll");

    return (
    <Tooltip
      placement="top"
      overlayInnerStyle={{ padding: 10, borderRadius: 8 }}
      title={
        <div className={styles.tooltipContainer}>
          {dayEvents.map((e, i) => (
            <div key={i} className={styles.tooltipItem}>
              <div
                className={styles.tooltipColor}
                style={{ background: e.color }}
              />
              <span className={styles.tooltipText}>
                {e.title}
              </span>
            </div>
          ))}
        </div>
      }
    >
      <div className={styles.fullCellWrapper}>

        {/* Holiday = Full Cell */}
        {holidayEvent && (
          <div
            className={styles.holidayBackground}
            style={{ background: holidayEvent.color }}
          />
        )}

        {/* Payroll = Smooth Bottom Bar */}
        {payrollEvent && (
          <div
            className={styles.payrollBar}
            style={{ background: payrollEvent.color }}
          />
        )}

        {/* Date Number */}
        <div
          className={styles.dateNumber}
          style={{
            fontWeight: holidayEvent ? 600 : 400,
            color: holidayEvent ? "#fff" : undefined,
          }}
        >
          {value.date()}
        </div>

      </div>
    </Tooltip>
  );
  };

  return (
    <Calendar
    fullscreen={false}
    headerRender={({ value, onChange }) => {
      const current = value.clone();

      const handleMonthChange = (month: number) => {
        const newValue = current.month(month);
        onChange(newValue);
      };

      const handleYearChange = (year: number) => {
        const newValue = current.year(year);
        onChange(newValue);
      };

      const months = dayjs.months();
      const years = [];
      for (let i = current.year() - 5; i <= current.year() + 5; i++) {
        years.push(i);
      }

      return (
        <div className={styles.calendarHeader}>
          <select
            value={current.month()}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
          >
            {months.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>

          <select
            value={current.year()}
            onChange={(e) => handleYearChange(Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      );
    }}
    cellRender={(current, info) => {
      if (info.type === "date") {
        return cellRender(current);
      }
      return info.originNode;
    }}
  />
);
}
