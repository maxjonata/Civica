import React, { useEffect } from "react";
import { useLocation } from "wouter";

const NOT_FOUND_PATH = "/404";

export default function NotFound() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH)
      window.location.replace(NOT_FOUND_PATH);
    return () => robots.remove();
  }, []);
  return (
    <main className="page-wrap narrow-page">
      <div className="eyebrow">
        <span className="rule" /> 404
      </div>
      <h1>Esta página não existe.</h1>
      <p className="lede">
        O endereço pode ter mudado, mas os limites do piloto continuam os
        mesmos.
      </p>
      <button
        className="button button--primary"
        type="button"
        onClick={() => setLocation("/")}
      >
        Voltar ao início
      </button>
    </main>
  );
}
