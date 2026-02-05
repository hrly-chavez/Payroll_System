import { Calendar } from "antd";
import dayjs, { Dayjs } from "dayjs";
import styles from "./SharedCalendar.module.css";

interface EventItem {
  date: string; // YYYY-MM-DD
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
          <div
            key={i}
            className={styles.dot}
            style={{ backgroundColor: e.color }}
          />
        ))}
      </div>
    );
  };

  return (
    <Calendar
      fullscreen={false}
      dateCellRender={dateCellRender}
    />
  );
}
