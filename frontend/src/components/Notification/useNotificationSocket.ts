import { useEffect } from "react";

export default function useNotificationSocket(onNewNotification: () => void) {
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/notifications/?token=${token}`
    );

    socket.onmessage = () => {
      onNewNotification(); // refresh count when new notification arrives
    };

    socket.onerror = () => {
      console.log("WebSocket error");
    };

    return () => {
      socket.close();
    };
  }, [onNewNotification]);
}
