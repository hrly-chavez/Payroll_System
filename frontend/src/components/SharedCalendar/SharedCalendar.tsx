import { Calendar, Tooltip } from "antd";
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
}

export default function SharedCalendar({
  events,
  value,
  onSelect,
}: Props)  
  { const cellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");

    const dayEvents = events.filter((e) => {
      if (e.type === "holiday") return e.start_date === dateStr;

      if (e.type === "payroll" && e.end_date) {
        const start = dayjs(e.start_date);
        const end = dayjs(e.end_date);
        return value.isBetween(start, end, "day", "[]");
      }

      return false;
    });

    if (!dayEvents.length) {
      return (
        <div className={styles.fullCellWrapper}>
          <div className={styles.dateNumber}>{value.format("DD")}</div>
        </div>
      );
    }

    const holidayEvent = dayEvents.find((e) => e.type === "holiday");
    const payrollEvent = dayEvents.find((e) => e.type === "payroll");

    // 🔥 Holiday overrides payroll
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
            color: holidayEvent ? "#fff" : "#222",
          }}
        >
          {value.format("DD")}
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
    fullscreen={false}
    cellRender={(current, info) => {
      if (info.type === "date") {
        return cellRender(current);
      }
      return info.originNode;
    }}
/>
  );
}
