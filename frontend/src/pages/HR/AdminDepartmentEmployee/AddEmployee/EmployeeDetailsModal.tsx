import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Button, DatePicker, Row, Col, message, Upload } from "antd";
import api from "../../../../api/axios";
import styles from "../AddAdDeptEmployee.module.css";
import dayjs from "dayjs";
import { UploadOutlined, EyeOutlined, DeleteOutlined } from "@ant-design/icons";
import { RcFile } from "antd/es/upload";

const { Option } = Select;

interface Props {
  open: boolean;
  departmentId: number;
  allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[];
  initialValues?: any;
  onNext: (data: any) => void;   // now just send form data
  onClose: () => void;
}



interface Shift {
  id: number;
  start_time: string;
  end_time: string;
}

interface Department {
  id: number;
  name: string;
  shift?: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    display_time: string;
  } | null;
}

interface Province {
  id: number;
  name: string;
}

interface City {
  id: number;
  name: string;
}

interface Barangay {
  id: number;
  name: string;
}

const EmployeeDetailsModal: React.FC<Props> = ({ open, departmentId , allowedRoles, initialValues, onNext, onClose }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && initialValues) {
      const formattedValues = { ...initialValues };

      // Convert hired_date string to Dayjs if it exists
      if (formattedValues.hired_date) {
        formattedValues.hired_date = dayjs(formattedValues.hired_date);
      }

      form.setFieldsValue(formattedValues);
    }
  }, [open, initialValues]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  // Show role selector only if SUPER_ADMIN is allowed
  const showRoleField = allowedRoles.includes("SUPER_ADMIN");

  //photo
  // Inside your component, before return
  const [fileList, setFileList] = useState<any[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>("");

  // ------------------------
  // Handle Upload Change
  // ------------------------
  const handleChange = ({ fileList: newFileList }: any) => {
    const filteredList = newFileList.filter((file: any) => {
      const isValidType = ["image/jpeg", "image/png", "image/jpg"].includes(file.type);
      const isValidSize = file.size / 1024 / 1024 < 2;
      if (!isValidType) message.error(`${file.name} is not a JPG/PNG file`);
      if (!isValidSize) message.error(`${file.name} exceeds 2MB`);
      return isValidType && isValidSize;
    });
    setFileList(filteredList);
  };

  // ------------------------
  // Handle Preview
  // ------------------------
  const handlePreview = async (file: any) => {
    // Generate preview only if it doesn’t exist
    if (!file.url && !file.preview && file.originFileObj) {
      file.preview = await getBase64(file.originFileObj);
    }
    setPreviewImage(file.url || file.preview || "");
    setPreviewVisible(true);
  };

  // Convert file to base64 for preview
  const getBase64 = (file: RcFile | Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });

  const formatTime = (t: string) => t.slice(0, 5);

  // Fetch dropdown data
  useEffect(() => {
    api.get("/employees/shifts/").then(res => setShifts(res.data));

    api.get("/employees/departments/").then(res => {
      const deptData = res.data;
      setDepartments(deptData);

      if (departmentId) {
        const selectedDept = deptData.find(
          (d: Department) => d.id === departmentId
        );

        form.setFieldsValue({
          department: departmentId,
          shift: selectedDept?.shift?.id ?? undefined
        });
      }
    });

    api.get("/employees/provinces/").then(res => setProvinces(res.data));
  }, [departmentId]);

  const handleProvinceChange = (provinceId: number) => {
    form.setFieldsValue({ address: { city: null, barangay: null } });
    setCities([]);
    setBarangays([]);
    if (!provinceId) return;

    api.get(`/employees/provinces/${provinceId}/cities/`).then(res => setCities(res.data));
  };

  const handleCityChange = (cityId: number) => {
    form.setFieldsValue({ address: { barangay: null } });
    setBarangays([]);
    if (!cityId) return;

    api.get(`/employees/cities/${cityId}/barangays/`).then(res => setBarangays(res.data));
  };

  const handleNext = async () => {
    try {
      // -----------------------
      // Validate profile picture
      // -----------------------
      if (fileList.length > 0) {
        const file = fileList[0];
        if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
          message.error("Only JPEG/PNG images allowed.");
          return; // stop submission
        }
        if (file.size > 2 * 1024 * 1024) {
          message.error("Image size should not exceed 2MB");
          return; // stop submission
        }
      }

      // -----------------------
      // Validate the rest of the form
      // -----------------------
      const values = await form.validateFields();

      // Check email first before proceeding
      const response = await api.get(
        `/employees/employees/check-email/?email=${values.email}`
      );

      if (response.data.exists) {
        message.error("Email already exists.");
        return; // stop here
      }

      const formattedData = {
        ...values,
        hired_date: values.hired_date.format("YYYY-MM-DD"),
        role: values.role || "EMPLOYEE",
        profile_picture: fileList[0]?.originFileObj || null,
      };

      onNext(formattedData);

    } catch (err: any) {
      message.error("Please complete required fields");
    }
  };
  
  return (
    <Modal
      title="Employee Details"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={1000}
      className={styles.modal}
      closable={false}
    >
      <Form layout="vertical" form={form} className={styles.form}>
        <Row gutter={16}>
          {/* Employee Basic Info */}
          <Col xs={24} md={8}>
            <Form.Item
              name="profile_picture"
              label="Profile Picture"
              valuePropName="file"
              getValueFromEvent={(e) => e.fileList[0]?.originFileObj}
            >
              <Upload
                listType="text"
                fileList={fileList}
                beforeUpload={() => false} // prevent auto upload
                onChange={handleChange}
                accept=".jpeg,.jpg,.png"
                maxCount={1}
                itemRender={(originNode, file) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{file.name}</span>
                    <EyeOutlined
                      style={{ cursor: "pointer" }}
                      onClick={() => handlePreview(file)}
                    />
                    <DeleteOutlined
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setFileList(fileList.filter(f => f.uid !== file.uid))
                      }
                    />
                  </div>
                )}
              >
                <Button icon={<UploadOutlined />}>Select File</Button>
              </Upload>
            </Form.Item>

            <Modal
              open={previewVisible}
              footer={null}
              onCancel={() => setPreviewVisible(false)}
            >
              <img
                style={{ width: "100%" }}
                src={previewImage}
                alt="Preview"
              />
            </Modal>
          </Col>

          <Col xs={24} md={8}>
          <Form.Item
            name="fname"
            label="First Name"
            rules={[
              { required: true, message: "First name is required" },
              {
                pattern: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
                message: "Letters and single spaces only (e.g., Shaira Mae)"
              }       
            ]}
          >
            <Input />
          </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="initial" label="Middle Initial (Optional)"
            rules={[
              { pattern: /^[A-Za-z]+$/, message: "Alphabet letters only" }
            ]}>
              <Input maxLength={1} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
          <Form.Item
            name="lname"
            label="Last Name"
            rules={[
              { required: true, message: "Last name is required" },
              {
                pattern: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
                message: "Letters and single spaces only (e.g., Dela Cruz)"
              }
            ]}
          >
            <Input />
          </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="suffix" label="Suffix">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              name="employment_status"
              label="Employment Status"
              rules={[{ required: true, message: "Employment status is required" }]}
            >
              <Select placeholder="Select employment status">
                <Option value="REGULAR">Regular</Option>
                <Option value="PROBATION">Probation</Option>
                <Option value="NEW_HIRE">New Hire</Option>
                <Option value="OJT">OJT</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="status" label="Marital Status" rules={[{ required: true }]}>
              <Select>
                <Option value="SINGLE">Single</Option>
                <Option value="MARRIED">Married</Option>
                <Option value="WIDOWED">Widowed</Option>
                <Option value="SEPARATED">Separated</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
          <Form.Item
            name="contact_no"
            label="Contact Number"
            rules={[
              { required: true, message: "Contact number is required" },
              {
                pattern: /^[0-9]{11}$/,
                message: "Contact number must be exactly 11 digits"
              }
            ]}
          >
            <Input inputMode="numeric" maxLength={11} />
          </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="hired_date" label="Hired Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="position" label="Position" rules={[{ required: true,pattern: /^[A-Za-z\s]+$/, message: "Alphabet letters only" }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="bank_info" label="Bank Information">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="shift" label="Shift">
              <Select>
                {shifts.map(s => (
                  <Option key={s.id} value={s.id}>
                    {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name="department" label="Department" rules={[{ required: true }]}>
              <Select
                options={departments.map(d => ({
                  value: d.id,  
                  label: d.name,
                }))}
                onChange={(value) => {
                  const selectedDept = departments.find(d => d.id === value);
                  form.setFieldsValue({
                    shift: selectedDept?.shift?.id || undefined,
                  });
                }}
              />
            </Form.Item>
          </Col>
          
          {showRoleField && (
            <Col xs={24} md={8}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true }]}
              >
                <Select>
                  {allowedRoles.map((role) => (
                    <Select.Option key={role} value={role}>
                      {role.replace("_", " ")}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          )}

          {/* Address */}
          <Col span={24}><h3>Address</h3></Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "province"]} label="Province" rules={[{ required: true }]}>
              <Select placeholder="Select Province" onChange={handleProvinceChange}>
                {provinces.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "city"]} label="City / Municipality" rules={[{ required: true }]}>
              <Select placeholder="Select City" onChange={handleCityChange} disabled={cities.length === 0}>
                {cities.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "barangay"]} label="Barangay" rules={[{ required: true }]}>
              <Select placeholder="Select Barangay" disabled={barangays.length === 0}>
                {barangays.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "sitio"]} label="Sitio">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "street"]} label="Street" rules={[{ pattern: /^[A-Za-z0-9\s]+$/, message: "No special characters allowed" }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item name={["address", "zip_code"]} label="Zip Code" rules={[{ pattern: /^[0-9]+$/, message: "Numbers only" }]}>
              <Input maxLength={4} />
            </Form.Item>
          </Col>
        </Row>

        <div className={styles.actions}>
          <Button type="primary" onClick={handleNext}>
            Next
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EmployeeDetailsModal;
