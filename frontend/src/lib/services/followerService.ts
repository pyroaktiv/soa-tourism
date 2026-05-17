import { apiClient } from '../api';
import type { IsFollowingResponse, GetRecommendationsResponse } from '@/types/tourism/follower/v1/follower';

export async function followUser(followeeId: string): Promise<void> {
  await apiClient.post(`/followers/${followeeId}/follow`, {});
}

export async function unfollowUser(followeeId: string): Promise<void> {
  await apiClient.delete(`/followers/${followeeId}/follow`);
}

export async function checkIsFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const res = await apiClient.get<IsFollowingResponse>(`/followers/${followerId}/following/${followeeId}`);
  return res.data.isFollowing || false;
}

export async function getRecommendations(limit: number = 10): Promise<GetRecommendationsResponse> {
  const res = await apiClient.get<GetRecommendationsResponse>('/followers/recommendations', { 
    params: { limit } 
  });
  return res.data;
}