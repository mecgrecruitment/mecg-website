import { createHash } from "node:crypto";

export type ScreeningPacketInput = {
  packetId: string;
  eligibleReviewerIds: string[];
};

export type ScreeningReviewerInput = {
  reviewerId: string;
  capacity?: number;
};

export type ScreeningAssignment = {
  packetId: string;
  reviewerId: string;
};

export type ScreeningDistribution = {
  feasible: boolean;
  assignments: ScreeningAssignment[];
  shortages: string[];
  loads: Record<string, number>;
};

type Edge = { to: number; reverse: number; capacity: number; original: number };

function seededRank(seed: string, value: string) {
  return createHash("sha256").update(`${seed}:${value}`).digest("hex");
}

function addEdge(graph: Edge[][], from: number, to: number, capacity: number) {
  const forward: Edge = { to, reverse: graph[to].length, capacity, original: capacity };
  const reverse: Edge = { to: from, reverse: graph[from].length, capacity: 0, original: 0 };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function maxFlow(graph: Edge[][], source: number, sink: number) {
  let total = 0;
  while (true) {
    const parent = Array<{ node: number; edge: number } | null>(graph.length).fill(null);
    const queue = [source];
    parent[source] = { node: source, edge: -1 };
    for (let cursor = 0; cursor < queue.length && !parent[sink]; cursor += 1) {
      const node = queue[cursor];
      graph[node].forEach((edge, edgeIndex) => {
        if (edge.capacity > 0 && !parent[edge.to]) {
          parent[edge.to] = { node, edge: edgeIndex };
          queue.push(edge.to);
        }
      });
    }
    if (!parent[sink]) return total;
    let node = sink;
    while (node !== source) {
      const step = parent[node];
      if (!step) throw new Error("broken flow path");
      const edge = graph[step.node][step.edge];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
      node = step.node;
    }
    total += 1;
  }
}

export function distributeScreeningReviews({
  packets,
  reviewers,
  reviewsPerPacket = 3,
  seed,
}: {
  packets: ScreeningPacketInput[];
  reviewers: ScreeningReviewerInput[];
  reviewsPerPacket?: number;
  seed: string;
}): ScreeningDistribution {
  if (!Number.isInteger(reviewsPerPacket) || reviewsPerPacket < 1) {
    throw new Error("reviewsPerPacket must be a positive integer");
  }
  const reviewerIds = [...new Set(reviewers.map((reviewer) => reviewer.reviewerId))];
  const packetIds = [...new Set(packets.map((packet) => packet.packetId))];
  if (reviewerIds.length !== reviewers.length || packetIds.length !== packets.length) {
    throw new Error("reviewers and packets must be unique");
  }

  const required = packets.length * reviewsPerPacket;
  const orderedReviewers = [...reviewerIds].sort((a, b) => seededRank(seed, a).localeCompare(seededRank(seed, b)));
  const maximums = new Map(reviewers.map((reviewer) => [reviewer.reviewerId, Math.max(0, Math.min(reviewer.capacity ?? required, required))]));
  const orderedPackets = [...packets].sort((a, b) =>
    a.eligibleReviewerIds.length - b.eligibleReviewerIds.length ||
    seededRank(seed, a.packetId).localeCompare(seededRank(seed, b.packetId)),
  );

  const source = 0;
  const reviewerStart = 1;
  const packetStart = reviewerStart + orderedReviewers.length;
  const sink = packetStart + orderedPackets.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);

  const largestCapacity = Math.max(0, ...maximums.values());
  for (let load = 0; load < largestCapacity; load += 1) {
    orderedReviewers.forEach((reviewerId, index) => {
      if ((maximums.get(reviewerId) ?? 0) > load) addEdge(graph, source, reviewerStart + index, 1);
    });
  }
  orderedPackets.forEach((packet, packetIndex) => {
    const eligible = new Set(packet.eligibleReviewerIds);
    orderedReviewers.forEach((reviewerId, reviewerIndex) => {
      if (eligible.has(reviewerId)) addEdge(graph, reviewerStart + reviewerIndex, packetStart + packetIndex, 1);
    });
    addEdge(graph, packetStart + packetIndex, sink, reviewsPerPacket);
  });

  maxFlow(graph, source, sink);
  const assignments: ScreeningAssignment[] = [];
  const loads = Object.fromEntries(reviewerIds.map((id) => [id, 0]));
  orderedReviewers.forEach((reviewerId, reviewerIndex) => {
    for (const edge of graph[reviewerStart + reviewerIndex]) {
      if (edge.to >= packetStart && edge.to < sink && edge.original === 1 && edge.capacity === 0) {
        const packetId = orderedPackets[edge.to - packetStart].packetId;
        assignments.push({ packetId, reviewerId });
        loads[reviewerId] += 1;
      }
    }
  });

  const coverage = new Map<string, number>();
  assignments.forEach(({ packetId }) => coverage.set(packetId, (coverage.get(packetId) ?? 0) + 1));
  const shortages = packetIds.filter((packetId) => (coverage.get(packetId) ?? 0) !== reviewsPerPacket);
  return { feasible: shortages.length === 0, assignments, shortages, loads };
}
