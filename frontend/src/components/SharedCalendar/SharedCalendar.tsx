import { Calendar, Tooltip } from "antd";
import dayjs, { Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import styles from "./SharedCalendar.module.css";

dayjs.extend(localeData);

interface EventItem {
  date: string; // YYYY-MM-DD
  type: "holiday" | "payroll";
  title: string; // label from admin (e.g. "PH Holiday", "Payroll Cutoff")
  color: string;
}

interface Props {
  events: EventItem[];
}

export default function SharedCalendar({ events }: Props) {

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const dayEvents = events.filter(e => e.date === dateStr);

    if (!dayEvents.length) return null;

    return (
      <div className={styles.cell}>
        {dayEvents.map((e, i) => (
          <Tooltip key={i} title={e.title}>
            <span
              className={styles.dot}
              style={{ backgroundColor: e.color }}
            />
          </Tooltip>
        ))}
      </div>
    );
  };

  return (
    <Calendar
      fullscreen={false}
      mode="month"
      dateCellRender={dateCellRender}
      headerRender={({ value, onChange }) => {
        const months = dayjs.monthsShort();
        const years = Array.from({ length: 10 }, (_, i) => dayjs().year() - 5 + i);

        return (
          <div className={styles.calendarHeader}>
            <select
              value={value.year()}
              onChange={(e) => onChange(value.year(Number(e.target.value)))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              value={value.month()}
              onChange={(e) => onChange(value.month(Number(e.target.value)))}
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
        );
      }}
    />
  );
}
