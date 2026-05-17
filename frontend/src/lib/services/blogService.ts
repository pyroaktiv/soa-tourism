// src/lib/services/blogService.ts
import { apiClient } from '../api';
import type { Blog, CreateBlogRequest, GetAllBlogsResponse, Comment } from '@/types/tourism/blog/v1/blog';

export async function createBlog(data: CreateBlogRequest): Promise<Blog> {
  const response = await apiClient.post<Blog>('/blogs', data);
  return response.data;
}

export async function getAllBlogs(): Promise<Blog[]> {
  const response = await apiClient.get<GetAllBlogsResponse>('/blogs');
  return response.data.blogs || [];
}

export async function getBlog(id: string): Promise<Blog> {
  const response = await apiClient.get<Blog>(`/blogs/${id}`);
  return response.data;
}

export async function toggleLike(blogId: string, userId: string): Promise<Blog> {
  const response = await apiClient.post<Blog>(`/blogs/${blogId}/toggle-like`, { blogId, userId });
  return response.data;
}

export async function addComment(blogId: string, userId: string, text: string): Promise<Blog> {
  const comment: Comment = {
    authorId: userId,
    text: text,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    authorUsername: ""
  };
  
  const response = await apiClient.post<Blog>(`/blogs/${blogId}/comments`, comment);
  return response.data;
}