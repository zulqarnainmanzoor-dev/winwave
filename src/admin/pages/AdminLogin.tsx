import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface AdminLoginProps {}

const AdminLogin: React.FC<AdminLoginProps> = () => {
  const [secretId, setSecretId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { secretId: urlSecretId } = useParams<{ secretId?: string }>();

  const MAIN_ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET_ID || '3399944';
  const SUB_ADMIN_SECRET = import.meta.env.VITE_SUBADMIN_SECRET_ID || '1234567';

  // Check if already authenticated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminRole = sessionStorage.getItem('admin_role');
      const adminAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
      if (adminAuthenticated && (adminRole === 'main-admin' || adminRole === 'sub-admin')) {
        navigate('/admin/dashboard', { replace: true });
      }
    }

    // Auto-fill from URL if provided
    if (urlSecretId) {
      setSecretId(urlSecretId);
    }
  }, [navigate, urlSecretId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!secretId.trim()) {
      setError('Please enter the admin secret ID');
      return;
    }

    setLoading(true);

    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (secretId === MAIN_ADMIN_SECRET) {
        sessionStorage.setItem('admin_authenticated', 'true');
        sessionStorage.setItem('admin_role', 'main-admin');
        
        // Show loading animation for 1.5 seconds, then redirect
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoading(false);
        navigate('/admin/dashboard', { replace: true });
        return;
      } else if (secretId === SUB_ADMIN_SECRET) {
        sessionStorage.setItem('admin_authenticated', 'true');
        sessionStorage.setItem('admin_role', 'sub-admin');
        
        // Show loading animation for 1.5 seconds, then redirect
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoading(false);
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      setError('Invalid admin secret ID. Please try again.');
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#0A0A0B]">
      <div className="w-full max-w-sm bg-[#161618] rounded-3xl p-8 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-wider mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-400 text-sm">Enter your secret ID to access</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Secret ID Input */}
          <div className="relative">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
              Admin Secret ID
            </label>
            <input
              type="password"
              value={secretId}
              onChange={(e) => setSecretId(e.target.value)}
              placeholder="Enter secret ID"
              disabled={loading}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              autoFocus
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-xs text-center font-bold animate-pulse">
              {error}
            </div>
          )}

          {/* Loading State or Submit Button */}
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-[#ffa502] rounded-full animate-spin" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                Verifying credentials...
              </p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-[#ffa502] hover:brightness-110 hover:shadow-lg hover:shadow-amber-500/30 active:scale-95 text-black font-black py-3 rounded-xl transition-all uppercase text-sm tracking-widest cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              Login
            </button>
          )}
        </form>

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-gray-500 text-xs">
            Admin access only. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;