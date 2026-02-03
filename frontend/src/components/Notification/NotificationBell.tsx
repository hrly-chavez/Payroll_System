import { Badge } from "antd";
import { BellFilled } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./Notification.module.css";

interface Props {
  count: number;
}

export default function NotificationBell({ count }: Props) {
  const navigate = useNavigate();

  return (
    <Badge count={count} size="small">
      <BellFilled
        className={styles.bell}
        onClick={() => navigate("/notification")}
      />
    </Badge>
  );
}
