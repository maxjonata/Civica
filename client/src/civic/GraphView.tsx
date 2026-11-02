import { useState } from "react";
import type { PublicGraph } from "@shared/civic/contracts";
import { projectGraphPoint } from "./graph-projection";

export function GraphView({ graph }: { graph: PublicGraph }) {
  const [yaw, setYaw] = useState(25);
  const [pitch, setPitch] = useState(20);
  const projected = graph.nodes.map(node => ({
    node,
    point: projectGraphPoint(node, yaw, pitch),
  }));
  const positions = new Map(projected.map(item => [item.node.id, item.point]));
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));

  return (
    <>
      {graph.excludedProfileCount > 0 && (
        <p className="civic-note" role="status">
          {graph.excludedProfileCount} perfil(is) não aparece(m) na visualização
          porque faltam dimensões comuns suficientes. A ausência não significa
          oposição, neutralidade ou distância zero.
        </p>
      )}
      <fieldset className="civic-fieldset civic-graph-controls">
        <legend>Controles da visualização tridimensional</legend>
        <div className="civic-field">
          <label htmlFor="graph-yaw">Rotação horizontal: {yaw} graus</label>
          <input
            id="graph-yaw"
            type="range"
            min="-180"
            max="180"
            step="5"
            value={yaw}
            onChange={event => setYaw(Number(event.target.value))}
          />
        </div>
        <div className="civic-field">
          <label htmlFor="graph-pitch">Inclinação vertical: {pitch} graus</label>
          <input
            id="graph-pitch"
            type="range"
            min="-60"
            max="60"
            step="5"
            value={pitch}
            onChange={event => setPitch(Number(event.target.value))}
          />
        </div>
        <p className="civic-small" id="graph-controls-help">
          Ajuste com as setas do teclado. A visualização não gira sozinha; os valores originais e as distâncias estão na tabela.
        </p>
      </fieldset>
      <div className="civic-graph-panel">
        <svg
          viewBox="0 0 620 360"
          role="img"
          aria-labelledby="graph-svg-title graph-svg-desc"
        >
          <title id="graph-svg-title">Projeção ajustável do grafo tridimensional</title>
          <desc id="graph-svg-desc">
            A posição visual usa as três coordenadas do modelo e muda com a rotação e inclinação. Ela não representa eixos políticos. Consulte as tabelas equivalentes para valores, fontes e distâncias.
          </desc>
          {graph.edges.map(edge => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                className="civic-graph-edge"
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              />
            );
          })}
          {projected.map(({ node, point }) => (
            <g key={node.id}>
              <circle
                className="civic-graph-node"
                cx={point.x}
                cy={point.y}
                r={Math.max(5, Math.min(9, 7 + point.depth))}
              />
              <text className="civic-graph-label" x={point.x + 12} y={point.y + 4}>
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <section className="civic-section" aria-labelledby="graph-distance-title">
        <h2 id="graph-distance-title">Distâncias calculadas</h2>
        <p className="civic-small">
          Distância euclidiana nas dimensões temáticas comuns; não é distância física nem coordenada visual.
        </p>
        {graph.edges.length ? (
          <div className="civic-table-wrap" role="region" tabIndex={0} aria-label="Tabela de distâncias; use as setas do teclado para acessar todas as colunas.">
            <table className="civic-table">
              <caption>Comparações retornadas pelo método indicado abaixo.</caption>
              <thead>
                <tr>
                  <th scope="col">Par de perfis</th>
                  <th scope="col">Distância temática</th>
                  <th scope="col">Dimensões comuns</th>
                </tr>
              </thead>
              <tbody>
                {graph.edges.map(edge => (
                  <tr key={`${edge.source}-${edge.target}`}>
                    <th scope="row">
                      {labels.get(edge.source) ?? "Perfil não identificado"} — {labels.get(edge.target) ?? "Perfil não identificado"}
                    </th>
                    <td>{edge.distance.toFixed(4)}</td>
                    <td>{edge.sharedDimensions.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhuma comparação foi publicada para estes perfis.</p>
        )}
      </section>
    </>
  );
}
