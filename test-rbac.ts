
import axios from 'axios';
import { expect } from 'expect';

const API_URL = 'http://localhost:5002/api';

// You might need to adjust these credentials or create a setup script to ensure these users exist
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

let adminToken: string;
let managerToken: string;
let employeeToken: string;
let companyId: number;

async function runTests() {
    console.log('Starting RBAC Tests...');

    try {
        // 1. Authenticate as Admin (Requirement: You must have an admin user in your DB)
        // If not, we might need to signup one first.
        // Assuming we can signup as admin for this test
        try {
            console.log('Creating Admin...');
            const adminRes = await axios.post(`${API_URL}/auth/signup`, {
                name: 'Admin User',
                email: `admin_${Date.now()}@test.com`,
                password: 'password123',
                businessName: 'Test Company',
                phone: '1234567890'
            });
            adminToken = adminRes.data.token;
            console.log('Admin created and logged in.');
        } catch (e: any) {
            console.error('Failed to create admin:', e.response?.data || e.message);
            return;
        }

        const authHeader = (token: string) => ({ headers: { 'x-auth-token': token } });

        // 2. Create Manager User (As Admin)
        console.log('Creating Manager...');
        const managerRes = await axios.post(`${API_URL}/employees`, {
            name: 'Manager User',
            email: `manager_${Date.now()}@test.com`,
            password: 'password123',
            role: 'manager'
        }, authHeader(adminToken));
        // We need to login as manager to get token
        const managerLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: managerRes.data.email,
            password: 'password123'
        });
        managerToken = managerLoginRes.data.token;
        console.log('Manager created and logged in.');

        // 3. Create Employee User (As Admin)
        console.log('Creating Employee...');
        const employeeRes = await axios.post(`${API_URL}/employees`, {
            name: 'Standard Employee',
            email: `employee_${Date.now()}@test.com`,
            password: 'password123',
            role: 'employee'
        }, authHeader(adminToken));
        const employeeLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: employeeRes.data.email,
            password: 'password123'
        });
        employeeToken = employeeLoginRes.data.token;
        console.log('Employee created and logged in.');

        // 4. Test Manager Permissions
        console.log('\n--- Testing Manager Permissions ---');

        // Manager should be able to create a product
        console.log('Test: Manager creating product (Should Succeed)');
        try {
            await axios.post(`${API_URL}/products`, {
                name: 'Manager Product',
                sku: `SKU_${Date.now()}`,
                price: 20,
                cost: 10,
                stockQuantity: 100
            }, authHeader(managerToken));
            console.log('✅ Success');
        } catch (e: any) {
            console.error('❌ Failed:', e.response?.data || e.message);
        }

        // Manager should NOT be able to create an employee
        console.log('Test: Manager creating employee (Should Fail)');
        try {
            await axios.post(`${API_URL}/employees`, {
                name: 'Unauthorized Employee',
                email: `fail_${Date.now()}@test.com`,
                password: 'password123',
                role: 'employee'
            }, authHeader(managerToken));
            console.error('❌ Failed: Manager was able to create employee');
        } catch (e: any) {
            if (e.response && e.response.status === 403) {
                console.log('✅ Success: Access denied as expected');
            } else {
                console.error('❌ Unexpected error:', e.response?.data || e.message);
            }
        }

        // 5. Test Employee Permissions
        console.log('\n--- Testing Employee Permissions ---');

        // Employee should NOT be able to create a product
        console.log('Test: Employee creating product (Should Fail)');
        try {
            await axios.post(`${API_URL}/products`, {
                name: 'Employee Product',
                sku: `SKU_EMP_${Date.now()}`,
                price: 20,
                cost: 10,
                stockQuantity: 100
            }, authHeader(employeeToken));
            console.error('❌ Failed: Employee was able to create product');
        } catch (e: any) {
            if (e.response && e.response.status === 403) {
                console.log('✅ Success: Access denied as expected');
            } else {
                console.error('❌ Unexpected error:', e.response?.data || e.message);
            }
        }

        // Employee should be able to VIEW products
        console.log('Test: Employee viewing products (Should Succeed)');
        try {
            await axios.get(`${API_URL}/products`, authHeader(employeeToken));
            console.log('✅ Success');
        } catch (e: any) {
            console.error('❌ Failed:', e.response?.data || e.message);
        }

        console.log('\nTests Completed.');

    } catch (error: any) {
        console.error('Test script error:', error.message);
    }
}

runTests();
