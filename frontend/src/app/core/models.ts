export interface PropietarioAcceso {
  id: string;
  nombre: string;
  ruc_cedula: string;
  rol: {
    id: string;
    nombre: string;
  };
}

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  es_super_admin: boolean;
}

export interface AuthContext {
  propietario_id: string;
  propietario_nombre: string;
  rol_id: string;
  rol: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_in: string;
  usuario: AuthUser;
  contexto: AuthContext | null;
  propietarios: PropietarioAcceso[];
}

export interface ApiListColumn {
  label: string;
  path: string;
  type?: 'text' | 'date' | 'money' | 'boolean' | 'badge' | 'hoursTime';
}

export interface SelectOption {
  label: string;
  value: string | number | boolean;
}

export type CrudDefaultValue = string | number | boolean | null | (() => string | number | boolean | null);

export interface CatalogConfig {
  endpoint: string;
  valuePath: string;
  labelPath: string;
  labelPaths?: string[];
  labelSeparator?: string;
  params?: Record<string, string | number | boolean>;
}

export interface CrudFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'time' | 'number' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  defaultValue?: CrudDefaultValue;
  parseAs?: 'stringArray' | 'hoursTime';
  omitWhenEmpty?: boolean;
  createOnly?: boolean;
  payloadPath?: string;
  syncFrom?: string;
  min?: number;
  max?: number;
  step?: number | string;
  rows?: number;
  colClass?: string;
  options?: SelectOption[];
  catalog?: CatalogConfig;
}

export interface CrudRouteData {
  title: string;
  description: string;
  endpoint: string;
  displayField: string;
  columns: ApiListColumn[];
  fields: CrudFieldConfig[];
}
