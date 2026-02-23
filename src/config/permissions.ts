export type Role = 'admin' | 'manager' | 'employee';

export const ROLES: Role[] = ['admin', 'manager', 'employee'];

export type Permission =
    | 'MANAGE_EMPLOYEES'
    | 'VIEW_EMPLOYEES'
    | 'MANAGE_PRODUCTS'
    | 'VIEW_PRODUCTS'
    | 'MANAGE_CUSTOMERS'
    | 'VIEW_CUSTOMERS'
    | 'MANAGE_INVOICES'
    | 'VIEW_INVOICES'
    | 'MANAGE_COMPANY'
    | 'VIEW_REPORTS';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'MANAGE_EMPLOYEES', 'VIEW_EMPLOYEES',
        'MANAGE_PRODUCTS', 'VIEW_PRODUCTS',
        'MANAGE_CUSTOMERS', 'VIEW_CUSTOMERS',
        'MANAGE_INVOICES', 'VIEW_INVOICES',
        'MANAGE_COMPANY', 'VIEW_REPORTS'
    ],
    manager: [
        'VIEW_EMPLOYEES',
        'MANAGE_PRODUCTS', 'VIEW_PRODUCTS',
        'MANAGE_CUSTOMERS', 'VIEW_CUSTOMERS',
        'MANAGE_INVOICES', 'VIEW_INVOICES',
        'VIEW_REPORTS'
    ],
    employee: [
        'VIEW_PRODUCTS',
        'VIEW_CUSTOMERS',
        'MANAGE_INVOICES', 'VIEW_INVOICES'
    ]
};
