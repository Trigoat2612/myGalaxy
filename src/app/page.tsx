import GalaxyBackground from '@/components/galaxy/GalaxyBackground';

export default function Home() {
  return (
    <>
      <GalaxyBackground />

      <main className="content">
        <section className="hero">
          <span className="eyebrow">GALAXIA RESPONSIVE · V2.3 · EXPLORACIÓN INTERACTIVA</span>

          <h1>
            Explora
            <span> el universo</span>
          </h1>

          <p>
            Una galaxia procedural que ahora puede recorrerse: zoom limitado, órbita controlada,
            regiones interactivas, transiciones de cámara y hotspots sobre la arquitectura GPU que
            ya estabilizamos.
          </p>

          <div className="actions">
            <a className="primaryButton" href="#arquitectura">
              Explorar arquitectura
            </a>
            <span className="hint">drag orbit · smooth zoom · hotspots · camera focus · adaptive GPU</span>
          </div>
        </section>

        <section id="arquitectura" className="infoPanel">
          <div>
            <strong>Exploración</strong>
            <span>Modo interactivo activable con órbita, zoom y cámara con límites seguros.</span>
          </div>
          <div>
            <strong>Regiones</strong>
            <span>Núcleo, brazo interior y cúmulo estelar pueden enfocarse mediante hotspots.</span>
          </div>
          <div>
            <strong>Experiencia</strong>
            <span>La navegación normal permanece intacta hasta que el usuario activa la exploración.</span>
          </div>
        </section>
      </main>
    </>
  );
}
