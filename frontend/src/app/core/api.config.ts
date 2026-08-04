const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE_URL = isLocalHost ? 'http://localhost:3000/api' : '/api';
