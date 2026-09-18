export default function HomeContent() {
  return (
    <main className="content">
      <section id="inicio" className="hero">
        <span className="eyebrow">GALAXIA</span>
    
        <h1>
          Explora
          <span> el universo</span>
        </h1>
    
        <p>
          Una experiencia galáctica, exploración interactiva, presentación
          automática y ambientación sonora automática al primer gesto.
        </p>
    
        <div className="actions">
          <a className="primaryButton" href="#contacto">
            Conoce al desarrollador
          </a>
    
          <span className="hint">
            cinematic flight · stellar hotspots · ambient audio ·
            presentation mode · adaptive GPU
          </span>
        </div>
      </section>
    
      <section
        id="contacto"
        className="infoPanel"
        aria-label="Información profesional del desarrollador"
      >
        <div className="infoColumn">
          <div className="infoBlock">
            <strong className="infoTitle">Miguel Trigoso</strong>
    
            <span>
              Full Stack Developer · Backend · Integración de Sistemas · Datos
            </span>
          </div>
    
          <div className="infoBlock">
            <strong className="infoSubtitle">Contacto</strong>
    
            <div className="contactLinks">
              <a
                className="contactLink"
                href="mailto:mtrigosoq@gmail.com"
                aria-label="Enviar correo a Miguel Trigoso"
              >
                <span className="contactIcon">@</span>
                <span>mtrigosoq@gmail.com</span>
              </a>
    
              <a
                className="contactLink"
                href="https://www.linkedin.com/in/mkt2612/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Perfil de LinkedIn de Miguel Trigoso"
              >
                <span className="linkedinIcon">in</span>
                <span>LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
    
        <div className="infoColumn">
          <div className="infoBlock">
            <strong className="infoTitle">Perfil profesional</strong>
    
            <span>
              Ingeniero de Sistemas e Informática con experiencia en desarrollo
              de aplicaciones, análisis funcional, integración de servicios y
              soluciones empresariales.
            </span>
          </div>
    
          <div className="infoBlock infoBlockSecondary">
            <strong className="infoSubtitle">Experiencia</strong>
    
            <span>
              Proyectos tecnológicos en sector público, telefonía y consultoría,
              participando en desarrollo, análisis funcional y modernización
              de sistemas.
            </span>
          </div>
        </div>
    
        <div className="infoColumn">
          <div className="infoBlock">
            <strong className="infoTitle">Tecnologías</strong>
    
            <div className="techList">
              <span>C#</span>
              <span>.NET</span>
              <span>Java</span>
              <span>Python</span>
              <span>React</span>
              <span>TypeScript</span>
              <span>Oracle</span>
              <span>SQL</span>
              <span>PostgreSQL</span>
            </div>
          </div>
    
          <div className="infoBlock infoBlockSecondary">
            <strong className="infoSubtitle">Especialización</strong>
    
            <span>
              Backend · APIs · Integraciones · Bases de datos · Desarrollo Full Stack
            </span>
          </div>
        </div>
      </section>

      <div className="backToTopRow">
        <a className="backToTopButton" href="#inicio" aria-label="Volver al inicio de la página">
          <span aria-hidden="true">↑</span>
          <span>Volver al inicio</span>
        </a>
      </div>
    </main>
  );
}
