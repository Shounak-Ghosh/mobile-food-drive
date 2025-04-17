import axios from 'axios';

const API = axios.create({
  baseURL: '/api', // uses Vite proxy
});

// Request interceptor: attach access token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    console.log('[Interceptor] token:', token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log('[Interceptor] headers:', config.headers);
    return config;
  },
  (error) => Promise.reject(error)
);


// Response interceptor: refresh token on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized and not already trying to refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem('refreshToken') // or remove this check if you're using cookies
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');

        // Option 1: Using refresh token from localStorage
        const response = await axios.post('/api/auth/refresh', {
          refresh_token: refreshToken,
        });

        // Option 2: If using cookies, instead use:
        // const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });

        const newAccessToken = response.data.access_token;
        localStorage.setItem('accessToken', newAccessToken);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default API;
