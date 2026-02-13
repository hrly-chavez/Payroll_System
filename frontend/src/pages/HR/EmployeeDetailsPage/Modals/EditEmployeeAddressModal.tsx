//src/pages/HR/EmployeeDetailPage/Modals/EditEmployeeAddressModal.tsx
import React, { useEffect, useState } from "react";
import { Modal, Form, Select, Input, Button, Row, Col, message } from "antd";
import api from "api/axios";

const { Option } = Select;

interface Props {
  open: boolean;
  address: any;
  employeeId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const EditEmployeeAddressModal: React.FC<Props> = ({
  open,
  address,
  employeeId,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  /* =====================
     FETCH DROPDOWNS
  ====================== */
  useEffect(() => {
    api.get("/employees/provinces/").then(res => setProvinces(res.data));
  }, []);

  useEffect(() => {
    const provinceId =
        form.getFieldValue("province")?.value ||
        address?.province?.id;

    if (!provinceId) return;

    api
        .get(`/employees/provinces/${provinceId}/cities/`)
        .then(res => setCities(res.data));
    }, [open, address, form]);


  useEffect(() => {
    const cityId =
        form.getFieldValue("city")?.value ||
        address?.city?.id;

    if (!cityId) return;

    api
        .get(`/employees/cities/${cityId}/barangays/`)
        .then(res => setBarangays(res.data));
    }, [open, address, form]);


  /* =====================
     POPULATE FORM
  ====================== */
  useEffect(() => {
    if (!open || !address) return;

    form.setFieldsValue({
        province: address.province?.id,
        city: address.city?.id,
        barangay: address.barangay?.id,
        sitio: address.sitio,
        street: address.street,
        zip_code: address.zip_code,
    });
    }, [open, address, form]);



  /* =====================
     HANDLERS
  ====================== */
  const handleProvinceChange = (provinceId: number) => {
    form.setFieldsValue({
        city: undefined,
        barangay: undefined,
    });

    setCities([]);
    setBarangays([]);

    api
        .get(`/employees/provinces/${provinceId}/cities/`)
        .then(res => setCities(res.data));
    };

    const handleCityChange = (cityId: number) => {
    form.setFieldsValue({
        barangay: undefined,
    });

    setBarangays([]);

    api
        .get(`/employees/cities/${cityId}/barangays/`)
        .then(res => setBarangays(res.data));
    };



    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
            address: {
                province: values.province,
                city: values.city,
                barangay: values.barangay,
                street: values.street,
                sitio: values.sitio || "",
                zip_code: values.zip_code,
            },
            };

            await api.patch(
            `/employees/employees/${employeeId}/update/`,
            payload
            );

            message.success("Address updated successfully");
            onSuccess();
        } catch (err: any) {
            console.error(err.response?.data || err);
            message.error("Failed to update address");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
    if (!open) {
        form.resetFields();
        setCities([]);
        setBarangays([]);
    }
    }, [open, form]);


  return (
    <Modal title="Edit Address" open={open} onCancel={onClose} footer={null} centered>
      <Form layout="vertical" form={form}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="province" label="Province" rules={[{ required: true }]}>
                <Select
                    placeholder="Select Province"
                    onChange={handleProvinceChange}
                >
                    {provinces.map(p => (
                    <Option key={p.id} value={p.id}>
                        {p.name}
                    </Option>
                    ))}
                </Select>
            </Form.Item>

          </Col>

          <Col span={12}>
            <Form.Item name="city" label="City / Municipality" rules={[{ required: true }]}>
                <Select
                    placeholder="Select City"
                    onChange={handleCityChange}
                    disabled={cities.length === 0}
                >
                    {cities.map(c => (
                    <Option key={c.id} value={c.id}>
                        {c.name}
                    </Option>
                    ))}
                </Select>
            </Form.Item>

          </Col>

          <Col span={12}>
            <Form.Item name="barangay" label="Barangay" rules={[{ required: true }]}>
                <Select
                    placeholder="Select Barangay"
                    disabled={barangays.length === 0}
                >
                    {barangays.map(b => (
                    <Option key={b.id} value={b.id}>
                        {b.name}
                    </Option>
                    ))}
                </Select>
            </Form.Item>

          </Col>

          <Col span={12}>
            <Form.Item name="sitio" label="Sitio">
              <Input />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="street" label="Street" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="zip_code" label="Zip Code" rules={[{ required: true }]}>
              <Input maxLength={4} />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ textAlign: "right" }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            Save
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EditEmployeeAddressModal;
