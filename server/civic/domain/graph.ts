import type { PublicGraph, PublicPolicyProfile } from "@shared/civic/contracts";
import type { PolicyPositionRecord, PolicyProfileRecord } from "./types";

export interface DistanceResult {
  distance: number;
  sharedTopics: string[];
}

function validPosition(position: PolicyPositionRecord): boolean {
  if (!Number.isFinite(position.value) || position.value < -2 || position.value > 2) return false;
  if (!position.topic.trim() || !position.sourceTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(position.sourceDate)) return false;
  try {
    const source = new URL(position.sourceUrl);
    return source.protocol === "https:" && !source.username && !source.password;
  } catch {
    return false;
  }
}

export function comparableDistance(
  left: PolicyProfileRecord,
  right: PolicyProfileRecord,
  minimumSharedDimensions = 3
): DistanceResult | null {
  if (!left.verified || !right.verified || left.id === right.id) return null;
  const leftPositions = new Map(left.positions.filter(validPosition).map(position => [position.topic, position.value]));
  const rightPositions = new Map(right.positions.filter(validPosition).map(position => [position.topic, position.value]));
  const sharedTopics = [...leftPositions.keys()].filter(topic => rightPositions.has(topic)).sort();
  if (sharedTopics.length < minimumSharedDimensions) return null;
  const squared = sharedTopics.reduce((sum, topic) => {
    const difference = (leftPositions.get(topic) ?? 0) - (rightPositions.get(topic) ?? 0);
    return sum + difference * difference;
  }, 0);
  return { distance: Math.sqrt(squared), sharedTopics };
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function normalize(vector: number[]): number[] {
  const length = Math.sqrt(dot(vector, vector));
  return length > 1e-12 ? vector.map(value => value / length) : vector.map(() => 0);
}

function mdsCoordinates(distances: number[][]): number[][] {
  const size = distances.length;
  const squared = distances.map(row => row.map(value => value * value));
  const rowMeans = squared.map(row => row.reduce((sum, value) => sum + value, 0) / size);
  const grandMean = rowMeans.reduce((sum, value) => sum + value, 0) / size;
  const gram = squared.map((row, i) => row.map((value, j) => -0.5 * (value - (rowMeans[i] ?? 0) - (rowMeans[j] ?? 0) + grandMean)));
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];

  for (let axis = 0; axis < 3; axis += 1) {
    let vector = normalize(Array.from({ length: size }, (_, index) => Math.sin((index + 1) * (axis + 1.618)) + Math.cos((index + 2) * (axis + 0.73))));
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const next = Array.from({ length: size }, (_, i) => {
        let value = 0;
        for (let j = 0; j < size; j += 1) {
          let entry = gram[i]?.[j] ?? 0;
          for (let prior = 0; prior < eigenvectors.length; prior += 1) {
            entry -= (eigenvalues[prior] ?? 0) * (eigenvectors[prior]?.[i] ?? 0) * (eigenvectors[prior]?.[j] ?? 0);
          }
          value += entry * (vector[j] ?? 0);
        }
        return value;
      });
      const nextNormalized = normalize(next);
      if (dot(nextNormalized, nextNormalized) === 0) break;
      vector = nextNormalized;
    }
    const value = dot(vector, Array.from({ length: size }, (_, i) => {
      let projected = 0;
      for (let j = 0; j < size; j += 1) {
        let entry = gram[i]?.[j] ?? 0;
        for (let prior = 0; prior < eigenvectors.length; prior += 1) {
          entry -= (eigenvalues[prior] ?? 0) * (eigenvectors[prior]?.[i] ?? 0) * (eigenvectors[prior]?.[j] ?? 0);
        }
        projected += entry * (vector[j] ?? 0);
      }
      return projected;
    }));
    if (!Number.isFinite(value) || value <= 1e-10) break;
    eigenvectors.push(vector);
    eigenvalues.push(value);
  }

  return Array.from({ length: size }, (_, index) => [0, 1, 2].map(axis =>
    (eigenvectors[axis]?.[index] ?? 0) * Math.sqrt(Math.max(0, eigenvalues[axis] ?? 0))
  ));
}

