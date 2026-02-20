import { useState, useEffect } from "react";
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

const AddEmployeeFlow: React.FC<Props> = ({
  open,
  departmentId,
  onClose,
}) => {
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const currentUserRole = localStorage.getItem("role");

  const allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[] =
    currentUserRole === "SUPER_ADMIN"
      ? ["ADMIN", "SUPER_ADMIN"] // this is where you add the Roles value in EmployeeDetailsModal
      : ["EMPLOYEE"];



  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    if (open) {
      setStep(1);
      setEmployeeId(null);
      setSelectedRole(null);
      setCredentials({ username: "", password: "" });
    }
  }, [open]);

  return (
    <>
      {/* Step 1: Employee Details */}
      {step === 1 && (
        <EmployeeDetailsModal
          open={open}
          departmentId={departmentId}
          allowedRoles={allowedRoles}
          onNext={(id, creds, role) => {
            setEmployeeId(id);
            setCredentials(creds);
            setSelectedRole(role); 
            setStep(2);
          }}
          onClose={onClose}
        />
      )}

      {/* Step 2: Credentials */}
      {step === 2 && (
        <EmployeeCredentialsModal
          open
          credentials={credentials}
          onNext={() => {
            if (selectedRole === "SUPER_ADMIN") {
              // ✅ Reset everything first
              setStep(1);
              setEmployeeId(null);
              setSelectedRole(null);
              setCredentials({ username: "", password: "" });

              onClose(); // then close modal
              return;
            }

            setStep(3);
          }}
          onClose={() => {
            // also handle manual cancel
            setStep(1);
            onClose();
          }}
        />
      )}

      {/* Step 3: Salary */}
      {step === 3 && employeeId && (
        <EmployeeSalaryModal
          open
          employeeId={employeeId}
          onNext={() => setStep(4)}
          onClose={onClose}
        />
      )}

      {/* Step 4: Contributions */}
      {step === 4 && employeeId && (
        <EmployeeContributionsModal
          open
          employeeId={employeeId}
          onNext={() => setStep(5)}
          onClose={onClose}
        />
      )}

      {/* Step 5: Allowances */}
      {step === 5 && employeeId && (
        <EmployeeAllowanceModal
          open
          employeeId={employeeId}
          onClose={onClose}
          onNext={() => setStep(6)}
        />
      )}
    </>
  );
};

export default AddEmployeeFlow;
