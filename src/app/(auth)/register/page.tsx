'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      orgName: formData.get('orgName'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: formData.get('password'),
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || 'Error al crear la cuenta');
        return;
      }

      toast.success('Cuenta creada exitosamente! Redirigiendo al login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      toast.error('Error de conexion. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
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
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription>Registra tu organizacion en Hirely</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nombre de la empresa</Label>
                <Input id="orgName" name="orgName" placeholder="Mi Empresa S.A.S." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input id="firstName" name="firstName" placeholder="Juan" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input id="lastName" name="lastName" placeholder="Perez" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
                <Input id="email" name="email" type="email" placeholder="juan@empresa.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
                <Input id="password" name="password" type="password" placeholder="Min. 8 caracteres" minLength={8} required />
              </div>

              <Button
                type="submit"
                className="w-full bg-teal hover:bg-teal/90 text-white"
                disabled={loading}
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Ya tienes una cuenta?{' '}
              <Link href="/login" className="text-teal hover:underline font-medium">
                Inicia sesion
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
