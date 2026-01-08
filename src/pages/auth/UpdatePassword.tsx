import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, ShieldCheck, Loader2 } from 'lucide-react';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);

  // Check if user has a valid session (from email link)
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Invalid or expired reset link. Please request a new one.');
        navigate('/forgot-password');
        return;
      }

      setValidatingSession(false);
    }

    checkSession();
  }, [navigate]);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();

    // Validate passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  // Show loading while validating session
  if (validatingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-4 text-slate-600 font-medium">Validating reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
      <Card className="w-full max-w-md bg-white border border-slate-200 shadow-lg rounded-xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-indigo-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Set New Password</CardTitle>
          <CardDescription className="text-slate-500">
            Enter your new password below. Make sure it's at least 6 characters.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pl-10 pr-10 h-11 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pl-10 pr-10 h-11 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password requirements hint */}
            <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="font-semibold mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>At least 6 characters long</li>
                <li>Both passwords must match</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full min-h-[48px] text-base font-semibold bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
