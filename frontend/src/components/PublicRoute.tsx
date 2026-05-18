//src/components/PublicRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Spin, message } from "antd";


const PublicRoute: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Fetch user info
  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated");
    const role = localStorage.getItem("role");

    if (!isAuth || !role) {
      setLoading(false);
      return;
    } 

    if (role === "EMPLOYEE") {
      setRedirectPath("/employee_dashboard");
    } else if (role === "ADMIN") {
      setRedirectPath("/admin/dashboard");
    } else if (role === "SUPER_ADMIN") {
      setRedirectPath("/super-admin/dashboard");
    }

    setLoading(false);
  }, []);

    // Show redirect message only when redirectPath changes
    useEffect(() => {
      if (redirectPath) {
        message.info("You are already logged in. Redirecting...");
      }
    }, [redirectPath]);

    if (loading) return <Spin size="large" style={{ width: "100%", marginTop: "50px" }} />;

    if (redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }

    return <Outlet />;
  };

export default PublicRoute;