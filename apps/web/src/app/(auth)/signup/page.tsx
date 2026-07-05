'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignupPage() {
  const [restaurantName, setRestaurantName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({ restaurantName, name, email, password });
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Start your free trial</h1>
        <p className="text-sm text-gray-500 mb-6">14 days free · no card required</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="restaurantName"
            label="Restaurant name"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Golden Fork"
            required
          />
          <Input
            id="name"
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aarav Sharma"
            required
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            minLength={8}
            required
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
          <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
            Create my restaurant
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-5 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
