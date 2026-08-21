import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  // Tarayıcının hafızasında 'token' var mı diye bakıyoruz
  const token = localStorage.getItem('token');

  if (!token) {
    // Eğer token yoksa (giriş yapmamışsa) onu zorla /login sayfasına geri postala
    return <Navigate to="/login" replace />;
  }

  // Eğer token varsa, gitmek istediği sayfayı (children) ona göster
  return children;
}