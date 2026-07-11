export type SpringState = {
  value: number;
  velocity: number;
};

export function stepCriticalSpring(
  state: SpringState,
  target: number,
  deltaSeconds: number,
  frequencyHz = 1.9,
): SpringState {
  const dt = Math.min(0.25, Math.max(0, deltaSeconds));
  const angularFrequency = 2 * Math.PI * frequencyHz;
  const displacement = state.value - target;
  const intermediate = state.velocity + angularFrequency * displacement;
  const decay = Math.exp(-angularFrequency * dt);

  return {
    value: target + (displacement + intermediate * dt) * decay,
    velocity: (state.velocity - angularFrequency * intermediate * dt) * decay,
  };
}
