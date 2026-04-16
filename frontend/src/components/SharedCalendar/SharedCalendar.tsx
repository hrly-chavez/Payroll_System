import { Calendar, Popover } from "antd";
import type { CalendarProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import localeData from "dayjs/plugin/localeData";
import styles from "./SharedCalendar.module.css";
import enUS from "antd/es/date-picker/locale/en_US";
import customParseFormat from "dayjs/plugin/customParseFormat";

import weekday from "dayjs/plugin/weekday";
import "dayjs/locale/en";

dayjs.extend(weekday);
dayjs.locale("en");
dayjs.extend(customParseFormat);

dayjs.extend(isBetween);
dayjs.extend(localeData);

export interface EventItem {
  type: "holiday" | "payroll" | "attendance";
  start_date: string;
  end_date?: string;

  title?: string;
  color?: string;

  time_in?: string;
  time_out?: string;
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

  const customLocale = {
    ...enUS,
    lang: {
      ...enUS.lang,
      shortWeekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
  };
  
  const renderCell = (current: Dayjs) => {
    const dateStr = current.format("YYYY-MM-DD");

    const dayEvents = events.filter((e) => {
      if (e.type === "holiday") {
        return e.start_date === dateStr;
      }

      if (e.type === "attendance") {
        return dayjs(e.start_date).format("YYYY-MM-DD") === dateStr;
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
    const attendanceEvent = dayEvents.find((e) => e.type === "attendance");

    // Holiday overrides payroll
    const backgroundColor =
      holidayEvent?.color || payrollEvent?.color;


    //helper function so time parsing is accurate
    const formatAttendanceTime = (time?: string) => {
      if (!time) return "";

      const parsed = dayjs(time);

      if (!parsed.isValid()) return time;

      return parsed.format("h:mm A");
    };

    const popoverContent =
      holidayEvent || payrollEvent || attendanceEvent ? (
        <div>
          {/* ADDED: Holiday title on hover */}
          {holidayEvent && (
            <div>
              <strong>{holidayEvent.title || "Holiday"}</strong>
            </div>
          )}

          {/* ADDED: Payroll title on hover */}
          {payrollEvent && (
            <div>
              <strong>{payrollEvent.title || "Payroll Period"}</strong>
            </div>
          )}

          {/* Existing attendance hover details, slightly expanded */}
          {attendanceEvent && (
            <>
              {/* ADDED: Optional attendance title */}
              {attendanceEvent.title && (
                <div>
                  <strong>{attendanceEvent.title}</strong>
                </div>
              )}

              {attendanceEvent.time_in && (
                <div>
                  Punched in at {formatAttendanceTime(attendanceEvent.time_in)}
                </div>
              )}

              {attendanceEvent.time_out && (
                <div>
                  Punched out at {formatAttendanceTime(attendanceEvent.time_out)}
                </div>
              )}
            </>
          )}
        </div>
      ) : null;


    const content = (
      <div
        className={`${styles.fullCellWrapper} ${
          backgroundColor ? styles.coloredCell : ""
        }`}
        style={
          backgroundColor
            ? { background: backgroundColor, borderRadius: 0 }
            : undefined
        }
      >

      {/* ATTENDANCE DISPLAY */}
        {attendanceEvent && (
        <div className={styles.attendanceSplit}>
          {attendanceEvent.time_in && (
            <div className={styles.timeInHalf}>
            </div>
          )}
          {attendanceEvent.time_out && (
            <div className={styles.timeOutHalf}>
            </div>
          )}
        </div>
      )}
      </div>
    );

    return (
      <Popover
        content={popoverContent} 
        trigger="hover"
        placement="top"
      >
        <div
          className={styles.fullCellWrapper}
          style={{
            height: "100%",
            width: "100%",
            background: backgroundColor || undefined,
          }}
        >
          <div
            className={styles.dateNumber}
            style={{
              color: holidayEvent ? "#ffffff" : "#222222",
            }}
          >
            {current.format("DD")}
          </div>

          {attendanceEvent && (
            <div className={styles.attendanceSplit}>
              {attendanceEvent.time_in && (
                <div className={styles.timeInHalf}></div>
              )}
              {attendanceEvent.time_out && (
                <div className={styles.timeOutHalf}></div>
              )}
            </div>
          )}
        </div>
      </Popover>
    );
  };

  return (
    <Calendar
      value={value}
      onSelect={onSelect}
      onPanelChange={onPanelChange}
      fullscreen={false}
      mode="month"
      locale={customLocale}


      headerRender={({ value, onChange }) => {
        const today = dayjs();

        return (
          <div className={styles.calendarHeader}>
            {/* LEFT SIDE — TODAY DATE */}
            <div className={styles.todayLabel}>
              {today.format("MMMM D, YYYY")}
            </div>

            {/* RIGHT SIDE — CONTROLS */}
            <div className={styles.headerControls}>
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
          </div>
        );
      }}

      cellRender={(current, info) => {
        if (info.type === "date") {
          return renderCell(current);
        }
        return info.originNode;
      }}
    />
  );
}