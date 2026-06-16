import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './index.css';

// Placeholder Components
const Home = () => (
  <div className="container animate-fade-in" style={{ paddingTop: '4rem' }}>
    <div className="glass-card" style={{ textAlign: 'center' }}>
      <h1 style={{ color: 'var(--color-olive-dark)', fontSize: '3rem' }}>Welcome to TutorMina</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Connect with expert tutors and executive coaches to smash your goals!
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/directory" className="btn btn-primary">Find a Tutor</Link>
        <Link to="/register" className="btn btn-outline">Join as a Coach</Link>
      </div>
    </div>
  </div>
);

const Directory = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Directory (Coming Soon)</h2></div>;
const Login = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Login (Coming Soon)</h2></div>;
const Register = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Register (Coming Soon)</h2></div>;
const Dashboard = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Dashboard (Coming Soon)</h2></div>;

function App() {
  return (
    <Router>
      <nav style={{ 
        padding: '1rem 0', 
        background: 'rgba(255, 255, 255, 0.9)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--color-gray-warm)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-spring-dark)' }}>
            TutorMina
          </Link>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link to="/directory" style={{ fontWeight: 500 }}>Directory</Link>
            <Link to="/login" style={{ fontWeight: 500 }}>Login</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Get Started</Link>
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
