export const SYSTEM_PERMISSIONS = [
    { key: "view_dashboard", label: "View Dashboard" },
    { key: "pos_access", label: "Access POS" },
    { key: "view_transactions", label: "View Transactions" },
    { key: "manage_products", label: "Manage Products (Inventory)" },
    { key: "manage_customers", label: "Manage Customers" },
    { key: "manage_suppliers", label: "Manage Suppliers" },
    { key: "manage_employees", label: "Manage Employees" },
    { key: "view_reports", label: "View Reports" },
    { key: "manage_settings", label: "Manage Settings" },
    { key: "manage_profile", label: "Manage Company Profile" },
];

export const DEFAULT_ROLES = ["admin", "manager", "employee", "cashier"];

export const getDefaultPermissions = (role: string): string[] => {
    const allKeys = SYSTEM_PERMISSIONS.map(p => p.key);

    switch (role) {
        case 'admin':
            return allKeys;
        case 'manager':
            // Manager: everything except settings/employees/profile maybe?
            // "employee can manage product list" -> so Manager should definitely too.
            // Let's give manager everything except maybe sensitive company settings?
            // For now, let's say Manager has access to everything except `manage_settings` (Application Settings).
            return allKeys.filter(k => k !== 'manage_settings' && k !== 'manage_profile');
        case 'cashier':
            // "cashier will only be able to access transaction page" (and POS probably)
            return ['pos_access', 'view_transactions', 'view_dashboard'];
        case 'employee':
            // "employee can manage product list"
            return ['view_dashboard', 'manage_products', 'manage_customers', 'manage_suppliers', 'pos_access'];
        default:
            return [];
    }
};
