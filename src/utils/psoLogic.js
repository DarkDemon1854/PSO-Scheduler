export class PSOOptimizer {
  constructor(config) {
    const {
      tasks,
      vms,
      numParticles = 30,
      w = 0.9,
      c1 = 1.5,
      c2 = 1.5,
      maxIterations = 300,
    } = config;

    this.numTasks = tasks.length;
    this.numVMs = vms.length;
    this.numParticles = numParticles;
    this.wInitial = w;
    this.w = w;
    this.c1 = c1;
    this.c2 = c2;
    this.maxIterations = maxIterations;
    this.vms = vms;
    this.tasks = tasks;

    this.particles = Array.from({ length: numParticles }, (_, pid) => {
      const position = Array.from({ length: this.numTasks }, () =>
        Math.floor(Math.random() * this.numVMs)
      );
      const velocity = Array.from({ length: this.numTasks }, () =>
        (Math.random() - 0.5) * 2
      );
      const pBest = [...position];
      const pBestFitness = this.calculateMakespan(position);
      return { id: pid, position, velocity, pBest, pBestFitness, fitness: pBestFitness };
    });

    this.gBest = [...this.particles[0].position];
    this.gBestFitness = this.particles[0].pBestFitness;
    for (let i = 1; i < this.numParticles; i++) {
      if (this.particles[i].pBestFitness < this.gBestFitness) {
        this.gBestFitness = this.particles[i].pBestFitness;
        this.gBest = [...this.particles[i].position];
      }
    }

    this.iteration = 0;
    this.history = [{ iteration: 0, makespan: parseFloat(this.gBestFitness.toFixed(2)) }];
    this.lastEvent = this._describeInit();
  }

  calculateMakespan(position) {
    const vmTime = new Array(this.numVMs).fill(0);
    for (let i = 0; i < this.numTasks; i++) {
      const vmIdx = position[i];
      if (vmIdx >= 0 && vmIdx < this.numVMs) {
        vmTime[vmIdx] += this.tasks[i].length / this.vms[vmIdx].mips;
      }
    }
    return Math.max(...vmTime);
  }

  _describeInit() {
    const bottleneck = this.vms.reduce((a, b) => {
      const ta = this.tasks.filter((_, i) => this.gBest[i] === a.id).reduce((s, t) => s + t.length / a.mips, 0);
      const tb = this.tasks.filter((_, i) => this.gBest[i] === b.id).reduce((s, t) => s + t.length / b.mips, 0);
      return tb > ta ? b : a;
    });
    return {
      phase: 'Initialization',
      icon: '🚀',
      headline: `Swarm initialized with ${this.numParticles} particles`,
      detail: `Each particle represents a complete schedule — a random assignment of all ${this.numTasks} tasks across ${this.numVMs} VMs. The best starting schedule has a makespan of ${this.gBestFitness.toFixed(1)} ms. The bottleneck VM is currently ${bottleneck.name || 'VM ' + bottleneck.id} (slowest).`,
    };
  }

  step() {
    this.iteration++;
    this.w = Math.max(0.4, this.wInitial - (this.wInitial - 0.4) * (this.iteration / this.maxIterations));

    let improvedCount = 0;
    let globalImproved = false;
    const prevBest = this.gBestFitness;

    for (let p of this.particles) {
      for (let i = 0; i < this.numTasks; i++) {
        const r1 = Math.random();
        const r2 = Math.random();

        p.velocity[i] =
          this.w * p.velocity[i] +
          this.c1 * r1 * (p.pBest[i] - p.position[i]) +
          this.c2 * r2 * (this.gBest[i] - p.position[i]);

        p.velocity[i] = Math.max(-this.numVMs / 2, Math.min(this.numVMs / 2, p.velocity[i]));

        let np = Math.round(p.position[i] + p.velocity[i]);
        if (np < 0) { np = 0; p.velocity[i] *= -1; }
        else if (np >= this.numVMs) { np = this.numVMs - 1; p.velocity[i] *= -1; }
        p.position[i] = np;
      }

      p.fitness = this.calculateMakespan(p.position);

      if (p.fitness < p.pBestFitness) {
        p.pBestFitness = p.fitness;
        p.pBest = [...p.position];
        improvedCount++;

        if (p.pBestFitness < this.gBestFitness) {
          this.gBestFitness = p.pBestFitness;
          this.gBest = [...p.pBest];
          globalImproved = true;
        }
      }
    }

    this.history.push({ iteration: this.iteration, makespan: parseFloat(this.gBestFitness.toFixed(2)) });
    this.lastEvent = this._describeStep(improvedCount, globalImproved, prevBest);

    return {
      iteration: this.iteration,
      gBest: this.gBest,
      gBestFitness: this.gBestFitness,
      history: [...this.history],
      vms: this.vms,
      tasks: this.tasks,
      event: this.lastEvent,
      w: this.w,
    };
  }

  _describeStep(improvedCount, globalImproved, prevBest) {
    const progress = this.iteration / this.maxIterations;
    let phase, icon;

    if (progress < 0.15) {
      phase = 'Exploration';
      icon = '🔍';
    } else if (progress < 0.6) {
      phase = 'Exploitation';
      icon = '📡';
    } else if (progress < 0.85) {
      phase = 'Convergence';
      icon = '🎯';
    } else {
      phase = 'Stabilization';
      icon = '✅';
    }

    let headline, detail;

    if (globalImproved) {
      const drop = prevBest - this.gBestFitness;
      headline = `🏆 New global best! Makespan dropped by ${drop.toFixed(1)} ms`;
      detail = `A particle found a better schedule. The swarm will now collectively "pull" toward this new arrangement. Inertia weight = ${this.w.toFixed(3)} (lower = particles trust the group more).`;
    } else if (improvedCount > 0) {
      headline = `${improvedCount} particle(s) found personal bests`;
      detail = `These particles are updating their memory. The global best hasn't changed yet — the swarm is still exploring. Inertia w=${this.w.toFixed(3)}.`;
    } else {
      headline = `No improvements this iteration`;
      detail = `All particles are comparing themselves to the best known solution. The swarm may be converging or stuck. Inertia w=${this.w.toFixed(3)} — particles are becoming more "social" and less "exploratory".`;
    }

    return { phase, icon, headline, detail };
  }

  getVMWorkload() {
    return this.vms.map(vm => {
      const assigned = this.tasks.filter((_, i) => this.gBest[i] === vm.id);
      const totalLength = assigned.reduce((s, t) => s + t.length, 0);
      const execTime = assigned.reduce((s, t) => s + t.length / vm.mips, 0);
      return { ...vm, assigned, totalLength, execTime };
    });
  }
}

export function generateRandomTasks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Task-${i + 1}`,
    length: Math.floor(Math.random() * 90000) + 10000,
  }));
}

export function generateRandomVMs(count) {
  const mipsOptions = [500, 750, 1000, 1250, 1500, 1750, 2000];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `VM-${i + 1}`,
    mips: mipsOptions[Math.floor(Math.random() * mipsOptions.length)],
  }));
}
