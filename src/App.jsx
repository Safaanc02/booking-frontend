import React, { useContext, useState } from "react";
import { AuthContext } from "./AuthContext";
import axios from "axios";

function App() {
  const { authenticated, token } = useContext(AuthContext);
  const [message, setMessage] = useState("");

  const callApi = async (url) => {
    try {
      const res = await axios.get(`http://localhost:8080${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(res.data);
    } catch (err) {
      setMessage("❌ Erreur: " + err.response?.status);
    }
  };

  if (!authenticated) return <h2>🔐 Connexion en cours...</h2>;

  return (
    <div>
      <h1>Booking Frontend ✅</h1>
     <button onClick={() => callApi("/api/public/hello")}>Public</button>
     <button onClick={() => callApi("/api/user/hello")}>User</button>
     <button onClick={() => callApi("/api/admin/hello")}>Admin</button>

      <p>Réponse backend: {message}</p>
    </div>
  );
}

export default App;
