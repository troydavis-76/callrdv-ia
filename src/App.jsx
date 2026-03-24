import React from 'react';
import './App.css'; // garde ton CSS si tu en as

function App() {
  return (
    <div className="App">
      {/* HERO */}
      <section className="hero">
        <h1>🚀 Réservation en ligne pour pros</h1>
        <p>
          Coiffeurs • Barbiers • Restos • Associations<br/>
          <strong>Site complet + prise de RDV = 250€</strong><br/>
          En ligne en 48h - Sans abonnement
        </p>
        <a href="#tarifs" className="cta-button">JE VEUX ÇA MAINTENANT</a>
      </section>

      {/* FEATURES */}
      <section className="features">
        <h2>Ce que vous avez pour 250€</h2>
        <div className="grid">
          <div className="feature-card">
            <h3>Site professionnel</h3>
            <p>Design moderne + votre logo + vos couleurs</p>
          </div>
          <div className="feature-card">
            <h3>Prise de RDV en ligne</h3>
            <p>Calendrier • Confirmation auto • Illimité</p>
          </div>
          <div className="feature-card">
            <h3>Formation incluse</h3>
            <p>Vidéo 15min + support 1 mois</p>
          </div>
        </div>
      </section>

      {/* TARIFS */}
    <section id="tarifs" className="tarifs">
  <div className="container">
    <h2>💰 Tarifs clairs</h2>
    <div className="prix-grid">
      <div className="prix-card">
        <h3>Site + RDV</h3>
        <div className="prix">250€</div>
        <p>Une fois • Tout inclus</p>
      </div>
    </div>
    
    {/* NOUVEAU FORMULAIRE */}
    <div className="lead-form">
      <h3>Intéressé ? Dites-moi en 30s</h3>
      <form action="https://formsubmit.co/abdoulsalam.sow@outlook.fr" method="POST">
        <input type="text" name="nom" placeholder="Votre nom" required />
        <input type="tel" name="telephone" placeholder="06 XX XX XX XX" required />
        <select name="commerce" required>
          <option>Coiffeur / Barbier</option>
          <option>Restaurant / Fast-food</option>
          <option>Association / Mosquée</option>
          <option>Auto-école</option>
          <option>Institut de beauté</option>
          <option>Autre</option>
        </select>
        <input type="hidden" name="_next" value="Merci ! Je vous rappelle sous 2h" />
        <button type="submit" className="cta-button">Je veux ma démo gratuite</button>
      </form>
      <p style={{fontSize: '14px', color: '#666', marginTop: '20px'}}>
        ✅ Leads directs dans ta boîte mail
      </p>
    </div>
  </div>
</section>
