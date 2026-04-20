import { createContext, useContext, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('cad_user');
    return u ? JSON.parse(u) : null;
  });

  const token = localStorage.getItem('cad_token');
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('cad_token', data.token);
    localStorage.setItem('cad_user', JSON.stringify(data.user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password });
    localStorage.setItem('cad_token', data.token);
    localStorage.setItem('cad_user', JSON.stringify(data.user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('cad_token');
    localStorage.removeItem('cad_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
