import { pgTable, text, uuid, timestamp, serial, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { units } from "./units";
import { brands } from "./brands";
import { companies } from "./companies";

export const products = pgTable("products", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    unitId: integer("unit_id").references(() => units.id),
    brandId: integer("brand_id").references(() => brands.id),
    type: text("type"),
    packSize: text("pack_size"),
    price: doublePrecision("price").notNull(),
    cost: doublePrecision("cost"),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    gstType: text("gst_type"),
    gstRate: text("gst_rate"),
    imageUrl: text("image_url"),
    description: text("description"),
    discount: doublePrecision("discount").default(0.0).notNull(),
    isPercentDiscount: boolean("is_percent_discount").default(false).notNull(),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
