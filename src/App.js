import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Monitoring from './components/Monitoring';

function App() {
    const [session, setSession] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('min2_session');
        if (saved) setSession(JSON.parse(saved));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('min2_session');
        setSession(null);
    };

    return (
        <div className="App">
            {!session ? (
                <Login setSession={setSession} />
            ) : (
                <Monitoring session={session} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;