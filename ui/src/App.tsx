import React, { useEffect, useState } from 'react';

type HelpRequest = {
  id: string;
  caller_phone: string;
  question: string;
  status: 'PENDING' | 'RESOLVED' | 'UNRESOLVED';
  created_at: string;
};

export default function App() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [answerInput, setAnswerInput] = useState<{ [key: string]: string }>({});

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (e) {
      console.error('Failed to fetch requests', e);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000); // Pulse check
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id: string, question: string) => {
    const answer = answerInput[id];
    if (!answer) return;

    try {
       await fetch('/api/supervisor/answer', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ help_request_id: id, question, answer })
       });
       setAnswerInput(prev => ({ ...prev, [id]: '' }));
       fetchRequests();
    } catch (e) {
      console.error(e);
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const history = requests.filter(r => r.status !== 'PENDING');

  return (
    <div className="container">
      <header>
        <h1>Frontdesk AI Supervisor</h1>
      </header>

      <div className="dashboard-grid">
        <section className="card">
          <h2>Needs Attention ({pending.length})</h2>
          {pending.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No active escalations. The AI is handling everything autonomously!</p>}
          {pending.map(req => (
            <div key={req.id} className="request-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Caller {req.caller_phone}</strong>
                <span className="status-badge bg-pending">Action Required</span>
              </div>
              <p style={{ margin: '0 0 1rem 0' }}>"{req.question}"</p>
              
              <div className="action-form">
                <input 
                  type="text" 
                  placeholder="Type the correct answer for the AI to learn..."
                  value={answerInput[req.id] || ''}
                  onChange={e => setAnswerInput({...answerInput, [req.id]: e.target.value})}
                  onKeyDown={e => e.key === 'Enter' && handleResolve(req.id, req.question)}
                />
                <button onClick={() => handleResolve(req.id, req.question)}>Resolve & Learn</button>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>Resolution History</h2>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {history.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No past request history.</p>}
            {history.map(req => (
              <div key={req.id} className="request-item" style={{ opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>Caller {req.caller_phone}</strong>
                  <span className={`status-badge bg-${req.status.toLowerCase()}`}>{req.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>"{req.question}"</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
