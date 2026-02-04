//frontend/src/routes.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

/* AUTH */
import Login from "./pages/Login/Login";

/* 🔔 NOTIFICATION PAGE */
import NotificationPage from "./pages/Notifications/Notifications";

/* ================= EMPLOYEE ================= */
import EmpDashboard from "./pages/Employee/Dashboard/Dashboard";
import EmpAttendance from "./pages/Employee/Attendance/Attendance";
import EmpRequests from "./pages/Employee/Requests/Requests";
import EmpPayslips from "./pages/Employee/Payslips/Payslips";

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
import SupSystemConfig from "./pages/SuperAdmin/System Configuration/SystemConfiguration";
import SupRequest from "./pages/SuperAdmin/Request/Request";

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* ================= LOGIN ================= */}
        <Route path="/" element={<Login />} />

        {/* ================= NOTIFICATIONS ================= */}
        <Route path="/notification" element={<NotificationPage />} />


        {/* ================= EMPLOYEE ROUTES ================= */}
        <Route path="/employee_dashboard" element={<ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmpDashboard />
        </ProtectedRoute>} />
        <Route path="/employee/attendance" element={<ProtectedRoute allowedRoles={["EMPLOYEE"]}>
            <EmpAttendance />
        </ProtectedRoute>} />

        <Route path="/employee/requests" element={<EmpRequests />} />
        <Route path="/employee/payslips" element={<EmpPayslips />} />

        {/* ================= ADMIN ROUTES ================= */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdDashboard />
    </ProtectedRoute>} />
        <Route path="/admin/calendar" element={<AdCalendar />} />
        <Route path="/admin/attendance" element={<AdAttendance />} />
        <Route path="/admin/reports" element={<AdReport />} />
        <Route path="/admin/department" element={<AdDepartment />} />
        <Route path="/admin/department-employee/:deptId" element={<AdDepartmentEmployee />} />
        <Route path="/admin/employee/employee-details/:employeeId" element={<EmployeeDetailsPage />} />
        <Route path="/admin/requests" element={<AdRequests />} />

        {/* ================= SUPER ADMIN ROUTES ================= */}
        <Route path="/super-admin/dashboard" element={<SupDashboard />} />
        <Route path="/super-admin/calendar" element={<SupCalendar />} />
        <Route path="/super-admin/attendance" element={<SupAttendance />} />
        <Route path="/super-admin/reports" element={<SupReport />} />
        <Route path="/super-admin/department" element={<SupDepartment />} />
        <Route path="/super-admin/system" element={<SupSystemConfig />} />
        <Route path="/super-admin/requests" element={<SupRequest />} />

      </Routes>
    </BrowserRouter>
  );
};

export default Router;
