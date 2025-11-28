import { Request } from 'express';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreateIssueRequest {
  title: string;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  categoryId: string;
  subcategoryId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  isEmergency?: boolean;
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  categoryId?: string;
  subcategoryId?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  isEmergency?: boolean;
  assignedToId?: string;
}

export interface FilterOptions {
  status?: string[];
  priority?: string[];
  categoryId?: string;
  subcategoryId?: string;
  assignedToId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  isEmergency?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'USER' | 'OFFICE';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
}