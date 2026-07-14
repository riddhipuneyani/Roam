/**
 * Observability-only timing trace for the generation pipeline. Callers pass
 * one instance down through the stages; at the end a single structured
 * summary is printed so latency can be read at a glance in the terminal.
 * Never affects behavior — every parameter accepting it is optional.
 */

export interface TraceStage {
  stage: string;
  ms: number;
  detail: string;
}

export class GenerationTrace {
  private readonly startedAt = Date.now();
  readonly stages: TraceStage[] = [];

  add(stage: string, ms: number, detail = ''): void {
    this.stages.push({ stage, ms: Math.round(ms), detail });
  }

  logSummary(label: string, extra: Record<string, unknown> = {}): void {
    const totalMs = Date.now() - this.startedAt;
    const accounted = this.stages.reduce((sum, s) => sum + s.ms, 0);
    console.log(
      `[roam][timing] ${JSON.stringify(
        {
          label,
          ...extra,
          totalMs,
          unaccountedMs: Math.max(totalMs - accounted, 0),
          stages: this.stages,
        },
        null,
        2,
      )}`,
    );
  }
}
