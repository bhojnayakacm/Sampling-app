import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Mail, CheckCircle, LayoutDashboard } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success('Password reset link sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  }

  // Success state after email is sent
  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
        <Card className="w-full max-w-md bg-white border border-slate-200 shadow-lg rounded-xl">
          <CardHeader className="space-y-1 text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Check Your Email</CardTitle>
            <CardDescription className="text-base text-slate-500">
              We've sent a password reset link to:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-center font-medium text-slate-900 bg-slate-100 rounded-lg py-2.5 px-3">
              {email}
            </p>
            <p className="text-center text-sm text-slate-500">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <div className="text-center text-sm text-slate-500">
              Didn't receive the email?{' '}
              <button
                onClick={() => setEmailSent(false)}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Try again
              </button>
            </div>
            <div className="pt-2">
              <Link to="/login">
                <Button variant="outline" className="w-full min-h-[44px] border-slate-200 text-slate-600 hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initial form state
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
      <Card className="w-full max-w-md bg-white border border-slate-200 shadow-lg rounded-xl">
        <CardHeader className="space-y-1 text-center pb-2">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Forgot Password?</CardTitle>
          <CardDescription className="text-slate-500">
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-10 h-11 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full min-h-[48px] text-base font-semibold bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
