import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Galaxia Responsive V2.1.1',
  description: 'Galaxia procedural responsive con React Three Fiber, Three.js y shaders GLSL',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
