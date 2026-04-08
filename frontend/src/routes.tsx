// frontend/src/routes.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

/* AUTH */
import Login from "./pages/Login/Login";

/* 🔔 NOTIFICATION PAGE */
import NotificationPage from "./pages/Notifications/Notifications";

/* UNAUTHORIZED */
import Unauthorized from "./pages/Login/Unauthorized";

/* NOT FOUND */
import NotFoundPage from "./pages/Login/NotFoundPage";

/* RESET PASSWORD */
import ResetPassword from "./pages/Login/ResetPassword";

/* ================= EMPLOYEE ================= */
import EmpDashboard from "./pages/Employee/Dashboard/Dashboard";
import EmpAttendance from "./pages/Employee/Attendance/Attendance";
import EmpPayslips from "./pages/Employee/Payslips/Payroll";

/* ================= ADMIN / HR ================= */
import AdDashboard from "./pages/HR/Dashboard/Dashboard";
import AdCalendar from "./pages/HR/Calendar/Calendar";
import AdAttendance from "./pages/HR/Attendance/Attendance";
import AdReport from "./pages/HR/Reports/Reports";
import AdDepartment from "./pages/HR/Department/Department";
import AdDepartmentEmployee from "./pages/HR/AdminDepartmentEmployee/AdminDepartmentEmployee";
import EmployeeDetailsPage from "./pages/HR/EmployeeDetailsPage/EmployeeDetailsPage";
import AdRequests from "./pages/HR/Requests/Requests";

/* ================= SUPER ADMIN ================= */
import SupDashboard from "./pages/SuperAdmin/Dashboard/Dashboard";
import SupCalendar from "./pages/SuperAdmin/Calendar/Calendar";
import SupAttendance from "./pages/SuperAdmin/Attendance/Attendance";
import SupReport from "./pages/SuperAdmin/Reports/Reports";
import SupDepartment from "./pages/SuperAdmin/Department/Department";
import SupDepartmentEmployee from "./pages/SuperAdmin/SuperAdminDepartmentEmployee/SuperAdminDepartmentEmployee";
import SupEmployeeDetailsPage from "./pages/SuperAdmin/EmployeeDetailsPage/EmployeeDetailsPage";
import SupSystemConfig from "./pages/SuperAdmin/System Configuration/SystemConfiguration";
import SupRequest from "./pages/SuperAdmin/Request/Request";

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* ================= PUBLIC ================= */}
        <Route element={<PublicRoute />}>
          <Route path="/" element={<Login />} />
        </Route>
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/notification" element={<NotificationPage />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* ================= EMPLOYEE ROUTES ================= */}
        <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
          <Route path="/employee_dashboard" element={<EmpDashboard />} />
          <Route path="/employee/attendance" element={<EmpAttendance />} />
          <Route path="/employee/payslips" element={<EmpPayslips />} />
        </Route>

        {/* ================= ADMIN / HR ROUTES ================= */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route path="/admin/dashboard" element={<AdDashboard />} />
          <Route path="/admin/calendar" element={<AdCalendar />} />
          <Route path="/admin/attendance" element={<AdAttendance />} />
          <Route path="/admin/reports" element={<AdReport />} />
          <Route path="/admin/department" element={<AdDepartment />} />
          <Route
            path="/admin/department-employee/:deptId"
            element={<AdDepartmentEmployee />}
          />
          <Route
            path="/admin/department/employee/employee-details/:employeeId"
            element={<EmployeeDetailsPage />}
          />
          <Route path="/admin/requests" element={<AdRequests />} />
        </Route>

        {/* ================= SUPER ADMIN ROUTES ================= */}
        <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
          <Route path="/super-admin/dashboard" element={<SupDashboard />} />
          <Route path="/super-admin/calendar" element={<SupCalendar />} />
          <Route path="/super-admin/attendance" element={<SupAttendance />} />
          <Route path="/super-admin/reports" element={<SupReport />} />
          <Route path="/super-admin/department" element={<SupDepartment />} />
          <Route path="/super-admin/department-employee/:deptId" element={<SupDepartmentEmployee />} />
          <Route path="/super-admin/department/employee/employee-details/:employeeId" element={<SupEmployeeDetailsPage />} />
          <Route path="/super-admin/system" element={<SupSystemConfig />} />
          <Route path="/super-admin/requests" element={<SupRequest />} />
        </Route>

        {/* ================= CATCH-ALL ================= */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  );
};

export default Router;
