'use client';
import Link from 'next/link';

function BookIllustration() {
  return (
    <svg viewBox="0 0 500 420" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="270" cy="215" r="185" fill="#eff6ff"/>
      <rect x="80" y="288" width="320" height="54" rx="6" fill="#1e3a8a"/>
      <rect x="80" y="288" width="18" height="54" rx="4" fill="#172554"/>
      <rect x="398" y="290" width="7" height="50" rx="2" fill="#f1f5f9" opacity="0.9"/>
      <rect x="112" y="308" width="110" height="8" rx="4" fill="#3b82f6" opacity="0.8"/>
      <rect x="112" y="321" width="75" height="5" rx="2.5" fill="#60a5fa" opacity="0.6"/>
      <rect x="98" y="232" width="284" height="54" rx="6" fill="#1d4ed8"/>
      <rect x="98" y="232" width="18" height="54" rx="4" fill="#1a44c4"/>
      <rect x="380" y="234" width="7" height="50" rx="2" fill="#f1f5f9" opacity="0.9"/>
      <rect x="130" y="252" width="110" height="8" rx="4" fill="#60a5fa" opacity="0.8"/>
      <rect x="130" y="265" width="75" height="5" rx="2.5" fill="#93c5fd" opacity="0.6"/>
      <rect x="116" y="176" width="250" height="54" rx="6" fill="#2563eb"/>
      <rect x="116" y="176" width="18" height="54" rx="4" fill="#1d4ed8"/>
      <rect x="364" y="178" width="7" height="50" rx="2" fill="#f1f5f9" opacity="0.9"/>
      <rect x="148" y="196" width="110" height="8" rx="4" fill="#93c5fd" opacity="0.8"/>
      <rect x="148" y="209" width="75" height="5" rx="2.5" fill="#bfdbfe" opacity="0.7"/>
      <rect x="150" y="56" width="160" height="108" rx="10" fill="white" stroke="#dbeafe" strokeWidth="1.5"/>
      <rect x="228" y="60" width="4" height="100" rx="2" fill="#bfdbfe"/>
      <line x1="164" y1="82" x2="222" y2="82" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="164" y1="94" x2="222" y2="94" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="164" y1="106" x2="222" y2="106" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="164" y1="118" x2="210" y2="118" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="236" y1="82" x2="298" y2="82" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="236" y1="94" x2="298" y2="94" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="236" y1="106" x2="298" y2="106" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="236" y1="118" x2="284" y2="118" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="72" cy="145" r="7" fill="#bfdbfe"/>
      <circle cx="445" cy="195" r="10" fill="#dbeafe"/>
      <circle cx="432" cy="318" r="6" fill="#bfdbfe"/>
      <circle cx="60" cy="330" r="5" fill="#93c5fd"/>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="brand-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </span>
          Textbook Tracker
        </div>
        <nav className="landing-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="landing-actions">
          <Link href="/login" className="btn" style={{ padding: '0.55rem 1.2rem', borderRadius: '8px' }}>Login</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero" id="home">
        <div className="landing-hero-text">
          <h1>Track, Manage &amp; Request Textbooks with Ease</h1>
          <p>A simple and efficient way to manage textbook inventory and handle requests in your institution.</p>
          <div className="landing-hero-buttons">
            <Link href="/login" className="btn" style={{ padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '1rem' }}>Get Started</Link>
            <a href="#features" className="btn outline" style={{ padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '1rem' }}>Learn More</a>
          </div>
        </div>
        <div className="landing-hero-art">
          <BookIllustration />
        </div>
      </section>

      {/* About */}
      <section className="landing-about" id="about">
        <div className="landing-section-inner">
          <div className="landing-about-text">
            <span className="landing-tag">About Us</span>
            <h2>Built for educational institutions</h2>
            <p>Textbook Request Tracker is a purpose-built tool for managing learner textbook requests from the moment they arrive to the day they are printed and delivered.</p>
            <p>One manager account does everything — enter the request, attach the PDF, send it to print with a tracking number, and mark it printed.</p>
          </div>
          <div className="landing-about-stats">
            <div className="about-stat">
              <span className="about-stat-value">3</span>
              <span className="about-stat-label">Status Stages</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value">1</span>
              <span className="about-stat-label">Manager Login</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value">100%</span>
              <span className="about-stat-label">Tracked &amp; Time-stamped</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-value">∞</span>
              <span className="about-stat-label">Textbook Requests</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-tag">Features</span>
            <h2>Everything you need in one place</h2>
            <p>Designed to simplify textbook management from request to delivery.</p>
          </div>
          <div className="landing-features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <h3>Manage Textbooks</h3>
              <p>Add, update and organise all textbooks in one place with a full searchable catalog.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>Track Requests</h3>
              <p>Easily manage and track textbook requests from students with real-time status updates.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3>Status Tracking</h3>
              <p>Follow every request through a clear workflow from creation to print and delivery.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <h3>Tracking Numbers</h3>
              <p>Capture the print/delivery tracking number on every request — searchable and included in CSV export.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Secure Authentication</h3>
              <p>JWT-based sessions with bcrypt password hashing keep your institution's data safe.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <h3>Detailed Reports</h3>
              <p>Get insights with dashboard stats covering textbooks, requests, and user activity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="landing-contact" id="contact">
        <div className="landing-section-inner landing-contact-inner">
          <div className="landing-section-header">
            <span className="landing-tag">Contact</span>
            <h2>Get in touch</h2>
            <p>Have a question or want to set up Textbook Tracker for your institution?</p>
          </div>
          <div className="contact-cards">
            <div className="contact-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h3>Email Us</h3>
              <p>support@textbooktracker.com</p>
            </div>
            <div className="contact-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <h3>Location</h3>
              <p>London, United Kingdom</p>
            </div>
            <div className="contact-card">
              <div className="feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>Support Hours</h3>
              <p>Mon – Fri, 9am – 5pm GMT</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link href="/login" className="btn" style={{ padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '1rem' }}>Get Started Free</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>© 2024 Textbook Tracker. All rights reserved.</p>
      </footer>
    </div>
  );
}
