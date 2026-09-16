import GalaxyBackground from '@/components/galaxy/GalaxyBackground';

export default function Home() {
  return (
    <>
      <GalaxyBackground />

      <main className="content">
        <section className="hero">
          <span className="eyebrow">GALAXIA RESPONSIVE · V1.1</span>

          <h1>
            Explora
            <span> el universo</span>
          </h1>

          <p>
            Una escena 3D responsive construida con React Three Fiber, Three.js y WebGL.
            Mueve el cursor o desliza el dedo para percibir la profundidad.
          </p>

          <div className="actions">
            <a className="primaryButton" href="#arquitectura">
              Comenzar exploración
            </a>
            <span className="hint">Parallax · estrellas variables · meteoros</span>
          </div>
        </section>

        <section id="arquitectura" className="infoPanel">
          <div>
            <strong>GPU</strong>
            <span>BufferGeometry + Points</span>
          </div>
          <div>
            <strong>Responsive</strong>
            <span>Densidad y DPR adaptativos</span>
          </div>
          <div>
            <strong>Accesible</strong>
            <span>prefers-reduced-motion</span>
          </div>
        </section>
      </main>
    </>
  );
}
