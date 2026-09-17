import GalaxyBackground from '@/components/galaxy/GalaxyBackground';

export default function Home() {
  return (
    <>
      <GalaxyBackground />

      <main className="content">
        <section className="hero">
          <span className="eyebrow">GALAXIA RESPONSIVE · V2.5 · AMBIENTACIÓN + UX PREMIUM</span>

          <h1>
            Explora
            <span> el universo</span>
          </h1>

          <p>
            Una experiencia galáctica procedural con cinemática, exploración interactiva,
            hotspots estelares, presentación automática y ambientación sonora opcional.
          </p>

          <div className="actions">
            <a className="primaryButton" href="#arquitectura">
              Explorar arquitectura
            </a>
            <span className="hint">cinematic flight · stellar hotspots · ambient audio · presentation mode · adaptive GPU</span>
          </div>
        </section>

        <section id="arquitectura" className="infoPanel">
          <div>
            <strong>Ambientación</strong>
            <span>Audio opcional en loop con fade progresivo, volumen limitado y preferencia persistente.</span>
          </div>
          <div>
            <strong>Presentación</strong>
            <span>Recorrido automático entre regiones estelares usando las transiciones de cámara existentes.</span>
          </div>
          <div>
            <strong>Experiencia</strong>
            <span>Microanimaciones, feedback de enfoque y controles adaptados para escritorio y móvil.</span>
          </div>
        </section>
      </main>
    </>
  );
}
