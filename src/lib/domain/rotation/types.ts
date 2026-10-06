export type RotationStatus = 'READY' | 'PLAYING' | 'RESTING' | 'AWAY' | 'OUT' | 'LEFT';

export type RotationPlayerInput = {
	id: string;
	name?: string;
	status: RotationStatus;
	readySinceMs: number | null;
	eligibleOpportunities: number;
	missedOpportunities: number;
	currentOpportunityDebt: number;
	setsPlayed: number;
	consecutiveRotations: number;
	rotationsPlayed?: number;
	fillInSets?: number;
};

export type CandidateMetrics = {
	currentReadyWaitMs: number;
	eligibleOpportunities: number;
	missedOpportunities: number;
	currentOpportunityDebt: number;
	setsPlayed: number;
	consecutiveRotations: number;
};

export type RotationWeights = {
	opportunityDebt: number;
	readyWaitPerMinute: number;
	setDeficitPerSet: number;
	consecutiveSecondRotationPenalty: number;
	thirdConsecutivePenalty: number;
};

export type RankedCandidate = {
	playerId: string;
	tier: 'SHOULD_PLAY' | 'NORMAL' | 'DEPRIORITIZED';
	priority: number;
	reasons: string[];
	metrics: CandidateMetrics;
};

export type StarvationPolicy = { currentOpportunityDebt: number; readyWaitMinutes: number } | null;

export type RotationRecommendation = {
	selectedPlayerIds: string[];
	rankedCandidates: RankedCandidate[];
	diagnostics: { eligibleCount: number; consecutiveFallbackUsed: boolean };
};

export type SimulationEvent =
	| { atMs: number; type: 'ARRIVE'; playerId: string; name?: string }
	| { atMs: number; type: 'STATUS'; playerId: string; status: RotationStatus };

export type SimulationOptions = {
	players: Array<{
		id: string;
		name?: string;
		arrivesAtMs?: number;
		initialStatus?: RotationStatus;
	}>;
	events?: SimulationEvent[];
	matchDurationsMs: number[];
	rotations?: number;
	strategy?: 'COMBINED' | 'LEAST_GAMES' | 'FIFO';
	weights?: RotationWeights;
	starvationPolicy?: StarvationPolicy;
	overrides?: Record<number, string[]>;
	fillIns?: Record<number, Array<{ outgoingPlayerId: string; incomingPlayerId: string }>>;
};

export type PlayerSimulationMetrics = {
	playerId: string;
	setsPlayed: number;
	rotationsPlayed: number;
	eligibleOpportunities: number;
	missedOpportunities: number;
	currentOpportunityDebt: number;
	currentReadyWaitMs: number;
	totalReadyWaitMs: number;
	maximumContinuousReadyWaitMs: number;
	consecutiveRotations: number;
	fillInSets: number;
};

export type SimulationResult = {
	rotationsCompleted: number;
	forcedThirdConsecutiveSelections: number;
	selections: Array<{
		rotation: number;
		recommended: string[];
		actual: string[];
		fillIns: string[];
	}>;
	players: PlayerSimulationMetrics[];
	metrics: {
		setsPlayed: { min: number; max: number; mean: number; standardDeviation: number };
		rotationsPlayed: { min: number; max: number; mean: number; standardDeviation: number };
		missedOpportunities: { min: number; max: number; mean: number; standardDeviation: number };
		eligibleOpportunities: { min: number; max: number; mean: number; standardDeviation: number };
		currentReadyWaitMs: { min: number; max: number; mean: number; standardDeviation: number };
		totalReadyWaitMs: { min: number; max: number; mean: number; standardDeviation: number };
		maximumContinuousReadyWaitMs: number;
		consecutiveMatchSelections: number;
		selectionSpread: number;
		starvationIncidents: number;
	};
};
