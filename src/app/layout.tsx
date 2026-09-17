import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Galaxia | Miguel Trigoso',
  description:
    'Experiencia galáctica interactiva desarrollada por Miguel Trigoso, Full Stack Developer especializado en backend, integraciones y datos.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
