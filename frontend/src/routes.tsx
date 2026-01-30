import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login/Login";
// employee
import EmpDashboard from "./pages/Employee/Dashboard/Dashboard";
import EmpAttendance from "./pages/Employee/Attendance/Attendance";
import EmpRequests from "./pages/Employee/Requests/Requests";
import EmpPayslips from "./pages/Employee/Payslips/Payslips";

//admin / hr
import AdDashboard from "./pages/HR/Dashboard/Dashboard";
import AdCalendar from "./pages/HR/Calendar/Calendar";
import AdAttendance from "./pages/HR/Attendance/Attendance";
import AdReport from "./pages/HR/Reports/Reports";
import AdDepartment from "./pages/HR/Department/Department";
import AdDepartmentAddDept from "./pages/HR/Department/AddDepartment";
import AdDepartmentEmployee from "./pages/HR/AdminDepartmentEmployee/AdminDepartmentEmployee";
import AdRequests from "./pages/HR/Requests/Requests";

//super admin
import SupDashboard from "./pages/SuperAdmin/Dashboard/Dashboard";
import SupCalendar from "./pages/SuperAdmin/Calendar/Calendar";
import SupAttendance from "./pages/SuperAdmin/Attendance/Attendance";
import SupReport from "./pages/SuperAdmin/Reports/Reports";
import SupDepartment from "./pages/SuperAdmin/Department/Department";
import SupSystemConfig from "./pages/SuperAdmin/System Configuration/SystemConfiguration";

const Router: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>

                {/* employee ui */}
                <Route path="/Login" element={<Login />} />
                <Route path="/employee_dashboard" element={<EmpDashboard />} />
                <Route path="/employee/attendance" element={<EmpAttendance />} />
                <Route path="/employee/requests" element={<EmpRequests />} />
                <Route path="/employee/payslips" element={<EmpPayslips />} />

                {/* admin ui */}
                <Route path="/admin/dashboard" element={<AdDashboard />} />
                <Route path="/admin/calendar" element={<AdCalendar />} />
                <Route path="/admin/attendance" element={<AdAttendance />} />
                <Route path="/admin/reports" element={<AdReport />} />
                <Route path="/admin/department" element={<AdDepartment />} />
                <Route path="/admin/department-employee" element={<AdDepartmentEmployee />} />
                <Route path="/admin/requests" element={<AdRequests />} />


                {/* super admin ui */}
                <Route path="/super-admin/dashboard" element={<SupDashboard />} />
                <Route path="/super-admin/calendar" element={<SupCalendar />} />
                <Route path="/super-admin/attendance" element={<SupAttendance />} />
                <Route path="/super-admin/reports" element={<SupReport />} />
                <Route path="/super-admin/department" element={<SupDepartment />} />
                <Route path="/super-admin/system" element={<SupSystemConfig />} />
                

            </Routes>
        </BrowserRouter>
    );
};

export default Router;
