export * from "./database";

// Navigation types
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  children?: NavItem[];
}

// API response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

// Table/list types
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
