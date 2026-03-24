import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <section className="hero">
        <h1>🚀 Réservation en ligne pour pros</h1>
        <p>Coiffeurs • Barbiers • Restos • Assos<br/>
        <strong>Site + RDV = 250€</strong><br/>En ligne en 48h</p>
    <a href="https://callrdv-ia.vercel.app/" target="_blank" className="cta-button" rel="noopener noreferrer">
  VOIR LA DÉMO RDV
</a>
      </section>

      <section className="features">
        <h2>Ce que vous avez pour 250€</h2>
        <div className="grid">
          <div className="feature-card">
            <h3>Site pro</h3><p>Design + logo personnalisé</p>
          </div>
          <div className="feature-card">
            <h3>RDV en ligne</h3><p>Calendrier + confirmations</p>
          </div>
          <div className="feature-card">
            <h3>Formation</h3><p>15min vidéo + support</p>
          </div>
        </div>
      </section>

      <section id="tarifs" className="tarifs">
        <div className="container">
          <h2>💰 Tarifs</h2>
          <div className="prix-grid">
            <div className="prix-card">
              <h3>Site + RDV</h3>
              <div className="prix">250€</div>
            </div>
          </div>
          
          <div className="lead-form">
            <h3>Intéressé ? 30 secondes</h3>
            <form action="https://formsubmit.co/abdoulsalam.sow@outlook.fr" method="POST">
              <input type="text" name="nom" placeholder="Nom" required />
              <input type="tel" name="tel" placeholder="06 XX XX XX XX" required />
              <select name="type" required>
                <option>Coiffeur</option>
                <option>Restaurant</option>
                <option>Fast-food</option>
                <option>Asso</option>
                <option>Autre</option>
              </select>
              <button type="submit" className="cta-button">Démo gratuite</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
<button type="button" onClick={() => window.open('https://callrdv-ia.vercel.app/', '_blank')} className="cta-button">
  Tester la démo RDV
</button>
