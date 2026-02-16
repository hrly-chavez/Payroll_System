import { Calendar, Tooltip } from "antd";
import type { CalendarProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import localeData from "dayjs/plugin/localeData";
import styles from "./SharedCalendar.module.css";

dayjs.extend(isBetween);
dayjs.extend(localeData);

export interface EventItem {
  type: "holiday" | "payroll";
  start_date: string;
  end_date?: string;
  title: string;
  color: string;
}

interface Props {
  events: EventItem[];
  value?: Dayjs;
  onSelect?: (date: Dayjs) => void;
  onPanelChange?: (value: Dayjs, mode: "month" | "year") => void;
}

export default function SharedCalendar({
  events,
  value,
  onSelect,
  onPanelChange,
}: Props) {
  const renderCell = (current: Dayjs) => {
    const dateStr = current.format("YYYY-MM-DD");

    const dayEvents = events.filter((e) => {
      if (e.type === "holiday") {
        return e.start_date === dateStr;
      }

      if (e.type === "payroll" && e.end_date) {
        const start = dayjs(e.start_date);
        const end = dayjs(e.end_date);
        return current.isBetween(start, end, "day", "[]");
      }

      return false;
    });

    if (!dayEvents.length) {
      return (
        <div className={styles.fullCellWrapper}>
          <div className={styles.dateNumber}>
            {current.format("DD")}
          </div>
        </div>
      );
    }

    const holidayEvent = dayEvents.find((e) => e.type === "holiday");
    const payrollEvent = dayEvents.find((e) => e.type === "payroll");

    // Holiday overrides payroll
    const backgroundColor =
      holidayEvent?.color || payrollEvent?.color;

    const content = (
      <div
        className={styles.fullCellWrapper}
        style={{ background: backgroundColor }}
      >
        <div
          className={styles.dateNumber}
          style={{
            color: holidayEvent ? "#ffffff" : "#222222",
          }}
        >
          {current.format("DD")}
        </div>
      </div>
    );

    return (
      <Tooltip
        title={
          <div>
            {dayEvents.map((e, i) => (
              <div key={i}>{e.title}</div>
            ))}
          </div>
        }
      >
        {content}
      </Tooltip>
    );
  };

  return (
    <Calendar
      value={value}
      onSelect={onSelect}
      onPanelChange={onPanelChange}
      fullscreen={false}
      mode="month"
      headerRender={({ value, onChange }) => (
        <div className={styles.calendarHeader}>
          {/* Year Selector */}
          <select
            value={value.year()}
            onChange={(e) =>
              onChange(value.year(Number(e.target.value)))
            }
          >
            {Array.from({ length: 10 }, (_, i) => {
              const year = dayjs().year() - 5 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>

          {/* Month Selector */}
          <select
            value={value.month()}
            onChange={(e) =>
              onChange(value.month(Number(e.target.value)))
            }
          >
            {dayjs.months().map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
        </div>
      )}
      cellRender={(current, info) => {
        if (info.type === "date") {
          return renderCell(current);
        }
        return info.originNode;
      }}
    />
  );
}
