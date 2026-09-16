import GalaxyBackground from '@/components/galaxy/GalaxyBackground';

export default function Home() {
  return (
    <>
      <GalaxyBackground />

      <main className="content">
        <section className="hero">
          <span className="eyebrow">GALAXIA RESPONSIVE · V2.1.6</span>

          <h1>
            Explora
            <span> el universo</span>
          </h1>

          <p>
            Una galaxia procedural inspirada en la estructura visual de las grandes galaxias
            espirales: disco inclinado, núcleo cálido, polvo interestelar y un cielo profundo
            que conserva contraste y detalle.
          </p>

          <div className="actions">
            <a className="primaryButton" href="#arquitectura">
              Explorar arquitectura
            </a>
            <span className="hint">GLSL · GPU animation · dust lanes · adaptive rendering</span>
          </div>
        </section>

        <section id="arquitectura" className="infoPanel">
          <div>
            <strong>Disco galáctico</strong>
            <span>Bulbo, disco fino y halo exterior con distribuciones independientes.</span>
          </div>
          <div>
            <strong>Polvo interestelar</strong>
            <span>Bandas de extinción rompen la uniformidad y revelan la estructura.</span>
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
