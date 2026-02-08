//src/components/SharedCalendar
import { Calendar } from "antd";
import dayjs, { Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import styles from "./SharedCalendar.module.css";

dayjs.extend(localeData);

interface EventItem {
  date: string;
  type: "holiday" | "payroll";
  color: string;
}

interface Props {
  events: EventItem[];
}

export default function SharedCalendar({ events }: Props) {

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format("YYYY-MM-DD");
    const dayEvents = events.filter(e => e.date === dateStr);

    return (
      <div className={styles.cell}>
        {dayEvents.map((e, i) => (
          <div key={i} className={styles.dot} style={{ backgroundColor: e.color }} />
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
        const current = value;
        const months: string[] = dayjs.monthsShort();   // now works
        const years: number[] = Array.from({ length: 10 }, (_, i) => dayjs().year() - 5 + i);

        return (
          <div className={styles.calendarHeader}>
            {/* YEAR DROPDOWN */}
            <select
              value={current.year()}
              onChange={(e) => onChange(current.year(Number(e.target.value)))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* MONTH DROPDOWN */}
            <select
              value={current.month()}
              onChange={(e) => onChange(current.month(Number(e.target.value)))}
            >
              {months.map((m: string, i: number) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
        );
      }}
    />
  );
}
