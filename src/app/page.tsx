import GalaxyBackground from '@/components/galaxy/GalaxyBackground';

export default function Home() {
  return (
    <>
      <GalaxyBackground />

      <main className="content">
        <section className="hero">
          <span className="eyebrow">GALAXIA RESPONSIVE · V2.2 · GALAXIA VIVA</span>

          <h1>
            Explora
            <span> el universo</span>
          </h1>

          <p>
            Una galaxia procedural con capas de profundidad, cúmulos estelares, variación térmica,
            rotación diferencial y un núcleo vivo calculado en GPU, conservando la estructura
            visual que ya estabilizamos.
          </p>

          <div className="actions">
            <a className="primaryButton" href="#arquitectura">
              Explorar arquitectura
            </a>
            <span className="hint">GLSL · differential rotation · star clusters · multilayer parallax</span>
          </div>
        </section>

        <section id="arquitectura" className="infoPanel">
          <div>
            <strong>Galaxia viva</strong>
            <span>Núcleo orgánico, rotación diferencial y temperaturas estelares variadas.</span>
          </div>
          <div>
            <strong>Profundidad</strong>
            <span>Cúmulos, polvo con espesor y estrellas cercanas/lejanías con parallax independiente.</span>
          </div>
          <div>
            <strong>Render adaptativo</strong>
            <span>La densidad y resolución se ajustan al rendimiento del dispositivo.</span>
          </div>
        </section>
      </main>
    </>
  );
}
