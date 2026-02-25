import { useState, useEffect } from "react";
import { message } from "antd";
import api from "api/axios";

import EmployeeDetailsModal from "./EmployeeDetailsModal";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import EmployeeContributionsModal from "./EmployeeContributionsModal";
import EmployeeAllowanceModal from "./EmployeeAllowanceModal";
import EmployeeCredentialsModal from "./EmployeeCredentialsModal";

interface Props {
  open: boolean;
  departmentId: number;
  allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[];
  onClose: () => void;
}

const AddEmployeeFlow: React.FC<Props> = ({ open, departmentId, onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [salaryData, setSalaryData] = useState<any>(null);
  const [contributionsData, setContributionsData] = useState<any[]>([]);
  const [allowancesData, setAllowancesData] = useState<any[]>([]);
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  const currentUserRole = localStorage.getItem("role");

  const allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[] =
    currentUserRole === "SUPER_ADMIN"
      ? ["ADMIN", "SUPER_ADMIN"]
      : ["EMPLOYEE"];

  // Reset flow when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedRole(null);
      setEmployeeDetails(null);
      setSalaryData(null);
      setContributionsData([]);
      setAllowancesData([]);
      setCredentials({ username: "", password: "" });
    }
  }, [open]);

  // -----------------------------
  // FINAL SUBMIT AFTER ALLOWANCES
  // -----------------------------
  const handleFinalSubmit = async (
    finalAllowances: any[] = [],
    roleOverride?: string
  ) => {
    const roleToUse = roleOverride || selectedRole;

    try {
      const payload = {
        ...employeeDetails,
        role: roleToUse,
        salary: roleToUse === "SUPER_ADMIN" ? null : salaryData,
        contributions: roleToUse === "SUPER_ADMIN" ? [] : contributionsData,
        allowances: finalAllowances,
      };

      console.log("ROLE BEING SENT:", roleToUse);
      console.log("FULL PAYLOAD:", payload);

      const res = await api.post(
        "/employees/employees/create-full-employee/",
        payload
      );

      setCredentials({
        username: res.data.username,
        password: res.data.password,
      });

      setStep(6);
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to create employee");
    }
  };

  return (
    <>
      {/* Step 1: Employee Details */}
      {step === 1 && (
        <EmployeeDetailsModal
          open={open}
          departmentId={departmentId}
          allowedRoles={allowedRoles}
          initialValues={employeeDetails}
          onNext={(data) => {
            setEmployeeDetails(data);

            if (data.role === "SUPER_ADMIN") {
              handleFinalSubmit([], data.role); // pass role directly
            } else {
              setSelectedRole(data.role);
              setStep(2);
            }
          }}
          onClose={onClose}
        />
      )}

      {/* Step 2: Salary */}
      {step === 2 && (
        <EmployeeSalaryModal
          open
          initialValues={salaryData}
          onNext={(data) => {
            setSalaryData(data);
            setStep(3);
          }}
          onBack={() => setStep(1)}
          onClose={onClose}
        />
      )}

      {/* Step 3: Contributions */}
      {step === 3 && (
        <EmployeeContributionsModal
          open
          initialValues={contributionsData}
          salaryBase={salaryData?.base_rate}
          onBack={() => setStep(2)}
          onNext={(data) => {
            setContributionsData(data);
            setStep(4);
          }}
          onClose={onClose}
        />
      )}

      {/* Step 4: Allowances */}
      {step === 4 && (
        <EmployeeAllowanceModal
          open
          initialValues={allowancesData}   // previous data is passed
          onNext={(data) => {
            handleFinalSubmit(data);
          }}
          onBack={() => setStep(3)}
          onClose={onClose}
        />
      )}

      {/* Step 5: Credentials (DISPLAY ONLY AFTER FINAL SUBMIT) */}
      {step === 6 && (
        <EmployeeCredentialsModal
          open
          credentials={credentials} // show backend-generated username/password
          onNext={() => {
            setStep(1);
            onClose();
          }}
          onClose={() => {
            setStep(1);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default AddEmployeeFlow;