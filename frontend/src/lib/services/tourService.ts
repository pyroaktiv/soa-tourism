import { apiClient } from '../api';

export async function createTour(data: { name: string; description: string; difficulty: number; tags: string[] }) {
  const response = await apiClient.post('/tours', data);
  return response.data;
}

export async function updateTour(id: string, data: { name: string; description: string; difficulty: number; tags: string[], price?: number }) {
  const response = await apiClient.put(`/tours/${id}`, data);
  return response.data;
}

export async function getMyTours() {
  const response = await apiClient.get('/tours/authored');
  return response.data.tours || [];
}

export async function getTour(id: string) {
  const response = await apiClient.get(`/tours/${id}`);
  return response.data;
}

export async function addTransportTime(tourId: string, transport: number, minutes: number) {
  const response = await apiClient.post(`/tours/${tourId}/transport-times`, { transport, minutes });
  return response.data;
}

export async function publishTour(id: string) {
  const response = await apiClient.post(`/tours/${id}/publish`, {});
  return response.data;
}

export async function addReview(tourId: string, rating: number, comment: string, visitDate: string, imageUrls: string[]) {
  const response = await apiClient.post(`/tours/${tourId}/reviews`, {
    tourId, rating, comment, visitDate, imageUrls
  });
  return response.data;
}

export async function addKeypoint(tourId: string, name: string, description: string, latitude: number, longitude: number, imageUrl: string) {
  const response = await apiClient.post(`/tours/${tourId}/keypoints`, {
    tourId, name, description, latitude, longitude, imageUrl
  });
  return response.data;
}

export async function archiveTour(id: string) {
  const response = await apiClient.post(`/tours/${id}/archive`, {});
  return response.data;
}

export async function reactivateTour(id: string) {
  const response = await apiClient.post(`/tours/${id}/reactivate`, {});
  return response.data;
}

export async function uploadKeypointImage(file: File): Promise<string> {
  const formData = new FormData();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const response = await apiClient.post('/tours/keypoints/images', {
          imageData: base64String,
          contentType: file.type
        });
        resolve(response.data.imageUrl);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = error => reject(error);
  });
}

export async function uploadReviewImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const response = await apiClient.post('/tours/reviews/images', {
          imageData: base64String,
          contentType: file.type
        });
        resolve(response.data.imageUrl);
      } catch (err) {
        reject(err);
      }
    };
  });
}