import { apiClient } from '../api';
import type { Profile, UpdateProfileRequest } from '@/types/tourism/stakeholders/v1/stakeholders';

export async function getProfile(userId: string): Promise<Profile> {
  const response = await apiClient.get<Profile>(`/stakeholders/profiles/${userId}`);
  return response.data;
}

export async function updateProfile(userId: string, data: Partial<UpdateProfileRequest>): Promise<Profile> {
  const response = await apiClient.put<Profile>(`/stakeholders/profiles/${userId}`, data);
  return response.data;
}

export async function deleteProfilePhoto(userId: string): Promise<Profile> {
  const response = await apiClient.delete<Profile>(`/stakeholders/profiles/${userId}/photo`);
  return response.data;
}