// src/components/AdminRoute.jsx
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAdmin(false);
        return;
      }

      // Check if user ID matches the hardcoded Admin ID or has a specific role in metadata
      const ADMIN_ID = "USER_UUID_OF_ADMIN"; // Or check session.user.user_metadata.role === 'admin'
      const isUserAdmin = session.user.id === ADMIN_ID; 
      
      setIsAdmin(isUserAdmin);
    };

    checkAdmin();
  }, []);

  if (isAdmin === null) return <div>Loading...</div>; // Show spinner
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return children;
}   