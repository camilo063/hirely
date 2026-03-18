'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Credenciales invalidas. Verifica tu email y contrasena.');
      } else if (result?.ok) {
        toast.success('Bienvenido!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      toast.error('Error al iniciar sesion. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('admin@hirely.app');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-light-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-teal rounded-xl flex items-center justify-center font-bold text-white text-lg">
              H
            </div>
            <span className="text-2xl font-bold text-navy">Hirely</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Bienvenido de vuelta</CardTitle>
            <CardDescription>Inicia sesion en tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contrasena</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Tu contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-teal hover:bg-teal/90 text-white"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : 'Iniciar sesion'}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              No tienes una cuenta?{' '}
              <Link href="/register" className="text-teal hover:underline font-medium">
                Registrate
              </Link>
            </p>

            <div className="mt-4 p-3 bg-soft-gray rounded-lg text-xs text-muted-foreground">
              <p className="font-medium mb-1">Credenciales de demo:</p>
              <p>Email: admin@hirely.app</p>
              <p>Password: cualquier texto (modo dev)</p>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="mt-2 text-teal hover:underline font-medium"
              >
                Usar credenciales de demo
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
