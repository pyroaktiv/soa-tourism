import { apiClient } from '../api';
import type {
  ShoppingCart,
  TourPurchaseToken,
} from '@/types/tourism/payment/v1/payment';

export async function getCart(): Promise<ShoppingCart> {
  const response = await apiClient.get('/cart');
  return response.data;
}

export async function addToCart(tourId: string): Promise<ShoppingCart> {
  const response = await apiClient.post('/cart/items', { tourId });
  return response.data;
}

export async function removeFromCart(tourId: string): Promise<ShoppingCart> {
  const response = await apiClient.delete(`/cart/items/${tourId}`);
  return response.data;
}

export async function checkout(): Promise<TourPurchaseToken[]> {
  const response = await apiClient.post('/cart/checkout', {});
  return response.data.tokens || [];
}

export async function listMyPurchases(): Promise<TourPurchaseToken[]> {
  const response = await apiClient.get('/purchases');
  return response.data.tokens || [];
}

export async function hasPurchased(tourId: string): Promise<boolean> {
  const response = await apiClient.get(`/purchases/check/${tourId}`);
  return Boolean(response.data.hasToken);
}
