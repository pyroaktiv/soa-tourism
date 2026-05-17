// src/lib/services/simulatorService.ts
import { apiClient } from '../api';

export async function getPosition() {
    const response = await apiClient.get('/simulator/position');
    return response.data;
}

export async function updatePosition(latitude: number, longitude: number) {
    const response = await apiClient.put('/simulator/position', { latitude, longitude });
    return response.data;
}