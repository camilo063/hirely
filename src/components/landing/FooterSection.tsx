'use client';

import Link from 'next/link';

const productLinks = [
  { label: 'Producto', href: '#problem' },
  { label: 'Modulos', href: '#modules' },
  { label: 'Integraciones', href: '#integrations' },
  { label: 'Precios', href: '#pricing' },
];

const legalLinks = [
  { label: 'Privacidad', href: '/privacidad' },
  { label: 'Terminos', href: '/terminos' },
];

export default function FooterSection() {
  return (
    <footer className="bg-[#0A1F3F] py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal font-black text-navy">
                H
              </div>
              <span className="text-lg font-bold text-white">Hirely</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
              Plataforma integral de reclutamiento con inteligencia artificial. Del CV al contrato
              firmado, todo automatizado en un solo lugar.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
              Producto
            </h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-center text-xs text-white/40">
            &copy; 2026 Hirely. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

export { FooterSection };
