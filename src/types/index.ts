export interface CustomUnit {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PackagingType {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  avg_price: number;
  prev_avg_price: number;
  avg_price_updated_at: string | null;
  stock: number;
  is_addon: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  price_per_unit: number;
  created_at: string;
  item?: Item;
  pkg_type_id?: string | null;
  pkg_qty?: number | null;
  size_per_pkg?: number | null;
  pkg_type?: PackagingType;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  hpp: number;           // computed client-side by calcHPP
  prev_hpp: number;      // computed client-side by calcHPP(usePrev=true)
  is_ingredient: boolean;
  is_addon: boolean;
  unit?: string;
  stock: number;
  avg_price: number;
  batch_yield: number;
  waste_pct: number;
  created_at: string;
  recipe_items?: RecipeItem[];
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  item_id?: string | null;
  sub_recipe_id?: string | null;
  quantity_used: number;
  item?: Item;
  sub_recipe?: Recipe;
}

export interface Production {
  id: string;
  user_id: string;
  recipe_id: string;
  batches: number;
  total_cost: number;
  created_at: string;
  recipe?: Recipe;
}

export interface SaleCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface SaleAddon {
  id: string;
  sale_item_id: string;
  item_id?: string | null;
  sub_recipe_id?: string | null;
  quantity: number;
  price_per_unit_at_sale: number;
  name_at_sale: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  user_id: string;
  recipe_id: string;
  quantity_sold: number;
  selling_price: number;
  hpp_at_sale: number;
  hpp_addons_at_sale: number;
  created_at: string;
  recipe?: Recipe;
  sale?: Pick<Sale, "id" | "created_at" | "category">;
  sale_addons?: SaleAddon[];
}

export interface Sale {
  id: string;
  user_id: string;
  category_id: string | null;
  created_at: string;
  category?: SaleCategory;
  sale_items?: SaleItem[];
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  qty: number;
  price: number;
  total: number;
  note: string | null;
  created_at: string;
  category?: ExpenseCategory;
}

export interface DashboardStats {
  total_revenue: number;
  total_hpp: number;
  total_profit: number;
  profit_margin: number;
  sales_count: number;
}
