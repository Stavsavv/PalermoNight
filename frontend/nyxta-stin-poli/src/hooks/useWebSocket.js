import { useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(url) {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket error", err);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((msgs) => [...msgs, data]);
      } catch (e) {
        console.error("Invalid JSON", event.data);
      }
    };

    return () => {
      ws.current.close();
    };
  }, [url]);

  const sendMessage = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, messages, sendMessage };
}