function publicProfile(profile: PolicyProfileRecord): PublicPolicyProfile {
  return {
    id: profile.id,
    label: profile.label,
    kind: profile.kind,
    positionSources: profile.positions.filter(validPosition).map(position => ({
      topic: position.topic,
      sourceTitle: position.sourceTitle,
      sourceUrl: position.sourceUrl,
      sourceDate: position.sourceDate,
    })),
    positions: Object.fromEntries(profile.positions.filter(validPosition).map(position => [position.topic, position.value])),
    coverage: profile.positions.filter(validPosition).length,
  };
}

export function projectGraph3d(
  input: readonly PolicyProfileRecord[],
  minimumSharedDimensions = 3
): PublicGraph {
  const profiles = input.filter(profile => profile.verified).slice(0, 50);
  const exposedProfiles = profiles.map(publicProfile);
  const comparisons = new Map<string, DistanceResult>();
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const left = profiles[i];
      const right = profiles[j];
      if (!left || !right) continue;
      const comparison = comparableDistance(left, right, minimumSharedDimensions);
      if (!comparison) continue;
      comparisons.set(`${left.id}\u0000${right.id}`, comparison);
      comparisons.set(`${right.id}\u0000${left.id}`, comparison);
    }
  }
  const coverage = (profile: PolicyProfileRecord): number => profile.positions.filter(validPosition).length;
  const candidates = profiles
    .filter(profile => profiles.some(other => other.id !== profile.id && comparisons.has(`${profile.id}\u0000${other.id}`)))
    .sort((left, right) => coverage(right) - coverage(left) || left.id.localeCompare(right.id));
  const clique: PolicyProfileRecord[] = [];
  for (const candidate of candidates) {
    if (clique.every(member => comparisons.has(`${candidate.id}\u0000${member.id}`))) clique.push(candidate);
  }
  const excludedProfileCount = profiles.length - clique.length;
  if (clique.length < 2) {
    return {
      methodVersion: "policy-distance-v1-mds3d",
      methodDescription: "Distância euclidiana nas posições temáticas comuns, somente quando documentadas. Coordenadas MDS em 3D são uma projeção exploratória, não eixos políticos; a tabela mostra a distância calculada.",
      minimumSharedDimensions,
      excludedProfileCount,
      nodes: [],
      edges: [],
      profiles: exposedProfiles,
      emptyReason: profiles.length === 0 ? "no_verified_positions" : "insufficient_comparable_data",
    };
  }
  const ordered = [...clique].sort((left, right) => left.id.localeCompare(right.id));
  const pairs: Array<{ source: string; target: string; distance: number; sharedDimensions: string[] }> = [];
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const left = ordered[i];
      const right = ordered[j];
      if (!left || !right) continue;
      const comparison = comparisons.get(`${left.id}\u0000${right.id}`);
      if (!comparison) continue;
      pairs.push({ source: left.id, target: right.id, distance: Number(comparison.distance.toFixed(4)), sharedDimensions: comparison.sharedTopics });
    }
  }
  const distanceMatrix = ordered.map(left => ordered.map(right => {
    if (left.id === right.id) return 0;
    return comparisons.get(`${left.id}\u0000${right.id}`)?.distance ?? 0;
  }));
  const coordinates = mdsCoordinates(distanceMatrix);
  const max = Math.max(1, ...coordinates.flat().map(Math.abs));
  const nodes = ordered.map((profile, index) => {
    const point = coordinates[index] ?? [0, 0, 0];
    return {
      id: profile.id,
      label: profile.label,
      kind: profile.kind,
      x: Number(((point[0] ?? 0) / max).toFixed(5)),
      y: Number(((point[1] ?? 0) / max).toFixed(5)),
      z: Number(((point[2] ?? 0) / max).toFixed(5)),
      coverage: coverage(profile),
    };
  });
  return {
    methodVersion: "policy-distance-v1-mds3d",
    methodDescription: "Distância euclidiana nas posições temáticas comuns, somente quando documentadas. Coordenadas MDS em 3D são uma projeção exploratória, não eixos políticos; a tabela mostra a distância calculada.",
    minimumSharedDimensions,
    excludedProfileCount,
    nodes,
    edges: pairs,
    profiles: exposedProfiles,
    emptyReason: null,
  };
}
