import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "../api/axios";
import { Spin } from "antd";

interface Props {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated");

    if (!isAuth) {
      setUser(null);
      setLoading(false);
      return;
    }

    api.get("/accounts/me/")
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("isAuthenticated"); // cleanup
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <Spin fullscreen />;

  if (!user) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;