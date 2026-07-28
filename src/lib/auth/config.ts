import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { pool } from '@/lib/db';
import { verifyPassword, hashPassword, gastarTiempoDeVerificacion } from './password';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const result = await pool.query(
            'SELECT id, email, name, role, organization_id, avatar_url, password_hash FROM users WHERE email = $1 AND is_active = true',
            [credentials.email]
          );

          const user = result.rows[0];
          if (!user) {
            // Se consume el mismo tiempo que una verificacion real antes de
            // rechazar. Sin esto, un usuario inexistente respondia en ~30ms y uno
            // real en ~320ms: la diferencia permitia enumerar que emails tienen
            // cuenta sin acertar ni una contraseña.
            await gastarTiempoDeVerificacion();
            return null;
          }

          // Verificacion real de la contraseña.
          //
          // Antes esto no existia: la comprobacion estaba comentada y no habia
          // ninguna rama por entorno, asi que en produccion bastaba conocer un
          // email para entrar como ese usuario. `verifyPassword` acepta ademas
          // los hashes heredados en claro (`$dev$...`) para no dejar fuera a los
          // usuarios ya existentes, y avisa cuando hay que reescribirlos.
          const { valida, necesitaMigracion } = await verifyPassword(
            credentials.password as string,
            user.password_hash
          );

          if (!valida) return null;

          // Migracion transparente: el primer login correcto convierte el hash
          // legacy en bcrypt. No bloquea el acceso si falla.
          if (necesitaMigracion) {
            try {
              const nuevoHash = await hashPassword(credentials.password as string);
              await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
                user.id,
                nuevoHash,
              ]);
              console.log(`[Auth] Contraseña migrada a bcrypt para el usuario ${user.id}`);
            } catch (migrationError) {
              console.error('[Auth] No se pudo migrar el hash a bcrypt:', migrationError);
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organization_id,
            image: user.avatar_url,
          };
        } catch (error) {
          // Solo se devuelve `null` (= credenciales invalidas) ante un fallo de
          // verificacion. Un problema de infraestructura —la BD caida, un
          // timeout del pool— se relanza: presentarlo como "usuario o
          // contraseña incorrectos" manda al usuario a reintentar sin fin y
          // esconde una caida real. Observado en vivo: un
          // "Connection terminated due to connection timeout" llegaba a la
          // pantalla como CredentialsSignin.
          console.error('[Auth] Error verificando credenciales:', error);
          const mensaje = error instanceof Error ? error.message : String(error);
          const esFalloInfra = /connect|timeout|ECONNREFUSED|terminated|pool/i.test(mensaje);
          if (esFalloInfra) {
            throw new Error('El servicio de autenticacion no esta disponible. Intenta de nuevo en unos momentos.');
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role;
        token.organizationId = (user as Record<string, unknown>).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.sub;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).organizationId = token.organizationId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
